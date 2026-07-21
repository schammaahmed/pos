package com.pos.backend.dto;

import com.pos.backend.entity.Camp;
import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;

import java.math.BigDecimal;
import java.time.LocalDate;

// Several small related records in one file to keep the dto package tidy.
public class CampDtos {

    public record CreateCampRequest(
            @NotBlank String name,
            @NotBlank String city,
            @NotNull LocalDate startDate,
            @NotNull LocalDate endDate,
            // the cash the box starts with; optional, defaults to 0
            @DecimalMin("0.00") BigDecimal startingCash
    ) {}

    public record CampResponse(
            Long id,
            String name,
            String city,
            LocalDate startDate,
            LocalDate endDate,
            String status,
            BigDecimal startingCash
    ) {
        // one place that converts entity -> DTO, used by every endpoint that returns a camp
        public static CampResponse from(Camp camp) {
            return new CampResponse(camp.getId(), camp.getName(), camp.getCity(),
                    camp.getStartDate(), camp.getEndDate(), camp.getStatus().name(), camp.getStartingCash());
        }
    }
}
