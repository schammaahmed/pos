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

    // The Ausgabe view: RESERVED orders for a given collection day in one camp, so the
    // seller can hand out today's specials and mark them as collected.
    @Query("""
            SELECT o FROM SpecialOrder o
            WHERE o.special.camp.id = :campId
              AND o.special.collectionDate = :day
              AND o.status = com.pos.backend.entity.SpecialOrder$Status.RESERVED
            ORDER BY o.special.name, o.participant.lastName, o.participant.firstName
            """)
    List<SpecialOrder> findReservedForCollectionDay(@Param("campId") Long campId,
                                                    @Param("day") LocalDate day);

    // Cash taken in via Special collections - the cash box has to count this too, otherwise
    // Soll-Ist reconciliation is short by whatever the Specials brought in that day.
    @Query("""
            SELECT COALESCE(SUM(o.paidCash), 0) FROM SpecialOrder o
            WHERE o.special.camp.id = :campId
              AND o.status = com.pos.backend.entity.SpecialOrder$Status.COLLECTED
            """)
    BigDecimal sumCollectedCashByCamp(@Param("campId") Long campId);
}
