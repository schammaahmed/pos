package com.pos.backend.controller;

import com.pos.backend.dto.CampDtos.CampResponse;
import com.pos.backend.dto.CampDtos.CreateCampRequest;
import com.pos.backend.entity.User;
import com.pos.backend.service.CampService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/camps")
@RequiredArgsConstructor
public class CampController {

    private final CampService campService;

    // @AuthenticationPrincipal = the User that JwtAuthFilter put into the security context.
    // Spring hands it to us here - no manual token parsing in controllers, ever.
    @GetMapping
    public List<CampResponse> list(@AuthenticationPrincipal User currentUser) {
        return campService.list(currentUser);
    }

    // @PreAuthorize runs BEFORE the method - non-super-admins get a 403 automatically
    @PostMapping
    @PreAuthorize("hasRole('SUPER_ADMIN')")
    public CampResponse create(@Valid @RequestBody CreateCampRequest request) {
        return campService.create(request);
    }

    @PostMapping("/{id}/close")
    @PreAuthorize("hasRole('SUPER_ADMIN')")
    public CampResponse close(@PathVariable Long id) {
        return campService.close(id);
    }
}
