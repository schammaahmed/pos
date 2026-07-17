package com.pos.backend.controller;

import com.pos.backend.dto.SaleDtos.CheckoutRequest;
import com.pos.backend.dto.SaleDtos.SaleResponse;
import com.pos.backend.entity.User;
import com.pos.backend.service.SaleService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/sales")
@RequiredArgsConstructor
public class SaleController {

    private final SaleService saleService;

    // THE endpoint of the whole system: a seller confirms a basket
    @PostMapping
    public SaleResponse checkout(@AuthenticationPrincipal User currentUser,
                                 @Valid @RequestBody CheckoutRequest request) {
        return saleService.checkout(currentUser, request);
    }

    // ?participantId= for one participant's purchase history, otherwise the whole camp's log
    @GetMapping
    public List<SaleResponse> list(@AuthenticationPrincipal User currentUser,
                                   @RequestParam(required = false) Long campId,
                                   @RequestParam(required = false) Long participantId) {
        return saleService.list(currentUser, campId, participantId);
    }

    // any seller may reverse - but for plain SELLERs it lands in the lead's review queue
    @PostMapping("/{id}/reverse")
    public SaleResponse reverse(@AuthenticationPrincipal User currentUser, @PathVariable Long id) {
        return saleService.reverse(currentUser, id);
    }

    @GetMapping("/flagged")
    @PreAuthorize("hasAnyRole('SUPER_ADMIN', 'CAMP_ADMIN', 'SELLER_LEAD')")
    public List<SaleResponse> flagged(@AuthenticationPrincipal User currentUser,
                                      @RequestParam(required = false) Long campId) {
        return saleService.flagged(currentUser, campId);
    }

    @PostMapping("/{id}/approve-reversal")
    @PreAuthorize("hasAnyRole('SUPER_ADMIN', 'CAMP_ADMIN', 'SELLER_LEAD')")
    public SaleResponse approveReversal(@AuthenticationPrincipal User currentUser, @PathVariable Long id) {
        return saleService.approveReversal(currentUser, id);
    }
}
