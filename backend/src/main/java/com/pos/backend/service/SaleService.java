package com.pos.backend.service;

import com.pos.backend.dto.SaleDtos.CheckoutItem;
import com.pos.backend.dto.SaleDtos.CheckoutRequest;
import com.pos.backend.dto.SaleDtos.SaleResponse;
import com.pos.backend.entity.*;
import com.pos.backend.entity.AuditLog.Action;
import com.pos.backend.entity.AuditLog.EntityType;
import com.pos.backend.repository.ParticipantRepository;
import com.pos.backend.repository.ProductRepository;
import com.pos.backend.repository.SaleRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.dao.OptimisticLockingFailureException;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.transaction.support.TransactionTemplate;
import org.springframework.web.server.ResponseStatusException;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.List;

@Service
@RequiredArgsConstructor
public class SaleService {

    private final SaleRepository saleRepository;
    private final ParticipantRepository participantRepository;
    private final ProductRepository productRepository;
    private final CampAccess campAccess;
    private final AuditService auditService;
    private final TransactionTemplate transactionTemplate;

    // Retry wrapper around the actual checkout. If two sellers charge the SAME participant at the
    // same moment, the optimistic lock (@Version on Participant) makes the slower one fail -
    // we then simply re-run with the fresh balance. 3 attempts is plenty for a selling stand.
    public SaleResponse checkout(User currentUser, CheckoutRequest request) {
        for (int attempt = 1; ; attempt++) {
            try {
                // TransactionTemplate = programmatic @Transactional. We need it because the retry
                // must happen OUTSIDE the transaction (a failed transaction can't be reused).
                return transactionTemplate.execute(status -> doCheckout(currentUser, request));
            } catch (OptimisticLockingFailureException e) {
                if (attempt >= 3) {
                    throw new ResponseStatusException(HttpStatus.CONFLICT,
                            "The participant was charged by someone else at the same time - please try again");
                }
            }
        }
    }

    private SaleResponse doCheckout(User currentUser, CheckoutRequest request) {
        Camp camp = campAccess.resolveCamp(currentUser, request.campId());
        campAccess.checkCampActive(camp);

        // load participant (if any) and verify they belong to this camp
        Participant participant = null;
        if (request.participantId() != null) {
            participant = participantRepository.findById(request.participantId())
                    .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Participant not found"));
            campAccess.checkSameCamp(currentUser, participant.getCamp());
        }

        // anonymous sales are cash-only: nobody to put debt or credit on
        if (participant == null && (request.useBalance() || request.keepChangeAsCredit())) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                    "Balance and credit options need a participant");
        }

        Sale sale = new Sale();
        sale.setCamp(camp);
        sale.setParticipant(participant);
        sale.setSeller(currentUser);

        // build the items and the total from CURRENT product prices
        BigDecimal total = BigDecimal.ZERO;
        for (CheckoutItem itemRequest : request.items()) {
            Product product = productRepository.findById(itemRequest.productId())
                    .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Product not found"));
            campAccess.checkSameCamp(currentUser, product.getCamp());
            if (!product.isActive()) {
                throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                        "Product is not for sale: " + product.getName());
            }
            if (!product.getCamp().getId().equals(camp.getId())) {
                throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                        "Product belongs to another camp: " + product.getName());
            }

            SaleItem item = new SaleItem();
            item.setSale(sale);
            item.setProduct(product);
            item.setQuantity(itemRequest.quantity());
            item.setUnitPrice(product.getPrice()); // price snapshot
            sale.getItems().add(item);

            total = total.add(product.getPrice().multiply(BigDecimal.valueOf(itemRequest.quantity())));
        }

        BigDecimal balance = participant != null ? participant.getBalance() : BigDecimal.ZERO;
        PaymentSplit split = PaymentSplit.compute(total, request.cashGiven(), balance,
                request.useBalance(), request.keepChangeAsCredit());

        // anonymous sale must be fully covered by cash (no participant = no debt possible)
        if (participant == null && split.debtAmount().signum() > 0) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                    "Not enough cash given (anonymous sales cannot go into debt)");
        }

        sale.setTotalAmount(total);
        sale.setPaidCash(split.paidCash());
        sale.setPaidFromBalance(split.paidFromBalance());
        sale.setDebtAmount(split.debtAmount());
        sale.setExtraCredited(split.extraCredited());

        // apply the balance change - this is the UPDATE the optimistic lock protects
        if (participant != null) {
            participant.setBalance(participant.getBalance().add(split.balanceDelta()));
            participantRepository.save(participant);
        }

        sale = saleRepository.save(sale); // cascade saves the items too

        auditService.record(currentUser, camp, EntityType.SALE, sale.getId(),
                participant != null
                        ? participant.getFirstName() + " " + participant.getLastName()
                        : "Barverkauf",
                Action.SOLD,
                sale.getItems().stream()
                        .map(i -> i.getQuantity() + "x " + i.getProduct().getName())
                        .reduce((a, b) -> a + ", " + b).orElse("") + " = " + total + " €");

        return SaleResponse.from(sale,
                PaymentSplit.changeToReturn(total, request.cashGiven(), request.keepChangeAsCredit()));
    }

    // Reversing = undoing a mistaken sale. The sale row STAYS (audit trail), only its status flips
    // and the participant gets their money back. A plain SELLER's reversal is flagged so the
    // CAMP_LEAD can double check it later (requirement: mistakes happen under stress).
    @Transactional
    public SaleResponse reverse(User currentUser, Long saleId) {
        Sale sale = saleRepository.findById(saleId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Not found"));
        campAccess.checkSameCamp(currentUser, sale.getCamp());

        if (sale.getStatus() == Sale.Status.REVERSED) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "This sale is already reversed");
        }

        // A booking is never destroyed on a whim: it has to be raised for review first,
        // and only the stand leadership may then undo it. Sellers flag, leads decide.
        if (currentUser.getRole() == Role.SELLER) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN,
                    "Nur die Stand-Leitung kann stornieren – bitte den Verkauf zur Prüfung markieren.");
        }
        if (!sale.isFlaggedForReview()) {
            throw new ResponseStatusException(HttpStatus.CONFLICT,
                    "Dieser Verkauf muss zuerst zur Prüfung markiert werden, bevor er storniert werden kann.");
        }

        // undo the balance effect: give back what was taken (balance + debt), take back what was gifted (credit)
        Participant participant = sale.getParticipant();
        if (participant != null) {
            BigDecimal restore = sale.getPaidFromBalance()
                    .add(sale.getDebtAmount())
                    .subtract(sale.getExtraCredited());
            participant.setBalance(participant.getBalance().add(restore));
            participantRepository.save(participant);
        }

        sale.setStatus(Sale.Status.REVERSED);
        sale.setReversedBy(currentUser);
        sale.setReversedAt(LocalDateTime.now());
        // the concern has been dealt with by the reversal itself, so it leaves the queue.
        // A reversal is only ever done by a lead (checked above), so it's self-reviewed.
        sale.setFlaggedForReview(false);
        sale.setReviewedBy(currentUser);
        sale.setReviewedAt(LocalDateTime.now());
        Sale saved = saleRepository.save(sale);

        auditService.record(currentUser, sale.getCamp(), EntityType.SALE, sale.getId(),
                saleLabel(sale), Action.REVERSED, "Storniert über " + sale.getTotalAmount() + " €");
        return SaleResponse.from(saved, BigDecimal.ZERO);
    }

    // Mark a sale for the lead to look at, WITHOUT undoing it. Until now the only way
    // to raise a concern was to reverse the sale, which is destructive: a seller who
    // was merely unsure had to undo a possibly-correct sale to get attention.
    @Transactional
    public SaleResponse flagForReview(User currentUser, Long saleId) {
        Sale sale = saleRepository.findById(saleId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Not found"));
        campAccess.checkSameCamp(currentUser, sale.getCamp());

        if (sale.isFlaggedForReview()) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "This sale is already flagged for review");
        }
        sale.setFlaggedForReview(true);
        sale.setFlaggedBy(currentUser);   // so the lead can ask the right person about it
        sale.setFlaggedAt(LocalDateTime.now());
        Sale saved = saleRepository.save(sale);

        auditService.record(currentUser, sale.getCamp(), EntityType.SALE, sale.getId(),
                saleLabel(sale), Action.FLAGGED, "Zur Prüfung markiert");
        return SaleResponse.from(saved, BigDecimal.ZERO);
    }

    // the lead ticks off a flagged sale after checking it was legitimate
    @Transactional
    public SaleResponse approveReversal(User currentUser, Long saleId) {
        Sale sale = saleRepository.findById(saleId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Not found"));
        campAccess.checkSameCamp(currentUser, sale.getCamp());

        if (!sale.isFlaggedForReview()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "This sale is not flagged for review");
        }
        sale.setFlaggedForReview(false);
        sale.setReviewedBy(currentUser);
        sale.setReviewedAt(LocalDateTime.now());
        Sale reviewed = saleRepository.save(sale);

        auditService.record(currentUser, sale.getCamp(), EntityType.SALE, sale.getId(),
                saleLabel(sale), Action.REVIEWED, "Geprüft und freigegeben");
        return SaleResponse.from(reviewed, BigDecimal.ZERO);
    }

    /** What to call a sale in the log - the buyer, or the fact that it was a cash sale. */
    private static String saleLabel(Sale sale) {
        return sale.getParticipant() != null
                ? sale.getParticipant().getFirstName() + " " + sale.getParticipant().getLastName()
                : "Barverkauf";
    }

    public List<SaleResponse> list(User currentUser, Long campId, Long participantId) {
        List<Sale> sales;
        if (participantId != null) {
            // camp check happens through the participant
            Participant p = participantRepository.findById(participantId)
                    .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Not found"));
            campAccess.checkSameCamp(currentUser, p.getCamp());
            sales = saleRepository.findByParticipantIdOrderByCreatedAtDesc(participantId);
        } else {
            Camp camp = campAccess.resolveCamp(currentUser, campId);
            sales = saleRepository.findByCampIdOrderByCreatedAtDesc(camp.getId());
        }
        return sales.stream().map(s -> SaleResponse.from(s, BigDecimal.ZERO)).toList();
    }

    public List<SaleResponse> flagged(User currentUser, Long campId) {
        Camp camp = campAccess.resolveCamp(currentUser, campId);
        return saleRepository.findByCampIdAndFlaggedForReviewTrueOrderByCreatedAtDesc(camp.getId())
                .stream().map(s -> SaleResponse.from(s, BigDecimal.ZERO)).toList();
    }
}
