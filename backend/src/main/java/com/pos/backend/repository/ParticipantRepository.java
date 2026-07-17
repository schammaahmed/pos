package com.pos.backend.repository;

import com.pos.backend.entity.Participant;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;

public interface ParticipantRepository extends JpaRepository<Participant, Long> {

    List<Participant> findByCampIdOrderByLastNameAscFirstNameAsc(Long campId);

    // Method names get unreadable for real searches, so this one is explicit JPQL:
    // case-insensitive match anywhere in "firstname lastname"
    @Query("""
            SELECT p FROM Participant p
            WHERE p.camp.id = :campId
              AND LOWER(CONCAT(p.firstName, ' ', p.lastName)) LIKE LOWER(CONCAT('%', :search, '%'))
            ORDER BY p.lastName, p.firstName
            """)
    List<Participant> searchInCamp(@Param("campId") Long campId, @Param("search") String search);
}
