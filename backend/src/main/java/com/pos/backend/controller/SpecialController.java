package com.pos.backend.controller;

import com.pos.backend.dto.SpecialDtos.*;
import com.pos.backend.entity.User;
import com.pos.backend.service.SpecialService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.time.LocalDate;
import java.util.List;

// Specials (Aktionen). Creation/closing is admin work (lead+); reserving and collecting
// happens at the till, so every staff role may do them.
@RestController
@RequestMapping("/api/specials")
@RequiredArgsConstructor
public class SpecialController {

    private final SpecialService specialService;

    // ---- Specials themselves ------------------------------------------------

    @GetMapping
    public List<SpecialResponse> list(@AuthenticationPrincipal User currentUser,
                                      @RequestParam(required = false) Long campId) {
        return specialService.list(currentUser, campId);
    }

    @PostMapping
    @PreAuthorize("hasAnyRole('SUPER_ADMIN', 'CAMP_LEAD')")
    public SpecialResponse create(@AuthenticationPrincipal User currentUser,
                                  @RequestParam(required = false) Long campId,
                                  @Valid @RequestBody SpecialRequest request) {
        return specialService.create(currentUser, campId, request);
    }

    @PutMapping("/{id}")
    @PreAuthorize("hasAnyRole('SUPER_ADMIN', 'CAMP_LEAD')")
    public SpecialResponse update(@AuthenticationPrincipal User currentUser,
                                  @PathVariable Long id,
                                  @Valid @RequestBody SpecialRequest request) {
        return specialService.update(currentUser, id, request);
    }

    @PostMapping("/{id}/close")
    @PreAuthorize("hasAnyRole('SUPER_ADMIN', 'CAMP_LEAD')")
    public SpecialResponse close(@AuthenticationPrincipal User currentUser, @PathVariable Long id) {
        return specialService.close(currentUser, id);
    }

    @GetMapping("/{id}/orders")
    public List<SpecialOrderResponse> ordersFor(@AuthenticationPrincipal User currentUser,
                                                @PathVariable Long id) {
        return specialService.ordersFor(currentUser, id);
    }

    // ---- Reservations & collection -----------------------------------------

    @PostMapping("/orders")
    public SpecialOrderResponse reserve(@AuthenticationPrincipal User currentUser,
                                        @Valid @RequestBody ReserveRequest request) {
        return specialService.reserve(currentUser, request);
    }

    @PostMapping("/orders/{id}/cancel")
    public SpecialOrderResponse cancel(@AuthenticationPrincipal User currentUser,
                                       @PathVariable Long id) {
        return specialService.cancel(currentUser, id);
    }

    @PostMapping("/orders/{id}/collect")
    public SpecialOrderResponse collect(@AuthenticationPrincipal User currentUser,
                                        @PathVariable Long id,
                                        @Valid @RequestBody CollectRequest request) {
        return specialService.collect(currentUser, id, request);
    }

    // Ausgabe (collection) list - defaults to today; the seller can page back/forward.
    @GetMapping("/collection")
    public List<SpecialOrderResponse> collectionList(@AuthenticationPrincipal User currentUser,
                                                     @RequestParam(required = false) Long campId,
                                                     @RequestParam(required = false)
                                                     @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate day) {
        return specialService.collectionList(currentUser, campId, day);
    }
}
