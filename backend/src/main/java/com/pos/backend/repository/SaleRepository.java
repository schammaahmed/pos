package com.pos.backend.repository;

import com.pos.backend.entity.Sale;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.math.BigDecimal;
import java.util.List;

public interface SaleRepository extends JpaRepository<Sale, Long> {

    List<Sale> findByCampIdOrderByCreatedAtDesc(Long campId);

    List<Sale> findByParticipantIdOrderByCreatedAtDesc(Long participantId);

    // guards user deletion: someone with sales must be deactivated, not removed
    boolean existsBySellerId(Long sellerId);

    // The lead's review queue. Ordered by createdAt, NOT reversedAt: a sale can now be
    // flagged without being reversed, and those have no reversedAt at all (null sorts oddly).
    List<Sale> findByCampIdAndFlaggedForReviewTrueOrderByCreatedAtDesc(Long campId);

    // Cash physically taken in, for the cash-box maths. Only COMPLETED sales - a
    // reversed sale's cash was handed back, so it must not count.
    @Query("""
            SELECT COALESCE(SUM(s.paidCash), 0) FROM Sale s
            WHERE s.camp.id = :campId AND s.status = com.pos.backend.entity.Sale$Status.COMPLETED
            """)
    BigDecimal sumPaidCashByCamp(@Param("campId") Long campId);
}
