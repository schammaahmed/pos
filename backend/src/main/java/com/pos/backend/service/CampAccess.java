package com.pos.backend.service;

import com.pos.backend.entity.Camp;
import com.pos.backend.entity.CampStatus;
import com.pos.backend.entity.Role;
import com.pos.backend.entity.User;
import com.pos.backend.repository.CampRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Component;
import org.springframework.web.server.ResponseStatusException;

// THE Datenschutz boundary, in one place. Every service that touches camp data goes
// through these two methods instead of re-implementing the check (and one day forgetting it).
@Component
@RequiredArgsConstructor
public class CampAccess {

    private final CampRepository campRepository;

    // "Which camp is this request about?" - camp users always act in their own camp,
    // SUPER_ADMIN must say which camp they mean (?campId=...).
    public Camp resolveCamp(User currentUser, Long requestedCampId) {
        if (currentUser.getRole() == Role.SUPER_ADMIN) {
            if (requestedCampId == null) {
                throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "campId is required for super admins");
            }
            return campRepository.findById(requestedCampId)
                    .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Camp not found"));
        }

        Camp ownCamp = currentUser.getCamp();
        if (ownCamp == null) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "You are not assigned to a camp");
        }
        // a camp user asking for a DIFFERENT camp gets 403, no matter what the frontend sent
        if (requestedCampId != null && !requestedCampId.equals(ownCamp.getId())) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "You can only access your own camp");
        }
        return ownCamp;
    }

    // Guard for single resources fetched by ID: /api/participants/17 might belong to another
    // camp - IDs are guessable, so this check is what actually keeps camps isolated.
    public void checkSameCamp(User currentUser, Camp resourceCamp) {
        if (currentUser.getRole() == Role.SUPER_ADMIN) {
            return;
        }
        Long ownCampId = currentUser.getCamp() != null ? currentUser.getCamp().getId() : null;
        if (ownCampId == null || !ownCampId.equals(resourceCamp.getId())) {
            // 404, not 403: don't even confirm that the resource exists in another camp
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Not found");
        }
    }

    public void checkCampActive(Camp camp) {
        if (camp.getStatus() != CampStatus.ACTIVE) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "This camp is closed");
        }
    }
}
