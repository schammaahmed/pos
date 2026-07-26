package com.pos.backend.dto;

import com.pos.backend.entity.PreOrder;
import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.time.LocalTime;

// All DTOs for the self-serve / staff PreOrder flows, grouped for tidiness.
public class PreOrderDtos {

    // -------------------- Public (unauthenticated) ---------------------

    /** Camp basics + open-hours state, for the self-serve landing before identify. */
    public record PublicCampInfo(
            Long campId,
            String name,
            String city,
            boolean active,               // camp status == ACTIVE
            LocalTime openFrom,           // null = always open
            LocalTime openUntil,          // null = always open
            boolean acceptingOrders       // window + status combined, computed server-side
    ) {}

    /** Name-typing identify. Never returns the roster - only accept/reject/redirect. */
    public record IdentifyRequest(
            @NotNull String selfServeToken,
            @NotNull @Size(min = 1) String firstName,
            @NotNull @Size(min = 1) String lastName
    ) {}

    public record IdentifyResponse(
            String status,                // "OK" / "NOT_FOUND" / "AMBIGUOUS"
            String token,                 // participant JWT, only on OK
            Long participantId,
            String firstName,
            String lastName
    ) {
        public static IdentifyResponse ok(String jwt, long id, String fn, String ln) {
            return new IdentifyResponse("OK", jwt, id, fn, ln);
        }
        public static IdentifyResponse notFound() {
            return new IdentifyResponse("NOT_FOUND", null, null, null, null);
        }
        public static IdentifyResponse ambiguous() {
            return new IdentifyResponse("AMBIGUOUS", null, null, null, null);
        }
    }

    // -------------------- Self (participant JWT) ---------------------

    public record SelfMe(
            Long participantId,
            String firstName,
            String lastName,
            BigDecimal balance,
            Long campId,
            String campName
    ) {}

    /** A product the participant can pre-order (thin view; no admin-only fields). */
    public record SelfProduct(Long id, String name, BigDecimal price, String category) {}

    public record PlaceOrderRequest(
            @NotNull Long productId,
            @Min(1) int quantity,
            LocalDateTime requestedFor,   // optional: "for later today"
            @Size(max = 300) String note  // optional: "ohne Zwiebel"
    ) {}

    // -------------------- Shared (participant + staff) ---------------------

    /** One pre-order row - used by both the participant's "meine Bestellungen" and the staff queue. */
    public record PreOrderResponse(
            Long id,
            Long productId,
            String productName,
            BigDecimal unitPrice,
            int quantity,
            BigDecimal totalAmount,
            LocalDateTime requestedFor,
            String note,
            String status,                // NEW / IN_PROGRESS / READY / PICKED_UP / CANCELLED
            LocalDateTime createdAt,
            LocalDateTime startedAt,
            String startedByName,
            LocalDateTime readyAt,
            String readyByName,
            LocalDateTime pickedUpAt,
            String pickedUpByName,
            // staff-facing extras (safe to expose to the participant too - it's their own row):
            Long participantId,
            String participantName,
            // payment split, populated on PICKED_UP
            BigDecimal paidCash,
            BigDecimal paidFromBalance,
            BigDecimal debtAmount
    ) {
        public static PreOrderResponse from(PreOrder o) {
            return new PreOrderResponse(
                    o.getId(),
                    o.getProduct() != null ? o.getProduct().getId() : null,
                    o.getProductName(),
                    o.getUnitPrice(),
                    o.getQuantity(),
                    o.totalAmount(),
                    o.getRequestedFor(),
                    o.getNote(),
                    o.getStatus().name(),
                    o.getCreatedAt(),
                    o.getStartedAt(), nameOrNull(o.getStartedBy()),
                    o.getReadyAt(), nameOrNull(o.getReadyBy()),
                    o.getPickedUpAt(), nameOrNull(o.getPickedUpBy()),
                    o.getParticipant().getId(),
                    o.getParticipant().getFirstName() + " " + o.getParticipant().getLastName(),
                    o.getPaidCash(), o.getPaidFromBalance(), o.getDebtAmount());
        }

        private static String nameOrNull(com.pos.backend.entity.User u) {
            return u == null ? null : u.getFirstName() + " " + u.getLastName();
        }
    }

    // -------------------- Staff (SUPER_ADMIN / CAMP_LEAD / SELLER) ---------------------

    /** Payment fields at pickup. Same shape as SpecialOrder collect / Sale checkout. */
    public record PickupRequest(
            @NotNull @DecimalMin("0.00") BigDecimal cashGiven,
            boolean useBalance,
            boolean keepChangeAsCredit
    ) {}

    /** Admin-side camp config for self-serve: window + a way to rotate the QR token. */
    public record SelfServeConfigRequest(
            LocalTime openFrom,     // both null = always open
            LocalTime openUntil,
            boolean rotateToken     // if true, generate a fresh selfServeToken
    ) {}

    public record SelfServeConfigResponse(
            String selfServeToken,  // the one embedded in the QR
            LocalTime openFrom,
            LocalTime openUntil
    ) {}
}
