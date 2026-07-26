package com.pos.backend.repository;

import com.pos.backend.entity.Camp;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;

public interface CampRepository extends JpaRepository<Camp, Long> {

    // Used to resolve the self-serve QR token on a public (unauthenticated) request.
    Optional<Camp> findBySelfServeToken(String token);
}
