package com.pos.backend.dto;

import java.math.BigDecimal;
import java.util.List;

// The super-admin's cross-camp overview: one summary per camp plus a totals row,
// so the whole operation can be monitored from a single screen.
public class OverviewDtos {

    public record CampSummary(
            Long campId,
            String name,
            String city,
            String status,
            BigDecimal revenue,        // total COMPLETED takings
            long participantCount,
            BigDecimal openDebt,       // money participants still owe
            BigDecimal cashExpected    // what the cash box should hold
    ) {}

    public record Overview(
            List<CampSummary> camps,
            BigDecimal totalRevenue,
            long totalParticipants,
            BigDecimal totalOpenDebt,
            BigDecimal totalCashExpected
    ) {}
}
