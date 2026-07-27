package com.pos.backend.controller;

import com.pos.backend.dto.LedgerDtos.LedgerEntry;
import com.pos.backend.entity.User;
import com.pos.backend.service.LedgerService;
import lombok.RequiredArgsConstructor;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

// The unified sales-log ledger. Read-only; row-level actions (flag/reverse a Sale) stay on
// SaleController. Every staff role may view it - it's how the stand stays accountable.
@RestController
@RequestMapping("/api/ledger")
@RequiredArgsConstructor
@PreAuthorize("hasAnyRole('SUPER_ADMIN', 'CAMP_LEAD', 'SELLER')")
public class LedgerController {

    private final LedgerService ledgerService;

    @GetMapping
    public List<LedgerEntry> list(@AuthenticationPrincipal User currentUser,
                                  @RequestParam(required = false) Long campId) {
        return ledgerService.list(currentUser, campId);
    }
}
