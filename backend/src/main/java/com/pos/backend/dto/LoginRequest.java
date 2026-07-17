package com.pos.backend.dto;

import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;

// A record = immutable data class. Java generates constructor, getters, equals for us.
// DTO = Data Transfer Object: the shape of the JSON going in/out of the API.
// We never expose entities directly - e.g. we must NEVER send the password hash to the frontend.
public record LoginRequest(
        @NotBlank @Email String email,   // validation annotations run because of @Valid in the controller
        @NotBlank String password
) {}
