package com.pos.backend.controller;

import com.pos.backend.dto.PreOrderDtos.*;
import com.pos.backend.entity.User;
import com.pos.backend.service.PreOrderService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.util.List;

// Staff side: the pickup queue and per-camp self-serve settings (QR token + open hours).
// Sellers can pick up + cancel (both need one seller at the till anyway); only a lead can
// change the QR + windows.
@RestController
@RequestMapping("/api/preorders")
@RequiredArgsConstructor
public class PreOrderController {

    private final PreOrderService preOrderService;

    @GetMapping
    public List<PreOrderResponse> queue(@AuthenticationPrincipal User currentUser,
                                        @RequestParam(required = false) Long campId) {
        return preOrderService.staffQueue(currentUser, campId);
    }

    // Staff walk-through: a seller records a pre-order on a participant's behalf while
    // walking through the bus. Same result as a self-serve order, different entry path.
    @PostMapping
    public PreOrderResponse staffPlace(@AuthenticationPrincipal User currentUser,
                                       @Valid @RequestBody StaffPlaceRequest request) {
        return preOrderService.staffPlace(currentUser, request);
    }

    // Kitchen transitions. Both are no-body POSTs so they read like the actions they are
    // (see docs at /api/preorders): start = "in Vorbereitung", ready = "abholbereit".
    @PostMapping("/{id}/start")
    public PreOrderResponse start(@AuthenticationPrincipal User currentUser, @PathVariable Long id) {
        return preOrderService.start(currentUser, id);
    }

    @PostMapping("/{id}/ready")
    public PreOrderResponse markReady(@AuthenticationPrincipal User currentUser, @PathVariable Long id) {
        return preOrderService.markReady(currentUser, id);
    }

    @PostMapping("/{id}/pickup")
    public PreOrderResponse pickup(@AuthenticationPrincipal User currentUser,
                                   @PathVariable Long id,
                                   @Valid @RequestBody PickupRequest request) {
        return preOrderService.pickup(currentUser, id, request);
    }

    @PostMapping("/{id}/cancel")
    public PreOrderResponse cancel(@AuthenticationPrincipal User currentUser, @PathVariable Long id) {
        return preOrderService.staffCancel(currentUser, id);
    }

    // Self-serve configuration is a camp-level admin action, hence lead+.
    @GetMapping("/config")
    @PreAuthorize("hasAnyRole('SUPER_ADMIN', 'CAMP_LEAD')")
    public SelfServeConfigResponse config(@AuthenticationPrincipal User currentUser,
                                          @RequestParam(required = false) Long campId) {
        return preOrderService.selfServeConfig(currentUser, campId);
    }

    @PutMapping("/config")
    @PreAuthorize("hasAnyRole('SUPER_ADMIN', 'CAMP_LEAD')")
    public SelfServeConfigResponse updateConfig(@AuthenticationPrincipal User currentUser,
                                                @RequestParam(required = false) Long campId,
                                                @Valid @RequestBody SelfServeConfigRequest request) {
        return preOrderService.updateSelfServeConfig(currentUser, campId, request);
    }
}
