package com.pos.backend.controller;

import com.pos.backend.dto.UserDtos.CreateUserRequest;
import com.pos.backend.dto.UserDtos.UserResponse;
import com.pos.backend.entity.User;
import com.pos.backend.service.UserService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.util.List;

// Whole controller is admin-only; the fine-grained rules (which roles/camps a
// CAMP_LEAD may touch) live in UserService.
@RestController
@RequestMapping("/api/users")
@RequiredArgsConstructor
@PreAuthorize("hasAnyRole('SUPER_ADMIN', 'CAMP_LEAD')")
public class UserController {

    private final UserService userService;

    @GetMapping
    public List<UserResponse> list(@AuthenticationPrincipal User currentUser) {
        return userService.list(currentUser);
    }

    @PostMapping
    public UserResponse create(@AuthenticationPrincipal User currentUser,
                               @Valid @RequestBody CreateUserRequest request) {
        return userService.create(currentUser, request);
    }

    @PostMapping("/{id}/activate")
    public UserResponse activate(@AuthenticationPrincipal User currentUser, @PathVariable Long id) {
        return userService.setActive(currentUser, id, true);
    }

    // only possible for accounts that never booked anything - see UserService.delete
    @DeleteMapping("/{id}")
    public void delete(@AuthenticationPrincipal User currentUser, @PathVariable Long id) {
        userService.delete(currentUser, id);
    }

    @PostMapping("/{id}/deactivate")
    public UserResponse deactivate(@AuthenticationPrincipal User currentUser, @PathVariable Long id) {
        return userService.setActive(currentUser, id, false);
    }
}
