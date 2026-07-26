package com.pos.backend.config;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.CommandLineRunner;
import org.springframework.core.annotation.Order;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Component;

// One-time role merge: the old CAMP_ADMIN and SELLER_LEAD roles were combined into
// CAMP_LEAD. Roles are stored as text (@Enumerated(STRING)), so any row still holding
// an old value would fail to load once those enum constants are gone. We move them
// with plain SQL - which never deserializes the User entity - and run it BEFORE the
// DataSeeder (@Order) so the app is consistent before anything reads a user. It is
// idempotent: once migrated the UPDATE matches nothing.
@Component
@Order(1)
@RequiredArgsConstructor
@Slf4j
public class RoleMigration implements CommandLineRunner {

    private final JdbcTemplate jdbc;

    // Every check constraint Hibernate creates for an @Enumerated column becomes stale
    // as soon as we add a new value, because ddl-auto=update doesn't revise them. Drop
    // the known-stale ones on startup - Hibernate re-adds an up-to-date one on the next
    // boot, and an absent constraint is simply permissive. All idempotent (IF EXISTS).
    // {table, constraint} pairs: derivation from the constraint name isn't safe because
    // column names can themselves contain underscores (e.g. audit_logs.entity_type).
    private static final String[][] STALE_ENUM_CHECKS = {
            {"users",      "users_role_check"},            // Role: CAMP_ADMIN/SELLER_LEAD → CAMP_LEAD
            {"pre_orders", "pre_orders_status_check"},     // PreOrder.Status: + IN_PROGRESS, READY
            {"audit_logs", "audit_logs_action_check"},     // AuditLog.Action: many new values across chunks
            {"audit_logs", "audit_logs_entity_type_check"},// AuditLog.EntityType: + SPECIAL, SPECIAL_ORDER, PRE_ORDER
    };

    @Override
    public void run(String... args) {
        for (String[] pair : STALE_ENUM_CHECKS) {
            jdbc.execute("ALTER TABLE " + pair[0] + " DROP CONSTRAINT IF EXISTS " + pair[1]);
        }

        int moved = jdbc.update(
                "UPDATE users SET role = 'CAMP_LEAD' WHERE role IN ('CAMP_ADMIN', 'SELLER_LEAD')");
        if (moved > 0) {
            log.warn("Role migration: moved {} user(s) from CAMP_ADMIN/SELLER_LEAD to CAMP_LEAD", moved);
        }
    }
}
