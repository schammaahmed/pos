package com.pos.backend.repository;

import com.pos.backend.entity.PreOrder;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.math.BigDecimal;
import java.util.List;

public interface PreOrderRepository extends JpaRepository<PreOrder, Long> {

    // Staff queue for a camp: new orders on top (sorted by requestedFor - by createdAt as
    // fallback when requestedFor is null), so the earliest pickup is at the top.
    @Query("""
            SELECT o FROM PreOrder o
            WHERE o.camp.id = :campId
            ORDER BY o.status ASC,
                     COALESCE(o.requestedFor, o.createdAt) ASC
            """)
    List<PreOrder> findByCampOrdered(@Param("campId") Long campId);

    // The participant's own orders, newest first - shown on their self-serve page.
    List<PreOrder> findByParticipantIdOrderByCreatedAtDesc(Long participantId);

    // Cash from picked-up pre-orders, folded into the Kassenbuch expected-cash figure.
    @Query("""
            SELECT COALESCE(SUM(o.paidCash), 0) FROM PreOrder o
            WHERE o.camp.id = :campId
              AND o.status = com.pos.backend.entity.PreOrder$Status.PICKED_UP
            """)
    BigDecimal sumPickedUpCashByCamp(@Param("campId") Long campId);

    // Picked-up pre-orders for the unified sales-log ledger (actual money movements).
    @Query("""
            SELECT o FROM PreOrder o
            WHERE o.camp.id = :campId
              AND o.status = com.pos.backend.entity.PreOrder$Status.PICKED_UP
            """)
    List<PreOrder> findPickedUpByCamp(@Param("campId") Long campId);
}
