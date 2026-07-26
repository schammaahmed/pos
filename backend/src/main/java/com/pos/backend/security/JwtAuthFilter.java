package com.pos.backend.security;

import com.pos.backend.entity.Participant;
import com.pos.backend.entity.User;
import com.pos.backend.repository.ParticipantRepository;
import com.pos.backend.repository.UserRepository;
import io.jsonwebtoken.Claims;
import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import lombok.RequiredArgsConstructor;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

import java.io.IOException;
import java.util.List;

// Runs once for EVERY request, before it reaches a controller.
// Job: look for "Authorization: Bearer <token>", validate it, and tell Spring Security who
// the user is. If there is no token (or a bad one) we just continue - Spring Security then
// rejects protected routes with 401.
//
// Two flavours of token are accepted (same secret, distinguished by the "role" claim):
//   - STAFF (SUPER_ADMIN / CAMP_LEAD / SELLER) → subject is email → principal is the User entity
//   - PARTICIPANT                              → subject is "participant:<id>" → principal is the
//                                                Participant entity, role authority ROLE_PARTICIPANT
@Component
@RequiredArgsConstructor
public class JwtAuthFilter extends OncePerRequestFilter {

    private final JwtService jwtService;
    private final UserRepository userRepository;
    private final ParticipantRepository participantRepository;

    @Override
    protected void doFilterInternal(HttpServletRequest request,
                                    HttpServletResponse response,
                                    FilterChain filterChain) throws ServletException, IOException {

        String token = readToken(request);

        if (token != null) {
            Claims claims = jwtService.parse(token);

            if (claims != null && SecurityContextHolder.getContext().getAuthentication() == null) {
                String role = claims.get("role", String.class);

                if ("PARTICIPANT".equals(role)) {
                    authenticateParticipant(claims);
                } else {
                    authenticateStaff(claims);
                }
            }
        }

        filterChain.doFilter(request, response);
    }

    // Preferred: "Authorization: Bearer <jwt>". Fallback: "?access_token=<jwt>" - browsers
    // can't set Authorization on an EventSource, and this is the standard workaround for SSE
    // (also used by OAuth2 bearer tokens). Query-string tokens are visible in server logs and
    // referrer headers, so we only accept them here as a fallback for the same short-lived JWT.
    private static String readToken(HttpServletRequest request) {
        String header = request.getHeader("Authorization");
        if (header != null && header.startsWith("Bearer ")) return header.substring(7);
        String qp = request.getParameter("access_token");
        return (qp != null && !qp.isBlank()) ? qp : null;
    }

    private void authenticateStaff(Claims claims) {
        String email = claims.getSubject();
        // load fresh so a just-deactivated user is locked out even with a still-valid token
        User user = userRepository.findByEmail(email).orElse(null);
        if (user != null && user.isActive()) {
            var authority = new SimpleGrantedAuthority("ROLE_" + user.getRole().name());
            var auth = new UsernamePasswordAuthenticationToken(user, null, List.of(authority));
            SecurityContextHolder.getContext().setAuthentication(auth);
        }
    }

    private void authenticateParticipant(Claims claims) {
        // subject format: "participant:<id>"
        String subject = claims.getSubject();
        if (subject == null || !subject.startsWith("participant:")) return;
        long participantId;
        try {
            participantId = Long.parseLong(subject.substring("participant:".length()));
        } catch (NumberFormatException e) {
            return;
        }
        // fetch-join the camp: controllers routinely touch participant.getCamp(), and
        // this filter's tiny tx is closed by the time they do, so a lazy proxy would blow up.
        Participant participant = participantRepository.findByIdWithCamp(participantId).orElse(null);
        if (participant == null) return;
        // Extra sanity: the token was issued for a specific camp; if the participant somehow
        // was moved to another camp, the token no longer applies.
        Long campClaim = claims.get("camp", Long.class);
        if (campClaim != null && !campClaim.equals(participant.getCamp().getId())) return;

        var authority = new SimpleGrantedAuthority("ROLE_PARTICIPANT");
        var auth = new UsernamePasswordAuthenticationToken(participant, null, List.of(authority));
        SecurityContextHolder.getContext().setAuthentication(auth);
    }
}
