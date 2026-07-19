package com.pos.backend.repository;

import com.pos.backend.entity.Sale;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface SaleRepository extends JpaRepository<Sale, Long> {

    List<Sale> findByCampIdOrderByCreatedAtDesc(Long campId);

    List<Sale> findByParticipantIdOrderByCreatedAtDesc(Long participantId);

    // guards user deletion: someone with sales must be deactivated, not removed
    boolean existsBySellerId(Long sellerId);

    // The lead's review queue. Ordered by createdAt, NOT reversedAt: a sale can now be
    // flagged without being reversed, and those have no reversedAt at all (null sorts oddly).
    List<Sale> findByCampIdAndFlaggedForReviewTrueOrderByCreatedAtDesc(Long campId);
}
