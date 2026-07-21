package com.pos.backend.controller;

import com.pos.backend.dto.OverviewDtos.Overview;
import com.pos.backend.entity.User;
import com.pos.backend.service.OverviewService;
import lombok.RequiredArgsConstructor;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

// Cross-camp overview - a super-admin-only vantage point over every camp at once.
@RestController
@RequestMapping("/api/overview")
@RequiredArgsConstructor
@PreAuthorize("hasRole('SUPER_ADMIN')")
public class OverviewController {

    private final OverviewService overviewService;

    @GetMapping
    public Overview overview(@AuthenticationPrincipal User currentUser) {
        return overviewService.build(currentUser);
    }
}
