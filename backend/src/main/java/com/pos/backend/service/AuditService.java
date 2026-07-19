package com.pos.backend.service;

import com.pos.backend.entity.AuditLog;
import com.pos.backend.entity.AuditLog.Action;
import com.pos.backend.entity.AuditLog.EntityType;
import com.pos.backend.entity.Camp;
import com.pos.backend.entity.User;
import com.pos.backend.repository.AuditLogRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import java.math.BigDecimal;
import java.util.ArrayList;
import java.util.List;

// Writes the audit trail. Every service that changes something calls in here.
//
// Deliberately never throws: a failure to write the log must not roll back the
// thing the user actually did. A missing log line is bad; a lost sale is worse.
@Service
@RequiredArgsConstructor
public class AuditService {

    private final AuditLogRepository auditLogRepository;

    public void record(User actor, Camp camp, EntityType type, Long entityId,
                       String label, Action action, String changes) {
        try {
            AuditLog log = new AuditLog();
            log.setActor(actor);
            log.setActorName(actor == null ? "System" : actor.getFirstName() + " " + actor.getLastName());
            log.setCamp(camp);
            log.setEntityType(type);
            log.setEntityId(entityId);
            log.setEntityLabel(label == null ? "—" : label);
            log.setAction(action);
            log.setChanges(changes != null && changes.length() > 1000 ? changes.substring(0, 1000) : changes);
            auditLogRepository.save(log);
        } catch (RuntimeException ignored) {
            // never let logging break the operation being logged
        }
    }

    public void record(User actor, Camp camp, EntityType type, Long entityId, String label, Action action) {
        record(actor, camp, type, entityId, label, action, null);
    }

    /** Collects "field: old → new" lines, skipping anything that didn't actually change. */
    public static class Diff {
        private final List<String> lines = new ArrayList<>();

        public Diff add(String field, Object before, Object after) {
            String a = show(before), b = show(after);
            if (!a.equals(b)) lines.add(field + ": " + a + " → " + b);
            return this;
        }

        public Diff money(String field, BigDecimal before, BigDecimal after) {
            // compareTo, not equals: 1.50 and 1.5 are the same amount of money
            boolean same = before != null && after != null && before.compareTo(after) == 0;
            if (!same) lines.add(field + ": " + euro(before) + " → " + euro(after));
            return this;
        }

        /** Always two decimals with a currency sign - "1.8" doesn't read as money. */
        private static String euro(BigDecimal v) {
            return v == null ? "–" : v.setScale(2, java.math.RoundingMode.HALF_UP) + " €";
        }

        public boolean isEmpty() {
            return lines.isEmpty();
        }

        public String text() {
            return String.join("; ", lines);
        }

        private static String show(Object v) {
            if (v == null || String.valueOf(v).isBlank()) return "–";
            return String.valueOf(v);
        }
    }
}
