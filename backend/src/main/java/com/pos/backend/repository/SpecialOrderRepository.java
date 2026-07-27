package com.pos.backend.repository;

import com.pos.backend.entity.SpecialOrder;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;

public interface SpecialOrderRepository extends JpaRepository<SpecialOrder, Long> {

    List<SpecialOrder> findBySpecialIdOrderByCreatedAtAsc(Long specialId);

    // Soft-cap check: how many quantity units are RESERVED or already COLLECTED for a special.
    // Cancelled orders don't count against the cap.
    @Query("""
            SELECT COALESCE(SUM(o.quantity), 0) FROM SpecialOrder o
            WHERE o.special.id = :specialId
              AND o.status IN (com.pos.backend.entity.SpecialOrder$Status.RESERVED,
                               com.pos.backend.entity.SpecialOrder$Status.COLLECTED)
            """)
    int sumTakenForSpecial(@Param("specialId") Long specialId);

    // The Ausgabe view: everything due on a given day in one camp - both RESERVED (to
    // hand out) and COLLECTED (already handed out), so the seller sees the day's full
    // picture. Cancelled orders are dropped: they were actively dismissed and would
    // just be noise. RESERVED sorts before COLLECTED so open work is on top.
    @Query("""
            SELECT o FROM SpecialOrder o
            WHERE o.special.camp.id = :campId
              AND o.special.collectionDate = :day
              AND o.status <> com.pos.backend.entity.SpecialOrder$Status.CANCELLED
            ORDER BY o.status ASC, o.special.name, o.participant.lastName, o.participant.firstName
            """)
    List<SpecialOrder> findForCollectionDay(@Param("campId") Long campId,
                                            @Param("day") LocalDate day);

    // Cash taken in via Special collections - the cash box has to count this too, otherwise
    // Soll-Ist reconciliation is short by whatever the Specials brought in that day.
    @Query("""
            SELECT COALESCE(SUM(o.paidCash), 0) FROM SpecialOrder o
            WHERE o.special.camp.id = :campId
              AND o.status = com.pos.backend.entity.SpecialOrder$Status.COLLECTED
            """)
    BigDecimal sumCollectedCashByCamp(@Param("campId") Long campId);

    // Collected Aktionen for the unified sales-log ledger (actual money movements).
    @Query("""
            SELECT o FROM SpecialOrder o
            WHERE o.special.camp.id = :campId
              AND o.status = com.pos.backend.entity.SpecialOrder$Status.COLLECTED
            """)
    List<SpecialOrder> findCollectedByCamp(@Param("campId") Long campId);

    // Total collected Aktionen revenue (price * qty), so the overview's Umsatz matches the ledger.
    @Query("""
            SELECT COALESCE(SUM(o.special.price * o.quantity), 0) FROM SpecialOrder o
            WHERE o.special.camp.id = :campId
              AND o.status = com.pos.backend.entity.SpecialOrder$Status.COLLECTED
            """)
    BigDecimal sumCollectedRevenueByCamp(@Param("campId") Long campId);
}
