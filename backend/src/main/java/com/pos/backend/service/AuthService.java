package com.pos.backend.service;

import com.pos.backend.dto.ChangePasswordRequest;
import com.pos.backend.dto.LoginRequest;
import com.pos.backend.dto.LoginResponse;
import com.pos.backend.entity.User;
import com.pos.backend.repository.UserRepository;
import com.pos.backend.security.JwtService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.web.server.ResponseStatusException;

import java.time.LocalDateTime;

@Service
@RequiredArgsConstructor
public class AuthService {

    private final UserRepository userRepository;
    private final PasswordEncoder passwordEncoder;
    private final JwtService jwtService;

    public LoginResponse login(LoginRequest request) {
        // Deliberately the SAME error for "email unknown" and "wrong password" -
        // otherwise an attacker could probe which emails exist.
        User user = userRepository.findByEmail(request.email())
                .filter(User::isActive)
                .orElseThrow(this::badCredentials);

        // matches() re-hashes the given password with the salt stored inside the hash and compares
        if (!passwordEncoder.matches(request.password(), user.getPassword())) {
            throw badCredentials();
        }

        // record that the invite was actually picked up (and keep it fresh afterwards)
        user.setLastLoginAt(LocalDateTime.now());
        userRepository.save(user);

        String token = jwtService.generateToken(user.getEmail(), user.getRole().name());
        return new LoginResponse(token, user.getId(), user.getFirstName(), user.getLastName(), user.getRole().name(),
                user.getCamp() != null ? user.getCamp().getId() : null,
                user.getCamp() != null ? user.getCamp().getName() : null,
                user.isMustChangePassword());
    }

    // The logged-in user replaces their (temporary) password with their own.
    // Re-checking the current password protects against someone grabbing an unlocked device.
    public void changePassword(User currentUser, ChangePasswordRequest request) {
        if (!passwordEncoder.matches(request.currentPassword(), currentUser.getPassword())) {
            throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Current password is wrong");
        }
        if (passwordEncoder.matches(request.newPassword(), currentUser.getPassword())) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "New password must be different from the old one");
        }
        currentUser.setPassword(passwordEncoder.encode(request.newPassword()));
        currentUser.setMustChangePassword(false); // it's their own choice now
        userRepository.save(currentUser);
    }

    private ResponseStatusException badCredentials() {
        return new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Invalid email or password");
    }
}
