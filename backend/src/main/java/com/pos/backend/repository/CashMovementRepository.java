package com.pos.backend.repository;

import com.pos.backend.entity.CashMovement;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface CashMovementRepository extends JpaRepository<CashMovement, Long> {

    List<CashMovement> findByCampIdOrderByCreatedAtDesc(Long campId);
}
