package com.pos.backend.repository;

import com.pos.backend.entity.Participant;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.math.BigDecimal;
import java.util.List;

public interface ParticipantRepository extends JpaRepository<Participant, Long> {

    List<Participant> findByCampIdOrderByLastNameAscFirstNameAsc(Long campId);

    long countByCampId(Long campId);

    // Open debt for the overview: balance is one signed field (negative = owes), so we
    // sum the negatives and flip the sign to get a positive "money owed" figure.
    @Query("""
            SELECT COALESCE(-SUM(p.balance), 0) FROM Participant p
            WHERE p.camp.id = :campId AND p.balance < 0
            """)
    BigDecimal sumOpenDebtByCamp(@Param("campId") Long campId);

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
