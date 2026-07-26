package com.pos.backend.controller;

import com.pos.backend.dto.PreOrderDtos.*;
import com.pos.backend.entity.Participant;
import com.pos.backend.service.PreOrderNotifier;
import com.pos.backend.service.PreOrderService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.MediaType;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.servlet.mvc.method.annotation.SseEmitter;

import java.util.List;

// Everything a self-identified participant can do. Authentication is a PARTICIPANT-role
// JWT (issued by /api/public/identify); the auth filter sets the Participant entity as
// the principal, so controllers get it via @AuthenticationPrincipal.
@RestController
@RequestMapping("/api/self")
@RequiredArgsConstructor
@PreAuthorize("hasRole('PARTICIPANT')")
public class SelfController {

    private final PreOrderService preOrderService;
    private final PreOrderNotifier preOrderNotifier;

    @GetMapping("/me")
    public SelfMe me(@AuthenticationPrincipal Participant self) {
        return preOrderService.me(self);
    }

    @GetMapping("/products")
    public List<SelfProduct> menu(@AuthenticationPrincipal Participant self) {
        return preOrderService.menu(self);
    }

    @PostMapping("/preorders")
    public PreOrderResponse place(@AuthenticationPrincipal Participant self,
                                  @Valid @RequestBody PlaceOrderRequest request) {
        return preOrderService.place(self, request);
    }

    @GetMapping("/preorders")
    public List<PreOrderResponse> mine(@AuthenticationPrincipal Participant self) {
        return preOrderService.myOrders(self);
    }

    @PostMapping("/preorders/{id}/cancel")
    public PreOrderResponse cancelMine(@AuthenticationPrincipal Participant self,
                                       @PathVariable Long id) {
        return preOrderService.cancelMine(self, id);
    }

    // Server-Sent Events stream: the participant's page opens an EventSource here and gets
    // pushed a "preorder" event whenever one of their orders transitions. Browsers can't send
    // Authorization headers on EventSource, so the JWT rides in as ?access_token=... (which
    // JwtAuthFilter accepts as a fallback for this endpoint - see the filter).
    // produces=text/event-stream is what turns the SseEmitter into an actual SSE response.
    @GetMapping(path = "/preorders/stream", produces = MediaType.TEXT_EVENT_STREAM_VALUE)
    public SseEmitter stream(@AuthenticationPrincipal Participant self) {
        return preOrderNotifier.register(self.getId());
    }
}
