package com.pos.backend.service;

import com.pos.backend.dto.ReviewDtos.Cancellation;
import com.pos.backend.dto.ReviewDtos.Kind;
import com.pos.backend.entity.*;
import com.pos.backend.entity.AuditLog.Action;
import com.pos.backend.entity.AuditLog.EntityType;
import com.pos.backend.repository.PreOrderRepository;
import com.pos.backend.repository.SaleRepository;
import com.pos.backend.repository.SpecialOrderRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;

// The cancellation-review queue. Surfaces every cancellation across sales, Aktionen and
// Vorbestellungen so leadership sees that nothing was undone unnoticed, and lets a lead
// acknowledge the ones a seller or participant performed.
@Service
@RequiredArgsConstructor
public class ReviewService {

    private final SaleRepository saleRepository;
    private final SpecialOrderRepository specialOrderRepository;
    private final PreOrderRepository preOrderRepository;
    private final CampAccess campAccess;
    private final AuditService auditService;

    public List<Cancellation> cancellations(User currentUser, Long campId) {
        Camp camp = campAccess.resolveCamp(currentUser, campId);
        Long id = camp.getId();

        List<Cancellation> all = new ArrayList<>();
        saleRepository.findByCampIdAndStatusOrderByReversedAtDesc(id, Sale.Status.REVERSED)
                .forEach(s -> all.add(Cancellation.ofSale(s)));
        specialOrderRepository.findCancelledByCamp(id)
                .forEach(o -> all.add(Cancellation.ofSpecial(o)));
        preOrderRepository.findCancelledByCamp(id)
                .forEach(o -> all.add(Cancellation.ofPreOrder(o)));

        // pending first (the actionable ones), then newest cancellation first within each group
        all.sort(Comparator.comparing(Cancellation::pending).reversed()
                .thenComparing(Cancellation::cancelledAt,
                        Comparator.nullsLast(Comparator.reverseOrder())));
        return all;
    }

    /** A lead ticks off a cancellation as checked. Camp-scoped; idempotent-ish (re-marking
     *  just refreshes the reviewer). */
    @Transactional
    public Cancellation markReviewed(User currentUser, Kind kind, Long id) {
        LocalDateTime now = LocalDateTime.now();
        switch (kind) {
            case SALE -> {
                Sale s = saleRepository.findById(id)
                        .orElseThrow(() -> notFound());
                campAccess.checkSameCamp(currentUser, s.getCamp());
                mustBe(s.getStatus() == Sale.Status.REVERSED, "Nur stornierte Verkäufe können geprüft werden");
                s.setReviewedBy(currentUser);
                s.setReviewedAt(now);
                Sale saved = saleRepository.save(s);
                audit(currentUser, saved.getCamp(), EntityType.SALE, saved.getId());
                return Cancellation.ofSale(saved);
            }
            case SPECIAL -> {
                SpecialOrder o = specialOrderRepository.findById(id)
                        .orElseThrow(() -> notFound());
                campAccess.checkSameCamp(currentUser, o.getSpecial().getCamp());
                mustBe(o.getStatus() == SpecialOrder.Status.CANCELLED, "Nur stornierte Vorbestellungen können geprüft werden");
                o.setReviewedBy(currentUser);
                o.setReviewedAt(now);
                SpecialOrder saved = specialOrderRepository.save(o);
                audit(currentUser, saved.getSpecial().getCamp(), EntityType.SPECIAL_ORDER, saved.getId());
                return Cancellation.ofSpecial(saved);
            }
            case PREORDER -> {
                PreOrder o = preOrderRepository.findById(id)
                        .orElseThrow(() -> notFound());
                campAccess.checkSameCamp(currentUser, o.getCamp());
                mustBe(o.getStatus() == PreOrder.Status.CANCELLED, "Nur stornierte Vorbestellungen können geprüft werden");
                o.setReviewedBy(currentUser);
                o.setReviewedAt(now);
                PreOrder saved = preOrderRepository.save(o);
                audit(currentUser, saved.getCamp(), EntityType.PRE_ORDER, saved.getId());
                return Cancellation.ofPreOrder(saved);
            }
            default -> throw notFound();
        }
    }

    private void audit(User actor, Camp camp, EntityType type, Long id) {
        auditService.record(actor, camp, type, id, "Stornierung", Action.REVIEWED, "Stornierung geprüft");
    }

    private static ResponseStatusException notFound() {
        return new ResponseStatusException(HttpStatus.NOT_FOUND, "Nicht gefunden");
    }

    private static void mustBe(boolean condition, String message) {
        if (!condition) throw new ResponseStatusException(HttpStatus.CONFLICT, message);
    }
}
