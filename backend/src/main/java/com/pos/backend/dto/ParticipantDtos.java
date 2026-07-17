package com.pos.backend.dto;

import com.pos.backend.entity.BalanceAdjustment;
import com.pos.backend.entity.Participant;
import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;

import java.math.BigDecimal;
import java.time.LocalDateTime;

public class ParticipantDtos {

    public record CreateParticipantRequest(
            @NotBlank String firstName,
            @NotBlank String lastName,
            String phone,             // optional
            BigDecimal initialBalance // optional: money handed over at check-in
    ) {}

    public record ParticipantResponse(
            Long id,
            String firstName,
            String lastName,
            String phone,
            BigDecimal balance,
            boolean inDebt // convenience for the frontend (balance < 0)
    ) {
        public static ParticipantResponse from(Participant p) {
            return new ParticipantResponse(p.getId(), p.getFirstName(), p.getLastName(),
                    p.getPhone(), p.getBalance(), p.getBalance().signum() < 0);
        }
    }

    public record DepositRequest(
            // @DecimalMin with inclusive=false means "> 0.00" - depositing 0 or negative makes no sense
            @NotNull @DecimalMin(value = "0.00", inclusive = false) BigDecimal amount
    ) {}

    public record AdjustmentResponse(
            Long id,
            String type,
            BigDecimal amount,
            String performedBy,
            LocalDateTime createdAt
    ) {
        public static AdjustmentResponse from(BalanceAdjustment a) {
            return new AdjustmentResponse(a.getId(), a.getType().name(), a.getAmount(),
                    a.getCreatedBy().getFirstName() + " " + a.getCreatedBy().getLastName(),
                    a.getCreatedAt());
        }
    }
}
