package com.pos.backend.dto;

import com.pos.backend.entity.Role;
import com.pos.backend.entity.User;
import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

import java.time.LocalDateTime;

public class UserDtos {

    public record CreateUserRequest(
            @NotBlank String firstName,
            @NotBlank String lastName,
            @NotBlank @Email String email,
            @NotBlank @Size(min = 8, message = "Password must be at least 8 characters") String password,
            @NotNull Role role,
            Long campId // required for everyone except SUPER_ADMIN (checked in the service)
    ) {}

    // Note: no password field here - the hash never leaves the backend
    public record UserResponse(
            Long id,
            String firstName,
            String lastName,
            String email,
            String role,
            boolean active,
            Long campId,
            String campName,
            boolean mustChangePassword,   // still on the temporary password
            LocalDateTime lastLoginAt     // null = invited, never signed in
    ) {
        public static UserResponse from(User user) {
            return new UserResponse(user.getId(), user.getFirstName(), user.getLastName(),
                    user.getEmail(), user.getRole().name(), user.isActive(),
                    user.getCamp() != null ? user.getCamp().getId() : null,
                    user.getCamp() != null ? user.getCamp().getName() : null,
                    user.isMustChangePassword(), user.getLastLoginAt());
        }
    }
}
