package com.pos.backend.dto;

import com.pos.backend.entity.Sale;
import com.pos.backend.entity.SaleItem;
import jakarta.validation.Valid;
import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.NotNull;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.List;

public class SaleDtos {

    /** These relations are optional, so guard before touching them. */
    private static String fullName(com.pos.backend.entity.User user) {
        return user == null ? null : user.getFirstName() + " " + user.getLastName();
    }

    public record CheckoutItem(
            @NotNull Long productId,
            @Min(1) int quantity,
            List<Long> optionIds       // chosen add-ons (must belong to the product); null = none
    ) {}

    public record CheckoutRequest(
            Long campId,               // only needed by SUPER_ADMIN
            Long participantId,        // null = anonymous cash sale (e.g. a visitor)
            @NotEmpty @Valid List<CheckoutItem> items,
            @NotNull @DecimalMin("0.00") BigDecimal cashGiven,
            boolean useBalance,        // pay (partly) from the participant's balance
            boolean keepChangeAsCredit // "keep the rest" -> overpaid cash becomes balance
    ) {}

    public record SaleItemResponse(String productName, String optionsLabel, int quantity,
                                   BigDecimal unitPrice, BigDecimal lineTotal) {
        public static SaleItemResponse from(SaleItem item) {
            return new SaleItemResponse(item.getProduct().getName(), item.getOptionsLabel(), item.getQuantity(),
                    item.getUnitPrice(), item.getUnitPrice().multiply(BigDecimal.valueOf(item.getQuantity())));
        }
    }

    public record SaleResponse(
            Long id,
            Long participantId,
            String participantName,    // null for anonymous sales
            Long sellerId,             // lets the UI show everything one team member did
            String sellerName,
            List<SaleItemResponse> items,
            BigDecimal totalAmount,
            BigDecimal paidCash,
            BigDecimal paidFromBalance,
            BigDecimal debtAmount,
            BigDecimal extraCredited,
            BigDecimal changeToReturn, // computed for the seller's convenience, not stored
            BigDecimal newBalance,     // participant's balance after this sale (null for anonymous)
            String status,
            boolean flaggedForReview,
            String flaggedByName,      // who raised the concern
            LocalDateTime flaggedAt,
            String reversedByName,     // who undid it
            LocalDateTime reversedAt,
            LocalDateTime createdAt
    ) {
        public static SaleResponse from(Sale sale, BigDecimal changeToReturn) {
            return new SaleResponse(
                    sale.getId(),
                    sale.getParticipant() != null ? sale.getParticipant().getId() : null,
                    sale.getParticipant() != null
                            ? sale.getParticipant().getFirstName() + " " + sale.getParticipant().getLastName() : null,
                    sale.getSeller().getId(),
                    sale.getSeller().getFirstName() + " " + sale.getSeller().getLastName(),
                    sale.getItems().stream().map(SaleItemResponse::from).toList(),
                    sale.getTotalAmount(),
                    sale.getPaidCash(),
                    sale.getPaidFromBalance(),
                    sale.getDebtAmount(),
                    sale.getExtraCredited(),
                    changeToReturn,
                    sale.getParticipant() != null ? sale.getParticipant().getBalance() : null,
                    sale.getStatus().name(),
                    sale.isFlaggedForReview(),
                    fullName(sale.getFlaggedBy()),
                    sale.getFlaggedAt(),
                    fullName(sale.getReversedBy()),
                    sale.getReversedAt(),
                    sale.getCreatedAt()
            );
        }
    }
}
