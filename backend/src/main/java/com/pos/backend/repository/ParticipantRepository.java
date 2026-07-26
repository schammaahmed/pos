package com.pos.backend.repository;

import com.pos.backend.entity.Participant;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.math.BigDecimal;
import java.util.List;
import java.util.Optional;

public interface ParticipantRepository extends JpaRepository<Participant, Long> {

    List<Participant> findByCampIdOrderByLastNameAscFirstNameAsc(Long campId);

    // Used by the JWT auth filter for participant tokens: we need to touch the camp on
    // the request thread, but the filter's tx is short-lived, so eager-fetch it up front.
    @Query("SELECT p FROM Participant p JOIN FETCH p.camp WHERE p.id = :id")
    Optional<Participant> findByIdWithCamp(@Param("id") Long id);

    long countByCampId(Long campId);

    // Exact case-insensitive match within one camp. Used by the self-serve identify flow -
    // returns 0/1/many; the caller decides what to do (issue token / reject / redirect to
    // staff). The query is deliberately NOT a LIKE-search: any partial matching would let
    // someone probe the roster by typing letters.
    @Query("""
            SELECT p FROM Participant p
            WHERE p.camp.id = :campId
              AND LOWER(p.firstName) = LOWER(:firstName)
              AND LOWER(p.lastName)  = LOWER(:lastName)
            """)
    List<Participant> findByCampIdAndNameExact(@Param("campId") Long campId,
                                               @Param("firstName") String firstName,
                                               @Param("lastName") String lastName);

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
