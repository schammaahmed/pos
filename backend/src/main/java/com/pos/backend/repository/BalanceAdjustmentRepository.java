package com.pos.backend.repository;

import com.pos.backend.entity.BalanceAdjustment;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface BalanceAdjustmentRepository extends JpaRepository<BalanceAdjustment, Long> {

    List<BalanceAdjustment> findByParticipantIdOrderByCreatedAtDesc(Long participantId);
}
