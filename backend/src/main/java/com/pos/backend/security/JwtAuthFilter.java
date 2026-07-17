package com.pos.backend.security;

import com.pos.backend.entity.User;
import com.pos.backend.repository.UserRepository;
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
// Job: look for "Authorization: Bearer <token>", validate it, and tell Spring Security who the user is.
// If there is no token (or a bad one) we just continue - Spring Security then rejects protected routes with 401.
@Component
@RequiredArgsConstructor // Lombok: generates a constructor for all final fields -> Spring injects them
public class JwtAuthFilter extends OncePerRequestFilter {

    private final JwtService jwtService;
    private final UserRepository userRepository;

    @Override
    protected void doFilterInternal(HttpServletRequest request,
                                    HttpServletResponse response,
                                    FilterChain filterChain) throws ServletException, IOException {

        String header = request.getHeader("Authorization");

        if (header != null && header.startsWith("Bearer ")) {
            String token = header.substring(7); // cut off "Bearer "
            String email = jwtService.extractEmail(token); // null if invalid/expired

            // only authenticate if the token is valid AND nobody is authenticated yet
            if (email != null && SecurityContextHolder.getContext().getAuthentication() == null) {
                // we load the user fresh from the DB so a deactivated user is locked out immediately,
                // even if their token is still technically valid
                User user = userRepository.findByEmail(email).orElse(null);

                if (user != null && user.isActive()) {
                    // Spring Security expects roles as "ROLE_XXX" authorities -
                    // that's what @PreAuthorize("hasRole('SUPER_ADMIN')") checks against
                    var authority = new SimpleGrantedAuthority("ROLE_" + user.getRole().name());
                    // we put the full User entity as the "principal" so controllers can access it directly
                    var auth = new UsernamePasswordAuthenticationToken(user, null, List.of(authority));
                    SecurityContextHolder.getContext().setAuthentication(auth);
                }
            }
        }

        filterChain.doFilter(request, response); // always pass the request on
    }
}
