package com.pos.backend.dto;

import com.pos.backend.entity.CashMovement;
import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.NotNull;

import java.math.BigDecimal;
import java.time.LocalDateTime;

public class CashDtos {

    public record CashMovementRequest(
            @NotNull CashMovement.Type type,
            @NotNull @DecimalMin(value = "0.00", inclusive = false) BigDecimal amount,
            String note
    ) {}

    public record CashMovementResponse(
            Long id, String type, BigDecimal amount, String note, String byName, LocalDateTime createdAt
    ) {
        public static CashMovementResponse from(CashMovement m) {
            return new CashMovementResponse(m.getId(), m.getType().name(), m.getAmount(), m.getNote(),
                    m.getCreatedBy().getFirstName() + " " + m.getCreatedBy().getLastName(), m.getCreatedAt());
        }
    }

    /** The Kassenbuch: where the expected cash comes from, and the movement history. */
    public record CashBook(
            BigDecimal startingCash,   // Startgeld / float
            BigDecimal cashSales,      // Bar eingenommen aus Verkäufen
            BigDecimal specialsCash,   // Bar eingenommen aus Vorbestell-Ausgaben (Aktionen)
            BigDecimal preordersCash,  // Bar eingenommen aus Selbstbedienungs-Vorbestellungen
            BigDecimal deposits,       // Nachlagen
            BigDecimal withdrawals,    // Entnahmen
            BigDecimal expected,       // Soll = start + sales + specials + preorders + deposits - withdrawals
            java.util.List<CashMovementResponse> movements
    ) {}

    // Soll-Ist-Abgleich: what the box should hold vs. what was actually counted.
    public record ReconcileRequest(@NotNull @DecimalMin("0.00") BigDecimal countedCash) {}

    public record Reconciliation(BigDecimal expected, BigDecimal counted, BigDecimal difference) {}
}
