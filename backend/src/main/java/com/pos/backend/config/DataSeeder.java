package com.pos.backend.config;

import com.pos.backend.entity.Role;
import com.pos.backend.entity.User;
import com.pos.backend.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.CommandLineRunner;
import org.springframework.core.annotation.Order;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Component;

// Runs once on every startup (CommandLineRunner). Solves the chicken-and-egg problem:
// only admins can create users, but a fresh database has no admin to log in with.
// @Order(2): runs after RoleMigration so we never seed against half-migrated data.
@Component
@Order(2)
@RequiredArgsConstructor
@Slf4j // Lombok: gives us a "log" field
public class DataSeeder implements CommandLineRunner {

    private final UserRepository userRepository;
    private final PasswordEncoder passwordEncoder;

    @Override
    public void run(String... args) {
        if (userRepository.existsByRole(Role.SUPER_ADMIN)) {
            return; // an admin already exists, nothing to do
        }

        User admin = new User();
        admin.setFirstName("Super");
        admin.setLastName("Admin");
        admin.setEmail("admin@pos.local");
        admin.setPassword(passwordEncoder.encode("admin123")); // stored as BCrypt hash, never plain text
        admin.setRole(Role.SUPER_ADMIN);
        admin.setMustChangePassword(true); // admin123 is public knowledge (it's in this file) - force a real one
        userRepository.save(admin);

        log.warn("Seeded default SUPER_ADMIN: admin@pos.local / admin123 - CHANGE THIS PASSWORD!");
    }
}
