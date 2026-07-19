package com.pos.backend.controller;

import com.pos.backend.dto.ParticipantDtos.AdjustmentResponse;
import com.pos.backend.dto.ParticipantDtos.CreateParticipantRequest;
import com.pos.backend.dto.ParticipantDtos.DepositRequest;
import com.pos.backend.dto.ParticipantDtos.ParticipantResponse;
import com.pos.backend.entity.User;
import com.pos.backend.service.ParticipantService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/participants")
@RequiredArgsConstructor
public class ParticipantController {

    private final ParticipantService participantService;

    // ?search=mira filters by name; ?campId= is only needed by SUPER_ADMIN
    @GetMapping
    public List<ParticipantResponse> list(@AuthenticationPrincipal User currentUser,
                                          @RequestParam(required = false) Long campId,
                                          @RequestParam(required = false) String search) {
        return participantService.list(currentUser, campId, search);
    }

    @GetMapping("/{id}")
    public ParticipantResponse get(@AuthenticationPrincipal User currentUser, @PathVariable Long id) {
        return participantService.get(currentUser, id);
    }

    // Creating participants is admin/lead work (check-in desk), not something
    // every helping hand at the stand should be able to do.
    @PostMapping
    @PreAuthorize("hasAnyRole('SUPER_ADMIN', 'CAMP_ADMIN', 'SELLER_LEAD')")
    public ParticipantResponse create(@AuthenticationPrincipal User currentUser,
                                      @RequestParam(required = false) Long campId,
                                      @Valid @RequestBody CreateParticipantRequest request) {
        return participantService.create(currentUser, campId, request);
    }

    // Any seller can take a top-up ("here is 10€ for my account")
    @PostMapping("/{id}/deposit")
    public ParticipantResponse deposit(@AuthenticationPrincipal User currentUser,
                                       @PathVariable Long id,
                                       @Valid @RequestBody DepositRequest request) {
        return participantService.deposit(currentUser, id, request);
    }

    // Erasing debt is a trust operation - lead or admin only
    @PostMapping("/{id}/settle-debt")
    @PreAuthorize("hasAnyRole('SUPER_ADMIN', 'CAMP_ADMIN', 'SELLER_LEAD')")
    public ParticipantResponse settleDebt(@AuthenticationPrincipal User currentUser, @PathVariable Long id) {
        return participantService.settleDebt(currentUser, id);
    }

    @GetMapping("/{id}/history")
    public List<AdjustmentResponse> history(@AuthenticationPrincipal User currentUser, @PathVariable Long id) {
        return participantService.history(currentUser, id);
    }
}
