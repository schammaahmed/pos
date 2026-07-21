package com.pos.backend.service;

import com.pos.backend.dto.ParticipantDtos.AdjustmentResponse;
import com.pos.backend.dto.ParticipantDtos.CreateParticipantRequest;
import com.pos.backend.dto.ParticipantDtos.DepositRequest;
import com.pos.backend.dto.ParticipantDtos.ParticipantResponse;
import com.pos.backend.entity.AuditLog.Action;
import com.pos.backend.entity.AuditLog.EntityType;
import com.pos.backend.entity.BalanceAdjustment;
import com.pos.backend.entity.Camp;
import com.pos.backend.entity.Participant;
import com.pos.backend.entity.User;
import com.pos.backend.repository.BalanceAdjustmentRepository;
import com.pos.backend.repository.ParticipantRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import java.math.BigDecimal;
import java.util.List;

@Service
@RequiredArgsConstructor
public class ParticipantService {

    private final ParticipantRepository participantRepository;
    private final BalanceAdjustmentRepository adjustmentRepository;
    private final CampAccess campAccess;
    private final AuditService auditService;

    public List<ParticipantResponse> list(User currentUser, Long campId, String search) {
        Camp camp = campAccess.resolveCamp(currentUser, campId);
        List<Participant> participants = (search == null || search.isBlank())
                ? participantRepository.findByCampIdOrderByLastNameAscFirstNameAsc(camp.getId())
                : participantRepository.searchInCamp(camp.getId(), search.trim());
        return participants.stream().map(ParticipantResponse::from).toList();
    }

    public ParticipantResponse get(User currentUser, Long id) {
        return ParticipantResponse.from(loadChecked(currentUser, id));
    }

    public ParticipantResponse create(User currentUser, Long campId, CreateParticipantRequest request) {
        Camp camp = campAccess.resolveCamp(currentUser, campId);
        campAccess.checkCampActive(camp);

        Participant p = new Participant();
        p.setFirstName(request.firstName().trim());
        p.setLastName(request.lastName().trim());
        p.setPhone(request.phone());
        p.setGender(request.gender());
        p.setCamp(camp);
        p = participantRepository.save(p);

        auditService.record(currentUser, camp, EntityType.PARTICIPANT, p.getId(),
                p.getFirstName() + " " + p.getLastName(), Action.CREATED);

        // starting money is recorded as a DEPOSIT, not silently written into balance -
        // this way the audit trail is complete from minute one
        if (request.initialBalance() != null && request.initialBalance().signum() > 0) {
            applyDeposit(currentUser, p, request.initialBalance());
        }
        return ParticipantResponse.from(p);
    }

    // @Transactional: the balance update and the audit row are saved together or not at all
    @Transactional
    public ParticipantResponse deposit(User currentUser, Long id, DepositRequest request) {
        Participant p = loadChecked(currentUser, id);
        campAccess.checkCampActive(p.getCamp());
        applyDeposit(currentUser, p, request.amount());
        return ParticipantResponse.from(p);
    }

    // The "collect open debts at the end of camp" button: balance goes from e.g. -7.50 to 0,
    // and WHO collected the cash is recorded.
    @Transactional
    public ParticipantResponse settleDebt(User currentUser, Long id) {
        Participant p = loadChecked(currentUser, id);

        if (p.getBalance().signum() >= 0) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Participant has no debt to settle");
        }

        BigDecimal debt = p.getBalance().negate(); // -7.50 -> settlement amount +7.50

        BalanceAdjustment adjustment = new BalanceAdjustment();
        adjustment.setParticipant(p);
        adjustment.setType(BalanceAdjustment.Type.DEBT_SETTLEMENT);
        adjustment.setAmount(debt);
        adjustment.setCreatedBy(currentUser);
        adjustmentRepository.save(adjustment);

        p.setBalance(BigDecimal.ZERO);
        Participant saved = participantRepository.save(p);

        auditService.record(currentUser, p.getCamp(), EntityType.PARTICIPANT, p.getId(),
                p.getFirstName() + " " + p.getLastName(), Action.DEBT_SETTLED,
                "Schulden " + debt + " € beglichen; Saldo → 0,00 €");
        return ParticipantResponse.from(saved);
    }

    public List<AdjustmentResponse> history(User currentUser, Long id) {
        Participant p = loadChecked(currentUser, id); // camp check happens here
        return adjustmentRepository.findByParticipantIdOrderByCreatedAtDesc(p.getId())
                .stream().map(AdjustmentResponse::from).toList();
    }

    private void applyDeposit(User currentUser, Participant p, BigDecimal amount) {
        BalanceAdjustment adjustment = new BalanceAdjustment();
        adjustment.setParticipant(p);
        adjustment.setType(BalanceAdjustment.Type.DEPOSIT);
        adjustment.setAmount(amount);
        adjustment.setCreatedBy(currentUser);
        adjustmentRepository.save(adjustment);

        BigDecimal before = p.getBalance();
        p.setBalance(p.getBalance().add(amount));
        participantRepository.save(p);

        auditService.record(currentUser, p.getCamp(), EntityType.PARTICIPANT, p.getId(),
                p.getFirstName() + " " + p.getLastName(), Action.DEPOSIT,
                "Einzahlung " + amount + " €; Saldo: " + before + " € → " + p.getBalance() + " €");
    }

    // every by-ID access funnels through this: load + camp isolation check
    private Participant loadChecked(User currentUser, Long id) {
        Participant p = participantRepository.findById(id)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Not found"));
        campAccess.checkSameCamp(currentUser, p.getCamp());
        return p;
    }
}
