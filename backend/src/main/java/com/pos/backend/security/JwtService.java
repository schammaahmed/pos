package com.pos.backend.security;

import io.jsonwebtoken.Claims;
import io.jsonwebtoken.JwtException;
import io.jsonwebtoken.Jwts;
import io.jsonwebtoken.security.Keys;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import javax.crypto.SecretKey;
import java.nio.charset.StandardCharsets;
import java.util.Date;

// Creates and validates JWTs. A JWT is a signed string with 3 parts: header.payload.signature.
// The server signs it with a secret key - if anyone tampers with the payload the signature
// no longer matches, so we can trust whatever is inside without a database lookup.
@Service
public class JwtService {

    private final SecretKey key;
    private final long expirationMs;

    // @Value pulls the values from application.properties at startup
    public JwtService(@Value("${app.jwt.secret}") String secret,
                      @Value("${app.jwt.expiration-ms}") long expirationMs) {
        // HMAC-SHA needs a key of at least 256 bits (32 characters) - Keys.hmacShaKeyFor enforces that
        this.key = Keys.hmacShaKeyFor(secret.getBytes(StandardCharsets.UTF_8));
        this.expirationMs = expirationMs;
    }

    // Called after a successful login. The email goes into the "subject" (standard JWT field),
    // the role goes in as a custom claim so the frontend can show the right screens.
    public String generateToken(String email, String role) {
        Date now = new Date();
        return Jwts.builder()
                .subject(email)
                .claim("role", role)
                .issuedAt(now)
                .expiration(new Date(now.getTime() + expirationMs))
                .signWith(key)
                .compact();
    }

    // Returns the email inside the token, or null if the token is invalid/expired.
    // Every protected request goes through this (see JwtAuthFilter).
    public String extractEmail(String token) {
        try {
            Claims claims = Jwts.parser()
                    .verifyWith(key)   // checks the signature
                    .build()
                    .parseSignedClaims(token) // also checks expiration automatically
                    .getPayload();
            return claims.getSubject();
        } catch (JwtException | IllegalArgumentException e) {
            return null; // tampered, expired or malformed token -> treat as not logged in
        }
    }
}
