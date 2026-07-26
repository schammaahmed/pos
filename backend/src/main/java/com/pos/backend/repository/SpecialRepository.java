package com.pos.backend.repository;

import com.pos.backend.entity.Special;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface SpecialRepository extends JpaRepository<Special, Long> {

    // Newest first so the admin sees what they just created at the top.
    List<Special> findByCampIdOrderByCollectionDateAscIdDesc(Long campId);
}
