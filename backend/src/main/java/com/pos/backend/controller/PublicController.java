package com.pos.backend.controller;

import com.pos.backend.dto.PreOrderDtos.*;
import com.pos.backend.service.PreOrderService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;

// Fully public - no token needed. Serves the self-serve landing page and the identify
// call (which issues a participant JWT if the name-check passes).
@RestController
@RequestMapping("/api/public")
@RequiredArgsConstructor
public class PublicController {

    private final PreOrderService preOrderService;

    // The stand's QR encodes a URL like https://…/self?t=<selfServeToken>. The frontend
    // hits this first to render the "Wer bist du?" landing with the camp name + open state.
    @GetMapping("/camp")
    public PublicCampInfo lookupCamp(@RequestParam("t") String token) {
        return preOrderService.lookupCamp(token);
    }

    // Name-typing identify. Returns OK + JWT / NOT_FOUND / AMBIGUOUS - never the roster.
    @PostMapping("/identify")
    public IdentifyResponse identify(@Valid @RequestBody IdentifyRequest request) {
        return preOrderService.identify(request);
    }
}
