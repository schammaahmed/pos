package com.pos.backend.repository;

import com.pos.backend.entity.AuditLog;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;

public interface AuditLogRepository extends JpaRepository<AuditLog, Long> {

    // One flexible query instead of a method per filter combination: any of the
    // parameters may be null, in which case it simply doesn't narrow the result.
    @Query("""
            SELECT a FROM AuditLog a
            WHERE (:campId IS NULL OR a.camp.id = :campId)
              AND (:actorId IS NULL OR a.actor.id = :actorId)
              AND (:entityType IS NULL OR a.entityType = :entityType)
              AND (:entityId IS NULL OR a.entityId = :entityId)
            ORDER BY a.createdAt DESC
            """)
    List<AuditLog> search(@Param("campId") Long campId,
                          @Param("actorId") Long actorId,
                          @Param("entityType") AuditLog.EntityType entityType,
                          @Param("entityId") Long entityId,
                          Pageable pageable);
}
