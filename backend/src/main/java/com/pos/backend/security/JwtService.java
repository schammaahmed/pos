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

    // Called after a successful STAFF login. Subject = email, role = SUPER_ADMIN / CAMP_LEAD / SELLER.
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

    // Called after a successful self-serve identify. Subject = "participant:<id>" so it can
    // never collide with a staff email, plus a camp claim for scoping. Same signing key -
    // the filter distinguishes them by the "role" claim.
    public String generateParticipantToken(long participantId, long campId, long ttlMs) {
        Date now = new Date();
        return Jwts.builder()
                .subject("participant:" + participantId)
                .claim("role", "PARTICIPANT")
                .claim("camp", campId)
                .issuedAt(now)
                .expiration(new Date(now.getTime() + ttlMs))
                .signWith(key)
                .compact();
    }

    /** Parsed claims, or null if the token is invalid/expired. */
    public Claims parse(String token) {
        try {
            return Jwts.parser()
                    .verifyWith(key)
                    .build()
                    .parseSignedClaims(token)
                    .getPayload();
        } catch (JwtException | IllegalArgumentException e) {
            return null;
        }
    }

    /** Convenience: staff email (== JWT subject) for STAFF tokens; null for anything else. */
    public String extractEmail(String token) {
        Claims c = parse(token);
        if (c == null) return null;
        String role = c.get("role", String.class);
        if ("PARTICIPANT".equals(role)) return null; // not a staff token
        return c.getSubject();
    }
}
