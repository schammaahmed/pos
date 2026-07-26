package com.pos.backend.service;

import com.pos.backend.dto.PreOrderDtos.*;
import com.pos.backend.entity.*;
import com.pos.backend.entity.AuditLog.Action;
import com.pos.backend.entity.AuditLog.EntityType;
import com.pos.backend.repository.CampRepository;
import com.pos.backend.repository.ParticipantRepository;
import com.pos.backend.repository.PreOrderRepository;
import com.pos.backend.repository.ProductRepository;
import com.pos.backend.security.JwtService;
import lombok.RequiredArgsConstructor;
import org.springframework.dao.OptimisticLockingFailureException;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.transaction.support.TransactionTemplate;
import org.springframework.web.server.ResponseStatusException;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.time.LocalTime;
import java.util.List;
import java.util.UUID;

// Self-serve pre-orders: participants scan a stand QR, identify themselves by name, place
// pre-orders on regular Products, and pick them up later (payment happens then). See
// PreOrder + Camp.selfServeToken for the domain model.
@Service
@RequiredArgsConstructor
public class PreOrderService {

    // Participant JWT life: long enough that a kid identifies once at the start of camp
    // and stays logged in until it ends. 30 days is generous and forgiving.
    private static final long PARTICIPANT_TOKEN_TTL_MS = 30L * 24 * 60 * 60 * 1000;

    private final PreOrderRepository preOrderRepository;
    private final ParticipantRepository participantRepository;
    private final ProductRepository productRepository;
    private final CampRepository campRepository;
    private final CampAccess campAccess;
    private final AuditService auditService;
    private final JwtService jwtService;
    private final TransactionTemplate transactionTemplate;

    // -------------------- Public: camp lookup + identify ----------------------

    /** Resolves the QR-embedded token to a public camp summary. */
    public PublicCampInfo lookupCamp(String selfServeToken) {
        Camp camp = campRepository.findBySelfServeToken(selfServeToken)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Unbekannter QR-Code"));
        boolean active = camp.getStatus() == CampStatus.ACTIVE;
        boolean inWindow = withinWindow(camp, LocalTime.now());
        return new PublicCampInfo(camp.getId(), camp.getName(), camp.getCity(), active,
                camp.getSelfServeOpenFrom(), camp.getSelfServeOpenUntil(), active && inWindow);
    }

    /**
     * Exact-match name lookup within the camp identified by the QR token. Returns
     * OK + JWT / NOT_FOUND / AMBIGUOUS - and never leaks the roster. AMBIGUOUS means
     * two participants share the exact same name; those cases are directed to a seller
     * rather than building a disambiguation UI for a 1% edge case.
     */
    public IdentifyResponse identify(IdentifyRequest request) {
        Camp camp = campRepository.findBySelfServeToken(request.selfServeToken())
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Unbekannter QR-Code"));
        if (camp.getStatus() != CampStatus.ACTIVE) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "Dieses Camp ist bereits abgeschlossen");
        }
        List<Participant> matches = participantRepository.findByCampIdAndNameExact(
                camp.getId(), request.firstName().trim(), request.lastName().trim());

        if (matches.isEmpty()) return IdentifyResponse.notFound();
        if (matches.size() > 1) return IdentifyResponse.ambiguous();

        Participant p = matches.getFirst();
        String jwt = jwtService.generateParticipantToken(p.getId(), camp.getId(), PARTICIPANT_TOKEN_TTL_MS);
        return IdentifyResponse.ok(jwt, p.getId(), p.getFirstName(), p.getLastName());
    }

    // -------------------- Self (the participant's own view) -------------------

    public SelfMe me(Participant currentParticipant) {
        Camp camp = currentParticipant.getCamp();
        return new SelfMe(currentParticipant.getId(),
                currentParticipant.getFirstName(), currentParticipant.getLastName(),
                currentParticipant.getBalance(), camp.getId(), camp.getName());
    }

    public List<SelfProduct> menu(Participant currentParticipant) {
        // active only + camp-scoped; snapshot lookups already exist for this order pair
        return productRepository
                .findByCampIdAndActiveTrueOrderByCategoryAscNameAsc(currentParticipant.getCamp().getId())
                .stream()
                .map(p -> new SelfProduct(p.getId(), p.getName(), p.getPrice(), p.getCategory()))
                .toList();
    }

    public List<PreOrderResponse> myOrders(Participant currentParticipant) {
        return preOrderRepository.findByParticipantIdOrderByCreatedAtDesc(currentParticipant.getId())
                .stream().map(PreOrderResponse::from).toList();
    }

    public PreOrderResponse place(Participant currentParticipant, PlaceOrderRequest request) {
        Camp camp = currentParticipant.getCamp();
        if (camp.getStatus() != CampStatus.ACTIVE) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "Dieses Camp ist bereits abgeschlossen");
        }
        if (!withinWindow(camp, LocalTime.now())) {
            throw new ResponseStatusException(HttpStatus.CONFLICT,
                    "Bestellungen sind zurzeit geschlossen. Bitte innerhalb der Öffnungszeiten wieder versuchen.");
        }

        Product product = productRepository.findById(request.productId())
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Produkt nicht gefunden"));
        if (!product.getCamp().getId().equals(camp.getId()) || !product.isActive()) {
            // Same 404 wording either way - never confirm a foreign-camp product exists.
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Produkt nicht gefunden");
        }

        PreOrder o = new PreOrder();
        o.setCamp(camp);
        o.setParticipant(currentParticipant);
        o.setProduct(product);
        o.setProductName(product.getName());   // snapshot: survives future renames/reprices
        o.setUnitPrice(product.getPrice());
        o.setQuantity(request.quantity());
        o.setRequestedFor(request.requestedFor());
        o.setNote(request.note());
        PreOrder saved = preOrderRepository.save(o);

        auditService.record(null /* system actor: the participant, not a staff User */,
                camp, EntityType.PRE_ORDER, saved.getId(),
                currentParticipant.getFirstName() + " " + currentParticipant.getLastName()
                        + " → " + product.getName(),
                Action.CREATED,
                "Menge: " + saved.getQuantity()
                        + (saved.getRequestedFor() != null ? "; für " + saved.getRequestedFor() : "")
                        + (saved.getNote() != null ? "; Notiz: " + saved.getNote() : ""));
        return PreOrderResponse.from(saved);
    }

    /** Participants can cancel THEIR OWN order while it's still NEW - safety net if they change their mind. */
    public PreOrderResponse cancelMine(Participant currentParticipant, Long orderId) {
        PreOrder o = preOrderRepository.findById(orderId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Nicht gefunden"));
        if (!o.getParticipant().getId().equals(currentParticipant.getId())) {
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Nicht gefunden");
        }
        if (o.getStatus() != PreOrder.Status.NEW) {
            throw new ResponseStatusException(HttpStatus.CONFLICT,
                    "Nur offene Bestellungen können storniert werden");
        }
        return doCancel(null, o);
    }

    // -------------------- Staff: queue, pickup, cancel -----------------------

    public List<PreOrderResponse> staffQueue(User currentUser, Long campId) {
        Camp camp = campAccess.resolveCamp(currentUser, campId);
        return preOrderRepository.findByCampOrdered(camp.getId()).stream()
                .map(PreOrderResponse::from).toList();
    }

    /** Staff cancel - e.g. product ran out. */
    public PreOrderResponse staffCancel(User currentUser, Long orderId) {
        PreOrder o = loadCheckedStaff(currentUser, orderId);
        if (o.getStatus() != PreOrder.Status.NEW) {
            throw new ResponseStatusException(HttpStatus.CONFLICT,
                    "Nur offene Bestellungen können storniert werden");
        }
        return doCancel(currentUser, o);
    }

    /**
     * Mark as picked up + settle payment. Wraps a retry around the optimistic lock on
     * Participant.balance so two sellers can't accidentally double-charge the same kid.
     */
    public PreOrderResponse pickup(User currentUser, Long orderId, PickupRequest request) {
        for (int attempt = 1; ; attempt++) {
            try {
                return transactionTemplate.execute(status -> doPickup(currentUser, orderId, request));
            } catch (OptimisticLockingFailureException e) {
                if (attempt >= 3) {
                    throw new ResponseStatusException(HttpStatus.CONFLICT,
                            "Der Teilnehmer wurde gleichzeitig belastet – bitte erneut versuchen");
                }
            }
        }
    }

    private PreOrderResponse doPickup(User currentUser, Long orderId, PickupRequest request) {
        PreOrder o = loadCheckedStaff(currentUser, orderId);
        if (o.getStatus() != PreOrder.Status.NEW) {
            throw new ResponseStatusException(HttpStatus.CONFLICT,
                    "Diese Bestellung ist bereits abgeholt oder storniert");
        }
        campAccess.checkCampActive(o.getCamp());

        BigDecimal total = o.totalAmount();
        PaymentSplit split = PaymentSplit.compute(total, request.cashGiven(),
                o.getParticipant().getBalance(), request.useBalance(), request.keepChangeAsCredit());

        o.setPaidCash(split.paidCash());
        o.setPaidFromBalance(split.paidFromBalance());
        o.setDebtAmount(split.debtAmount());
        o.setExtraCredited(split.extraCredited());
        o.setStatus(PreOrder.Status.PICKED_UP);
        o.setPickedUpAt(LocalDateTime.now());
        o.setPickedUpBy(currentUser);

        // move the balance under the same optimistic-lock protection as a sale
        Participant participant = o.getParticipant();
        participant.setBalance(participant.getBalance().add(split.balanceDelta()));
        participantRepository.save(participant);

        PreOrder saved = preOrderRepository.save(o);

        auditService.record(currentUser, o.getCamp(), EntityType.PRE_ORDER, saved.getId(),
                participant.getFirstName() + " " + participant.getLastName() + " → " + o.getProductName(),
                Action.PICKED_UP,
                "Menge: " + o.getQuantity()
                        + "; bezahlt: " + split.paidCash() + " € bar"
                        + ", " + split.paidFromBalance() + " € Guthaben"
                        + ", " + split.debtAmount() + " € Schulden");
        return PreOrderResponse.from(saved);
    }

    // -------------------- Admin: QR + windows --------------------------------

    public SelfServeConfigResponse selfServeConfig(User currentUser, Long campId) {
        Camp camp = campAccess.resolveCamp(currentUser, campId);
        // Lazily mint a token on first read so leads don't have to click "generate" separately
        if (camp.getSelfServeToken() == null) {
            camp.setSelfServeToken(newToken());
            camp = campRepository.save(camp);
        }
        return new SelfServeConfigResponse(camp.getSelfServeToken(),
                camp.getSelfServeOpenFrom(), camp.getSelfServeOpenUntil());
    }

    public SelfServeConfigResponse updateSelfServeConfig(User currentUser, Long campId,
                                                         SelfServeConfigRequest request) {
        Camp camp = campAccess.resolveCamp(currentUser, campId);
        campAccess.checkCampActive(camp);
        camp.setSelfServeOpenFrom(request.openFrom());
        camp.setSelfServeOpenUntil(request.openUntil());
        if (request.rotateToken() || camp.getSelfServeToken() == null) {
            camp.setSelfServeToken(newToken());
        }
        Camp saved = campRepository.save(camp);
        auditService.record(currentUser, saved, EntityType.CAMP, saved.getId(), saved.getName(),
                Action.UPDATED,
                "Self-Serve Öffnungszeit: "
                        + (saved.getSelfServeOpenFrom() != null ? saved.getSelfServeOpenFrom() : "immer")
                        + " – "
                        + (saved.getSelfServeOpenUntil() != null ? saved.getSelfServeOpenUntil() : "immer")
                        + (request.rotateToken() ? "; neuer QR-Token" : ""));
        return new SelfServeConfigResponse(saved.getSelfServeToken(),
                saved.getSelfServeOpenFrom(), saved.getSelfServeOpenUntil());
    }

    // -------------------- helpers --------------------------------------------

    private PreOrderResponse doCancel(User staffActor, PreOrder o) {
        o.setStatus(PreOrder.Status.CANCELLED);
        o.setCancelledAt(LocalDateTime.now());
        PreOrder saved = preOrderRepository.save(o);
        auditService.record(staffActor, o.getCamp(), EntityType.PRE_ORDER, saved.getId(),
                o.getParticipant().getFirstName() + " " + o.getParticipant().getLastName()
                        + " → " + o.getProductName(),
                Action.CANCELLED, null);
        return PreOrderResponse.from(saved);
    }

    private PreOrder loadCheckedStaff(User currentUser, Long id) {
        PreOrder o = preOrderRepository.findById(id)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Nicht gefunden"));
        campAccess.checkSameCamp(currentUser, o.getCamp());
        return o;
    }

    // A window with both edges null (or where open == close) means "always open".
    // A window that spans midnight (open > close, e.g. 22:00 → 02:00) is supported.
    private static boolean withinWindow(Camp camp, LocalTime now) {
        LocalTime open = camp.getSelfServeOpenFrom();
        LocalTime close = camp.getSelfServeOpenUntil();
        if (open == null || close == null || open.equals(close)) return true;
        if (open.isBefore(close)) {
            return !now.isBefore(open) && now.isBefore(close);
        }
        // overnight window
        return !now.isBefore(open) || now.isBefore(close);
    }

    private static String newToken() {
        // short(ish), URL-safe, no ambiguous chars - a QR encodes fine but a kid could also
        // type this into a phone if the QR doesn't scan
        return UUID.randomUUID().toString().replace("-", "").substring(0, 16);
    }
}
