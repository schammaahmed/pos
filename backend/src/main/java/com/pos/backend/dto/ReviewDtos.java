package com.pos.backend.dto;

import com.pos.backend.entity.PreOrder;
import com.pos.backend.entity.Sale;
import com.pos.backend.entity.SpecialOrder;
import com.pos.backend.entity.User;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.stream.Collectors;

// The cancellation-review queue: every cancellation across all three streams so leadership
// can see that nothing was undone unnoticed. Ones done by a lead show as already reviewed;
// ones done by a seller or a participant are pending until acknowledged.
public class ReviewDtos {

    public enum Kind { SALE, SPECIAL, PREORDER }

    public record Cancellation(
            Kind kind,
            Long id,
            String description,
            String participantName,     // null = anonymous Barverkauf (sales only)
            BigDecimal totalAmount,
            String cancelledByName,     // null = the participant self-cancelled
            LocalDateTime cancelledAt,
            boolean pending,            // true = still needs a lead's acknowledgement
            String reviewedByName,
            LocalDateTime reviewedAt
    ) {
        public static Cancellation ofSale(Sale s) {
            String items = s.getItems().stream()
                    .map(i -> i.getQuantity() + "× " + i.getProduct().getName())
                    .collect(Collectors.joining(", "));
            return new Cancellation(Kind.SALE, s.getId(), items,
                    s.getParticipant() != null
                            ? s.getParticipant().getFirstName() + " " + s.getParticipant().getLastName() : null,
                    s.getTotalAmount(),
                    name(s.getReversedBy()), s.getReversedAt(),
                    s.getReviewedAt() == null, name(s.getReviewedBy()), s.getReviewedAt());
        }

        public static Cancellation ofSpecial(SpecialOrder o) {
            return new Cancellation(Kind.SPECIAL, o.getId(),
                    o.getQuantity() + "× " + o.getSpecial().getName() + " (Aktion)",
                    o.getParticipant().getFirstName() + " " + o.getParticipant().getLastName(),
                    o.getSpecial().getPrice().multiply(BigDecimal.valueOf(o.getQuantity())),
                    name(o.getCancelledBy()), o.getCancelledAt(),
                    o.getReviewedAt() == null, name(o.getReviewedBy()), o.getReviewedAt());
        }

        public static Cancellation ofPreOrder(PreOrder o) {
            return new Cancellation(Kind.PREORDER, o.getId(),
                    o.getQuantity() + "× " + o.getProductName() + " (Vorbestellung)",
                    o.getParticipant().getFirstName() + " " + o.getParticipant().getLastName(),
                    o.totalAmount(),
                    name(o.getCancelledBy()), o.getCancelledAt(),
                    o.getReviewedAt() == null, name(o.getReviewedBy()), o.getReviewedAt());
        }

        private static String name(User u) {
            return u == null ? null : u.getFirstName() + " " + u.getLastName();
        }
    }
}
