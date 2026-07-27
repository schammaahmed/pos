package com.pos.backend.controller;

import com.pos.backend.dto.ReviewDtos.Cancellation;
import com.pos.backend.dto.ReviewDtos.Kind;
import com.pos.backend.entity.User;
import com.pos.backend.service.ReviewService;
import lombok.RequiredArgsConstructor;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.util.List;

// Cancellation oversight. Viewing is any staff; acknowledging is leadership only - the
// whole point is that a lead confirms cancellations they didn't perform themselves.
@RestController
@RequestMapping("/api/review")
@RequiredArgsConstructor
@PreAuthorize("hasAnyRole('SUPER_ADMIN', 'CAMP_LEAD', 'SELLER')")
public class ReviewController {

    private final ReviewService reviewService;

    @GetMapping("/cancellations")
    public List<Cancellation> cancellations(@AuthenticationPrincipal User currentUser,
                                            @RequestParam(required = false) Long campId) {
        return reviewService.cancellations(currentUser, campId);
    }

    @PostMapping("/cancellations/{kind}/{id}/reviewed")
    @PreAuthorize("hasAnyRole('SUPER_ADMIN', 'CAMP_LEAD')")
    public Cancellation markReviewed(@AuthenticationPrincipal User currentUser,
                                     @PathVariable Kind kind,
                                     @PathVariable Long id) {
        return reviewService.markReviewed(currentUser, kind, id);
    }
}
