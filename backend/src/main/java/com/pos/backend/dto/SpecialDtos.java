package com.pos.backend.dto;

import com.pos.backend.entity.Special;
import com.pos.backend.entity.SpecialOrder;
import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;

// Small related records grouped in one file to keep the dto package tidy.
public class SpecialDtos {

    // ------------------------------------------------------------- Special

    public record SpecialRequest(
            @NotBlank String name,
            String description,
            @NotNull @DecimalMin(value = "0.00") BigDecimal price,
            LocalDateTime orderableUntil,      // optional: no deadline
            @NotNull LocalDate collectionDate,
            @Min(1) Integer capacity           // optional: no cap
    ) {}

    public record SpecialResponse(
            Long id,
            String name,
            String description,
            BigDecimal price,
            LocalDateTime orderableUntil,
            LocalDate collectionDate,
            Integer capacity,
            int taken,               // how many units reserved+collected so far (for the soft cap)
            String status
    ) {
        public static SpecialResponse from(Special s, int taken) {
            return new SpecialResponse(s.getId(), s.getName(), s.getDescription(), s.getPrice(),
                    s.getOrderableUntil(), s.getCollectionDate(), s.getCapacity(),
                    taken, s.getStatus().name());
        }
    }

    // -------------------------------------------------------- SpecialOrder

    public record ReserveRequest(
            @NotNull Long specialId,
            @NotNull Long participantId,
            @Min(1) int quantity
    ) {}

    public record CollectRequest(
            @NotNull @DecimalMin("0.00") BigDecimal cashGiven,
            boolean useBalance,
            boolean keepChangeAsCredit
    ) {}

    public record SpecialOrderResponse(
            Long id,
            Long specialId,
            String specialName,
            LocalDate collectionDate,
            BigDecimal price,
            Long participantId,
            String participantName,
            int quantity,
            BigDecimal totalAmount,          // price * quantity
            String status,
            BigDecimal paidCash,             // filled once COLLECTED
            BigDecimal paidFromBalance,
            BigDecimal debtAmount,
            LocalDateTime createdAt,
            String createdByName,
            LocalDateTime collectedAt,
            String collectedByName
    ) {
        public static SpecialOrderResponse from(SpecialOrder o) {
            BigDecimal total = o.getSpecial().getPrice().multiply(BigDecimal.valueOf(o.getQuantity()));
            return new SpecialOrderResponse(
                    o.getId(),
                    o.getSpecial().getId(),
                    o.getSpecial().getName(),
                    o.getSpecial().getCollectionDate(),
                    o.getSpecial().getPrice(),
                    o.getParticipant().getId(),
                    o.getParticipant().getFirstName() + " " + o.getParticipant().getLastName(),
                    o.getQuantity(),
                    total,
                    o.getStatus().name(),
                    o.getPaidCash(), o.getPaidFromBalance(), o.getDebtAmount(),
                    o.getCreatedAt(),
                    o.getCreatedBy() != null
                            ? o.getCreatedBy().getFirstName() + " " + o.getCreatedBy().getLastName()
                            : "System",
                    o.getCollectedAt(),
                    o.getCollectedBy() != null
                            ? o.getCollectedBy().getFirstName() + " " + o.getCollectedBy().getLastName()
                            : null);
        }
    }
}
