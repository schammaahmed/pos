package com.pos.backend.dto;

import com.pos.backend.entity.PreOrder;
import com.pos.backend.entity.Sale;
import com.pos.backend.entity.SpecialOrder;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.stream.Collectors;

// The sales log is a single money ledger across all three revenue streams: over-the-counter
// Sales, collected Aktionen (SpecialOrder), and picked-up self-serve Vorbestellungen
// (PreOrder). Each becomes a LedgerEntry so the log can show "every transaction, one list".
public class LedgerDtos {

    public enum Kind { SALE, SPECIAL, PREORDER }

    public record LedgerEntry(
            Kind kind,
            Long id,                    // id of the underlying row (for row-level actions)
            LocalDateTime timestamp,    // when the money actually moved
            String participantName,     // null = anonymous Barverkauf (sales only)
            String staffName,           // seller / who collected / who handed out
            String description,         // "2× Käsetoast, 1× Limo" etc.
            BigDecimal totalAmount,
            BigDecimal paidCash,
            BigDecimal paidFromBalance,
            BigDecimal debtAmount,
            String status,              // COMPLETED/REVERSED for sales; COLLECTED/PICKED_UP otherwise
            boolean flaggedForReview,   // sales only; false for the others
            boolean reversible,         // true only for a still-COMPLETED Sale (drives the UI actions)
            // sale-only traceability fields, null for the other kinds
            String flaggedByName,
            LocalDateTime flaggedAt,
            String reversedByName,
            LocalDateTime reversedAt
    ) {

        public static LedgerEntry ofSale(Sale s) {
            String items = s.getItems().stream()
                    .map(i -> i.getQuantity() + "× " + i.getProduct().getName()
                            + (i.getOptionsLabel() != null ? " (" + i.getOptionsLabel() + ")" : ""))
                    .collect(Collectors.joining(", "));
            boolean completed = s.getStatus() == Sale.Status.COMPLETED;
            return new LedgerEntry(
                    Kind.SALE, s.getId(), s.getCreatedAt(),
                    s.getParticipant() != null
                            ? s.getParticipant().getFirstName() + " " + s.getParticipant().getLastName() : null,
                    s.getSeller().getFirstName() + " " + s.getSeller().getLastName(),
                    items,
                    s.getTotalAmount(), s.getPaidCash(), s.getPaidFromBalance(), s.getDebtAmount(),
                    s.getStatus().name(), s.isFlaggedForReview(), completed,
                    name(s.getFlaggedBy()), s.getFlaggedAt(),
                    name(s.getReversedBy()), s.getReversedAt());
        }

        public static LedgerEntry ofSpecial(SpecialOrder o) {
            return new LedgerEntry(
                    Kind.SPECIAL, o.getId(), o.getCollectedAt(),
                    o.getParticipant().getFirstName() + " " + o.getParticipant().getLastName(),
                    name(o.getCollectedBy()),
                    o.getQuantity() + "× " + o.getSpecial().getName() + " (Aktion)",
                    o.getSpecial().getPrice().multiply(BigDecimal.valueOf(o.getQuantity())),
                    o.getPaidCash(), o.getPaidFromBalance(), o.getDebtAmount(),
                    o.getStatus().name(), false, false, null, null, null, null);
        }

        public static LedgerEntry ofPreOrder(PreOrder o) {
            return new LedgerEntry(
                    Kind.PREORDER, o.getId(), o.getPickedUpAt(),
                    o.getParticipant().getFirstName() + " " + o.getParticipant().getLastName(),
                    name(o.getPickedUpBy()),
                    o.getQuantity() + "× " + o.getProductName() + " (Vorbestellung)",
                    o.totalAmount(), o.getPaidCash(), o.getPaidFromBalance(), o.getDebtAmount(),
                    o.getStatus().name(), false, false, null, null, null, null);
        }

        private static String name(com.pos.backend.entity.User u) {
            return u == null ? null : u.getFirstName() + " " + u.getLastName();
        }
    }
}
