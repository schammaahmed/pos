package com.pos.backend.service;

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

        String token = jwtService.generateToken(user.getEmail(), user.getRole().name());
        return new LoginResponse(token, user.getFirstName(), user.getLastName(), user.getRole().name());
    }

    private ResponseStatusException badCredentials() {
        return new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Invalid email or password");
    }
}
