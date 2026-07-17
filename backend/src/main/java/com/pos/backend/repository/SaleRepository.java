package com.pos.backend.repository;

import com.pos.backend.entity.Sale;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface SaleRepository extends JpaRepository<Sale, Long> {

    List<Sale> findByCampIdOrderByCreatedAtDesc(Long campId);

    List<Sale> findByParticipantIdOrderByCreatedAtDesc(Long participantId);

    // the lead's review queue: reversals done by plain sellers, waiting for a second pair of eyes
    List<Sale> findByCampIdAndFlaggedForReviewTrueOrderByReversedAtDesc(Long campId);
}
