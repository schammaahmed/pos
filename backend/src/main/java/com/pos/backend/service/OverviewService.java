package com.pos.backend.service;

import com.pos.backend.dto.OverviewDtos.CampSummary;
import com.pos.backend.dto.OverviewDtos.Overview;
import com.pos.backend.entity.Camp;
import com.pos.backend.entity.User;
import com.pos.backend.repository.CampRepository;
import com.pos.backend.repository.ParticipantRepository;
import com.pos.backend.repository.SaleRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import java.math.BigDecimal;
import java.util.List;

// Builds the super-admin overview. Reuses the existing per-camp queries and the cash
// box maths (CashService) rather than duplicating any logic - camps are few, so one
// pass per camp is fine.
@Service
@RequiredArgsConstructor
public class OverviewService {

    private final CampRepository campRepository;
    private final SaleRepository saleRepository;
    private final ParticipantRepository participantRepository;
    private final CashService cashService;

    public Overview build(User currentUser) {
        List<CampSummary> summaries = campRepository.findAll().stream()
                .map(camp -> summarise(currentUser, camp))
                .toList();

        BigDecimal totalRevenue = summaries.stream().map(CampSummary::revenue).reduce(BigDecimal.ZERO, BigDecimal::add);
        long totalParticipants = summaries.stream().mapToLong(CampSummary::participantCount).sum();
        BigDecimal totalDebt = summaries.stream().map(CampSummary::openDebt).reduce(BigDecimal.ZERO, BigDecimal::add);
        BigDecimal totalCash = summaries.stream().map(CampSummary::cashExpected).reduce(BigDecimal.ZERO, BigDecimal::add);

        return new Overview(summaries, totalRevenue, totalParticipants, totalDebt, totalCash);
    }

    private CampSummary summarise(User currentUser, Camp camp) {
        return new CampSummary(
                camp.getId(),
                camp.getName(),
                camp.getCity(),
                camp.getStatus().name(),
                saleRepository.sumRevenueByCamp(camp.getId()),
                participantRepository.countByCampId(camp.getId()),
                participantRepository.sumOpenDebtByCamp(camp.getId()),
                cashService.cashBook(currentUser, camp.getId()).expected());
    }
}
