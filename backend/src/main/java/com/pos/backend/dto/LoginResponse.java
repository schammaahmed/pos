package com.pos.backend.dto;

// What the frontend gets after a successful login. It stores the token and
// sends it back as "Authorization: Bearer <token>" on every request.
public record LoginResponse(
        String token,
        Long id, // the user's own id - the frontend needs it e.g. to hide "deactivate yourself"
        String firstName,
        String lastName,
        String role,
        Long campId,    // null for SUPER_ADMIN (they belong to no single camp)
        String campName,
        boolean mustChangePassword // true -> frontend forces a password change before anything else
) {}
