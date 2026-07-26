package com.pos.backend.service;

import com.pos.backend.dto.SpecialDtos.*;
import com.pos.backend.entity.*;
import com.pos.backend.entity.AuditLog.Action;
import com.pos.backend.entity.AuditLog.EntityType;
import com.pos.backend.repository.ParticipantRepository;
import com.pos.backend.repository.SpecialOrderRepository;
import com.pos.backend.repository.SpecialRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.dao.OptimisticLockingFailureException;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.transaction.support.TransactionTemplate;
import org.springframework.web.server.ResponseStatusException;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.List;

// Specials (Aktionen): planned offers that participants reserve in advance and pay for
// at collection. See Special and SpecialOrder entities for the domain model.
@Service
@RequiredArgsConstructor
public class SpecialService {

    private final SpecialRepository specialRepository;
    private final SpecialOrderRepository orderRepository;
    private final ParticipantRepository participantRepository;
    private final CampAccess campAccess;
    private final AuditService auditService;
    private final TransactionTemplate transactionTemplate;

    // ------------------------------------------------------------------- Special CRUD

    public List<SpecialResponse> list(User currentUser, Long campId) {
        Camp camp = campAccess.resolveCamp(currentUser, campId);
        return specialRepository.findByCampIdOrderByCollectionDateAscIdDesc(camp.getId()).stream()
                .map(s -> SpecialResponse.from(s, orderRepository.sumTakenForSpecial(s.getId())))
                .toList();
    }

    public SpecialResponse create(User currentUser, Long campId, SpecialRequest request) {
        Camp camp = campAccess.resolveCamp(currentUser, campId);
        campAccess.checkCampActive(camp);

        Special s = new Special();
        apply(s, request);
        s.setCamp(camp);
        Special saved = specialRepository.save(s);

        auditService.record(currentUser, camp, EntityType.SPECIAL, saved.getId(), saved.getName(),
                Action.CREATED, "Preis: " + saved.getPrice() + " €; Ausgabe: " + saved.getCollectionDate());
        return SpecialResponse.from(saved, 0);
    }

    public SpecialResponse update(User currentUser, Long id, SpecialRequest request) {
        Special s = loadChecked(currentUser, id);

        var diff = new AuditService.Diff()
                .add("Name", s.getName(), request.name() == null ? null : request.name().trim())
                .money("Preis", s.getPrice(), request.price())
                .add("Ausgabe", s.getCollectionDate(), request.collectionDate())
                .add("Bestellschluss", s.getOrderableUntil(), request.orderableUntil())
                .add("Kapazität", s.getCapacity(), request.capacity());

        apply(s, request);
        Special saved = specialRepository.save(s);

        if (!diff.isEmpty()) {
            auditService.record(currentUser, saved.getCamp(), EntityType.SPECIAL, saved.getId(),
                    saved.getName(), Action.UPDATED, diff.text());
        }
        return SpecialResponse.from(saved, orderRepository.sumTakenForSpecial(saved.getId()));
    }

    public SpecialResponse close(User currentUser, Long id) {
        Special s = loadChecked(currentUser, id);
        s.setStatus(Special.Status.CLOSED);
        Special saved = specialRepository.save(s);
        auditService.record(currentUser, saved.getCamp(), EntityType.SPECIAL, saved.getId(),
                saved.getName(), Action.CLOSED);
        return SpecialResponse.from(saved, orderRepository.sumTakenForSpecial(saved.getId()));
    }

    // --------------------------------------------------------------- Reservations

    public SpecialOrderResponse reserve(User currentUser, ReserveRequest request) {
        Special s = specialRepository.findById(request.specialId())
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Aktion nicht gefunden"));
        campAccess.checkSameCamp(currentUser, s.getCamp());
        campAccess.checkCampActive(s.getCamp());

        if (s.getStatus() != Special.Status.ACTIVE) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "Diese Aktion ist geschlossen");
        }
        if (s.getOrderableUntil() != null && LocalDateTime.now().isAfter(s.getOrderableUntil())) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "Bestellfrist ist abgelaufen");
        }

        Participant participant = participantRepository.findById(request.participantId())
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Teilnehmer nicht gefunden"));
        campAccess.checkSameCamp(currentUser, participant.getCamp());

        SpecialOrder o = new SpecialOrder();
        o.setSpecial(s);
        o.setParticipant(participant);
        o.setQuantity(request.quantity());
        o.setCreatedBy(currentUser);
        SpecialOrder saved = orderRepository.save(o);

        auditService.record(currentUser, s.getCamp(), EntityType.SPECIAL_ORDER, saved.getId(),
                s.getName() + " für " + participant.getFirstName() + " " + participant.getLastName(),
                Action.RESERVED, "Menge: " + saved.getQuantity());
        return SpecialOrderResponse.from(saved);
    }

    public SpecialOrderResponse cancel(User currentUser, Long orderId) {
        SpecialOrder o = loadOrderChecked(currentUser, orderId);
        if (o.getStatus() != SpecialOrder.Status.RESERVED) {
            throw new ResponseStatusException(HttpStatus.CONFLICT,
                    "Nur reservierte Vorbestellungen können storniert werden");
        }
        o.setStatus(SpecialOrder.Status.CANCELLED);
        o.setCancelledAt(LocalDateTime.now());
        SpecialOrder saved = orderRepository.save(o);
        auditService.record(currentUser, o.getSpecial().getCamp(), EntityType.SPECIAL_ORDER, saved.getId(),
                o.getSpecial().getName() + " für "
                        + o.getParticipant().getFirstName() + " " + o.getParticipant().getLastName(),
                Action.CANCELLED, null);
        return SpecialOrderResponse.from(saved);
    }

    // The Ausgabe (collection) list for a specific day - defaults to today. Includes
    // both open (RESERVED) and already-collected orders so the seller can see the day's
    // full picture instead of a mysteriously-empty screen after handing out the last one.
    public List<SpecialOrderResponse> collectionList(User currentUser, Long campId, LocalDate day) {
        Camp camp = campAccess.resolveCamp(currentUser, campId);
        LocalDate when = day != null ? day : LocalDate.now();
        return orderRepository.findForCollectionDay(camp.getId(), when).stream()
                .map(SpecialOrderResponse::from).toList();
    }

    public List<SpecialOrderResponse> ordersFor(User currentUser, Long specialId) {
        Special s = loadChecked(currentUser, specialId);
        return orderRepository.findBySpecialIdOrderByCreatedAtAsc(s.getId()).stream()
                .map(SpecialOrderResponse::from).toList();
    }

    // Collection: payment happens here, same PaymentSplit as a normal sale. Runs under
    // the same optimistic-lock retry as SaleService - two sellers can't double-charge one kid.
    public SpecialOrderResponse collect(User currentUser, Long orderId, CollectRequest request) {
        for (int attempt = 1; ; attempt++) {
            try {
                return transactionTemplate.execute(status -> doCollect(currentUser, orderId, request));
            } catch (OptimisticLockingFailureException e) {
                if (attempt >= 3) {
                    throw new ResponseStatusException(HttpStatus.CONFLICT,
                            "Der Teilnehmer wurde gleichzeitig belastet – bitte erneut versuchen");
                }
            }
        }
    }

    private SpecialOrderResponse doCollect(User currentUser, Long orderId, CollectRequest request) {
        SpecialOrder o = loadOrderChecked(currentUser, orderId);
        if (o.getStatus() != SpecialOrder.Status.RESERVED) {
            throw new ResponseStatusException(HttpStatus.CONFLICT,
                    "Diese Vorbestellung ist bereits abgeholt oder storniert");
        }
        campAccess.checkCampActive(o.getSpecial().getCamp());

        BigDecimal total = o.getSpecial().getPrice().multiply(BigDecimal.valueOf(o.getQuantity()));
        PaymentSplit split = PaymentSplit.compute(total, request.cashGiven(),
                o.getParticipant().getBalance(), request.useBalance(), request.keepChangeAsCredit());

        o.setPaidCash(split.paidCash());
        o.setPaidFromBalance(split.paidFromBalance());
        o.setDebtAmount(split.debtAmount());
        o.setExtraCredited(split.extraCredited());
        o.setStatus(SpecialOrder.Status.COLLECTED);
        o.setCollectedAt(LocalDateTime.now());
        o.setCollectedBy(currentUser);

        // move the participant's balance under the same optimistic-lock protection as a sale
        Participant participant = o.getParticipant();
        participant.setBalance(participant.getBalance().add(split.balanceDelta()));
        participantRepository.save(participant);

        SpecialOrder saved = orderRepository.save(o);

        auditService.record(currentUser, o.getSpecial().getCamp(), EntityType.SPECIAL_ORDER, saved.getId(),
                o.getSpecial().getName() + " für "
                        + participant.getFirstName() + " " + participant.getLastName(),
                Action.COLLECTED,
                "Menge: " + o.getQuantity()
                        + "; bezahlt: " + split.paidCash() + " € bar"
                        + ", " + split.paidFromBalance() + " € Guthaben"
                        + ", " + split.debtAmount() + " € Schulden");
        return SpecialOrderResponse.from(saved);
    }

    // ------------------------------------------------------------------- helpers

    private void apply(Special s, SpecialRequest request) {
        s.setName(request.name().trim());
        s.setDescription(request.description());
        s.setPrice(request.price());
        s.setOrderableUntil(request.orderableUntil());
        s.setCollectionDate(request.collectionDate());
        s.setCapacity(request.capacity());
    }

    private Special loadChecked(User currentUser, Long id) {
        Special s = specialRepository.findById(id)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Nicht gefunden"));
        campAccess.checkSameCamp(currentUser, s.getCamp());
        return s;
    }

    private SpecialOrder loadOrderChecked(User currentUser, Long id) {
        SpecialOrder o = orderRepository.findById(id)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Nicht gefunden"));
        campAccess.checkSameCamp(currentUser, o.getSpecial().getCamp());
        return o;
    }
}
