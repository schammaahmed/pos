package com.pos.backend.controller;

import com.pos.backend.dto.ChangePasswordRequest;
import com.pos.backend.dto.LoginRequest;
import com.pos.backend.dto.LoginResponse;
import com.pos.backend.entity.User;
import com.pos.backend.service.AuthService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.server.ResponseStatusException;

// Controllers stay thin: translate HTTP <-> Java and delegate the logic to a service.
@RestController
@RequestMapping("/api/auth")
@RequiredArgsConstructor
public class AuthController {

    private final AuthService authService;

    // @Valid triggers the annotations inside LoginRequest (@NotBlank, @Email)
    // and rejects bad input with a 400 before our code even runs.
    @PostMapping("/login")
    public LoginResponse login(@Valid @RequestBody LoginRequest request) {
        return authService.login(request);
    }

    // Note: /api/auth/** is permitAll in SecurityConfig, but this endpoint still requires a
    // valid token in practice - without one there is no principal and we reject below.
    @PostMapping("/change-password")
    public void changePassword(@AuthenticationPrincipal User currentUser,
                               @Valid @RequestBody ChangePasswordRequest request) {
        if (currentUser == null) {
            throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Not authenticated");
        }
        authService.changePassword(currentUser, request);
    }
}
