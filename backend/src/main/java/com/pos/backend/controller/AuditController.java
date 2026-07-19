package com.pos.backend.controller;

import com.pos.backend.entity.AuditLog;
import com.pos.backend.entity.User;
import com.pos.backend.repository.AuditLogRepository;
import com.pos.backend.service.CampAccess;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.PageRequest;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.time.LocalDateTime;
import java.util.List;

// The audit trail. Admin-only: it exposes who did what across the whole camp,
// which is exactly the kind of thing a seller should not be browsing.
@RestController
@RequestMapping("/api/audit")
@RequiredArgsConstructor
@PreAuthorize("hasAnyRole('SUPER_ADMIN', 'CAMP_ADMIN')")
public class AuditController {

    private final AuditLogRepository auditLogRepository;
    private final CampAccess campAccess;

    public record AuditEntry(
            Long id,
            String actorName,
            Long actorId,
            String entityType,
            Long entityId,
            String entityLabel,
            String action,
            String changes,
            LocalDateTime createdAt
    ) {
        static AuditEntry from(AuditLog log) {
            return new AuditEntry(log.getId(), log.getActorName(),
                    log.getActor() != null ? log.getActor().getId() : null,
                    log.getEntityType().name(), log.getEntityId(), log.getEntityLabel(),
                    log.getAction().name(), log.getChanges(), log.getCreatedAt());
        }
    }

    /** Any filter may be omitted: /api/audit?actorId=3 is "everything Nisa did". */
    @GetMapping
    public List<AuditEntry> list(@AuthenticationPrincipal User currentUser,
                                 @RequestParam(required = false) Long campId,
                                 @RequestParam(required = false) Long actorId,
                                 @RequestParam(required = false) AuditLog.EntityType entityType,
                                 @RequestParam(required = false) Long entityId,
                                 @RequestParam(defaultValue = "200") int limit) {
        // resolveCamp enforces that a camp admin can only ever see their own camp
        Long scopedCampId = campAccess.resolveCamp(currentUser, campId).getId();

        return auditLogRepository
                .search(scopedCampId, actorId, entityType, entityId, PageRequest.of(0, Math.min(limit, 500)))
                .stream().map(AuditEntry::from).toList();
    }
}
