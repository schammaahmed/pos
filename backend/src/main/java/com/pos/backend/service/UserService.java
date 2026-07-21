package com.pos.backend.service;

import com.pos.backend.dto.UserDtos.CreateUserRequest;
import com.pos.backend.dto.UserDtos.UserResponse;
import com.pos.backend.entity.Camp;
import com.pos.backend.entity.Role;
import com.pos.backend.entity.User;
import com.pos.backend.repository.CampRepository;
import com.pos.backend.repository.SaleRepository;
import com.pos.backend.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.web.server.ResponseStatusException;

import java.util.List;

@Service
@RequiredArgsConstructor
public class UserService {

    private final UserRepository userRepository;
    private final CampRepository campRepository;
    private final SaleRepository saleRepository;
    private final PasswordEncoder passwordEncoder;

    public List<UserResponse> list(User currentUser) {
        if (currentUser.getRole() == Role.SUPER_ADMIN) {
            return userRepository.findAll().stream().map(UserResponse::from).toList();
        }
        // CAMP_LEAD: only the team of their own camp
        return userRepository.findByCampId(requireCampId(currentUser)).stream()
                .map(UserResponse::from).toList();
    }

    public UserResponse create(User currentUser, CreateUserRequest request) {
        // Rule 1: a CAMP_LEAD may only staff its own camp - it can create SELLERs and
        // fellow CAMP_LEADs, but never a SUPER_ADMIN (that would be privilege escalation).
        if (currentUser.getRole() == Role.CAMP_LEAD && request.role() == Role.SUPER_ADMIN) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN,
                    "Only a super admin can create super admins");
        }

        // Rule 2: everyone except SUPER_ADMIN must belong to a camp
        Camp camp = null;
        if (request.role() != Role.SUPER_ADMIN) {
            if (request.campId() == null) {
                throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "campId is required for this role");
            }
            camp = campRepository.findById(request.campId())
                    .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Camp not found"));
        }

        // Rule 3: a CAMP_LEAD can only create users for their OWN camp
        if (currentUser.getRole() == Role.CAMP_LEAD
                && !requireCampId(currentUser).equals(request.campId())) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "You can only create users for your own camp");
        }

        if (userRepository.findByEmail(request.email()).isPresent()) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "A user with this email already exists");
        }

        User user = new User();
        user.setFirstName(request.firstName());
        user.setLastName(request.lastName());
        user.setEmail(request.email());
        user.setPassword(passwordEncoder.encode(request.password()));
        user.setRole(request.role());
        user.setCamp(camp);
        // the admin only sets a TEMPORARY password - the user must replace it at first login
        user.setMustChangePassword(true);
        return UserResponse.from(userRepository.save(user));
    }

    // Deactivating instead of deleting keeps the user's sales history intact for reports.
    public UserResponse setActive(User currentUser, Long userId, boolean active) {
        if (currentUser.getId().equals(userId)) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "You cannot deactivate yourself");
        }
        User user = userRepository.findById(userId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "User not found"));

        // CAMP_LEAD may only touch users of their own camp
        if (currentUser.getRole() == Role.CAMP_LEAD) {
            Long targetCampId = user.getCamp() != null ? user.getCamp().getId() : null;
            if (!requireCampId(currentUser).equals(targetCampId)) {
                throw new ResponseStatusException(HttpStatus.FORBIDDEN, "User belongs to another camp");
            }
        }

        user.setActive(active);
        return UserResponse.from(userRepository.save(user));
    }

    // Deleting a user who has booked sales would orphan the audit trail, so that is
    // refused: those accounts get deactivated instead. Only someone who never sold
    // anything (a wrong invite, a typo'd account) can actually be removed.
    public void delete(User currentUser, Long userId) {
        if (currentUser.getId().equals(userId)) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "You cannot delete yourself");
        }
        User user = userRepository.findById(userId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "User not found"));

        if (currentUser.getRole() == Role.CAMP_LEAD) {
            Long targetCampId = user.getCamp() != null ? user.getCamp().getId() : null;
            if (!requireCampId(currentUser).equals(targetCampId)) {
                throw new ResponseStatusException(HttpStatus.FORBIDDEN, "User belongs to another camp");
            }
            // a lead can remove sellers, but not fellow leads or super admins
            if (user.getRole() == Role.CAMP_LEAD || user.getRole() == Role.SUPER_ADMIN) {
                throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Camp leads cannot delete other leads or admins");
            }
        }

        if (saleRepository.existsBySellerId(userId)) {
            throw new ResponseStatusException(HttpStatus.CONFLICT,
                    "Diese Person hat bereits Verkäufe gebucht und kann nicht gelöscht werden – bitte deaktivieren.");
        }
        userRepository.delete(user);
    }

    private Long requireCampId(User user) {
        if (user.getCamp() == null) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "You are not assigned to a camp");
        }
        return user.getCamp().getId();
    }
}
