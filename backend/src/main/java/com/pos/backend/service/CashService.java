package com.pos.backend.service;

import com.pos.backend.dto.CashDtos.*;
import com.pos.backend.entity.*;
import com.pos.backend.entity.AuditLog.Action;
import com.pos.backend.entity.AuditLog.EntityType;
import com.pos.backend.repository.CashMovementRepository;
import com.pos.backend.repository.SaleRepository;
import com.pos.backend.repository.SpecialOrderRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.util.List;

// The camp cash box. Expected cash is derived, never stored:
//   Startgeld + Barverkäufe + Nachlagen − Entnahmen
// so it is always correct and can't drift from the underlying data.
@Service
@RequiredArgsConstructor
public class CashService {

    private final CashMovementRepository cashMovementRepository;
    private final SaleRepository saleRepository;
    private final SpecialOrderRepository specialOrderRepository;
    private final CampAccess campAccess;
    private final AuditService auditService;

    public CashBook cashBook(User currentUser, Long campId) {
        Camp camp = campAccess.resolveCamp(currentUser, campId);

        List<CashMovement> movements = cashMovementRepository.findByCampIdOrderByCreatedAtDesc(camp.getId());
        BigDecimal deposits = sum(movements, CashMovement.Type.DEPOSIT);
        BigDecimal withdrawals = sum(movements, CashMovement.Type.WITHDRAWAL);

        // only the cash actually taken over the counter counts - not balance/debt sales,
        // and reversed sales are excluded via the repository query
        BigDecimal cashSales = orZero(saleRepository.sumPaidCashByCamp(camp.getId()));
        // Specials go through their own row (not Sale), so their cash lives in the SpecialOrder
        // table and must be summed in separately, otherwise the reconciliation is short
        BigDecimal specialsCash = orZero(specialOrderRepository.sumCollectedCashByCamp(camp.getId()));

        BigDecimal start = orZero(camp.getStartingCash());
        BigDecimal expected = start.add(cashSales).add(specialsCash).add(deposits).subtract(withdrawals);

        return new CashBook(start, cashSales, specialsCash, deposits, withdrawals, expected,
                movements.stream().map(CashMovementResponse::from).toList());
    }

    @Transactional
    public CashBook addMovement(User currentUser, Long campId, CashMovementRequest request) {
        Camp camp = campAccess.resolveCamp(currentUser, campId);

        CashMovement m = new CashMovement();
        m.setCamp(camp);
        m.setType(request.type());
        m.setAmount(request.amount());
        m.setNote(request.note());
        m.setCreatedBy(currentUser);
        cashMovementRepository.save(m);

        String label = request.type() == CashMovement.Type.DEPOSIT ? "Nachlegen" : "Entnahme";
        auditService.record(currentUser, camp, EntityType.CAMP, camp.getId(), camp.getName(),
                request.type() == CashMovement.Type.DEPOSIT ? Action.DEPOSIT : Action.UPDATED,
                label + " " + request.amount() + " €" + (request.note() != null ? " (" + request.note() + ")" : ""));

        return cashBook(currentUser, campId);
    }

    /** Compares the counted cash against what the box should hold. Read-only - just maths. */
    public Reconciliation reconcile(User currentUser, Long campId, ReconcileRequest request) {
        BigDecimal expected = cashBook(currentUser, campId).expected();
        BigDecimal counted = request.countedCash();
        return new Reconciliation(expected, counted, counted.subtract(expected));
    }

    private static BigDecimal sum(List<CashMovement> movements, CashMovement.Type type) {
        return movements.stream()
                .filter(m -> m.getType() == type)
                .map(CashMovement::getAmount)
                .reduce(BigDecimal.ZERO, BigDecimal::add);
    }

    private static BigDecimal orZero(BigDecimal v) {
        return v == null ? BigDecimal.ZERO : v;
    }
}
