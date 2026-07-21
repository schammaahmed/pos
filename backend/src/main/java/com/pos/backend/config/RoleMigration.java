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

    @Override
    public void run(String... args) {
        // Hibernate (ddl-auto=update) generated a CHECK constraint pinning role to the OLD
        // enum values and never revises it, so we drop it first - otherwise writing the new
        // CAMP_LEAD value is rejected. Hibernate re-adds an up-to-date one on the next boot;
        // if it doesn't, an absent constraint is simply permissive. Idempotent (IF EXISTS).
        jdbc.execute("ALTER TABLE users DROP CONSTRAINT IF EXISTS users_role_check");

        int moved = jdbc.update(
                "UPDATE users SET role = 'CAMP_LEAD' WHERE role IN ('CAMP_ADMIN', 'SELLER_LEAD')");
        if (moved > 0) {
            log.warn("Role migration: moved {} user(s) from CAMP_ADMIN/SELLER_LEAD to CAMP_LEAD", moved);
        }
    }
}
