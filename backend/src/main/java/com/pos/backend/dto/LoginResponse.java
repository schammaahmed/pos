package com.pos.backend.dto;

// What the frontend gets after a successful login. It stores the token and
// sends it back as "Authorization: Bearer <token>" on every request.
public record LoginResponse(
        String token,
        String firstName,
        String lastName,
        String role
) {}
