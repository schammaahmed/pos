package com.pos.backend.controller;

import com.pos.backend.dto.CashDtos.*;
import com.pos.backend.entity.User;
import com.pos.backend.service.CashService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

// The camp cash box. Admin work - the leadership handles the physical money, not
// individual sellers.
@RestController
@RequestMapping("/api/cash")
@RequiredArgsConstructor
@PreAuthorize("hasAnyRole('SUPER_ADMIN', 'CAMP_ADMIN')")
public class CashController {

    private final CashService cashService;

    // ?campId= only needed by SUPER_ADMIN; a camp admin's own camp is implied
    @GetMapping
    public CashBook cashBook(@AuthenticationPrincipal User currentUser,
                             @RequestParam(required = false) Long campId) {
        return cashService.cashBook(currentUser, campId);
    }

    @PostMapping
    public CashBook add(@AuthenticationPrincipal User currentUser,
                        @RequestParam(required = false) Long campId,
                        @Valid @RequestBody CashMovementRequest request) {
        return cashService.addMovement(currentUser, campId, request);
    }

    @PostMapping("/reconcile")
    public Reconciliation reconcile(@AuthenticationPrincipal User currentUser,
                                    @RequestParam(required = false) Long campId,
                                    @Valid @RequestBody ReconcileRequest request) {
        return cashService.reconcile(currentUser, campId, request);
    }
}
