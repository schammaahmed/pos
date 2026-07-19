package com.pos.backend.service;

import com.pos.backend.dto.UserDtos.CreateUserRequest;
import com.pos.backend.dto.UserDtos.UserResponse;
import com.pos.backend.entity.Camp;
import com.pos.backend.entity.Role;
import com.pos.backend.entity.User;
import com.pos.backend.repository.CampRepository;
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
    private final PasswordEncoder passwordEncoder;

    public List<UserResponse> list(User currentUser) {
        if (currentUser.getRole() == Role.SUPER_ADMIN) {
            return userRepository.findAll().stream().map(UserResponse::from).toList();
        }
        // CAMP_ADMIN: only the team of their own camp
        return userRepository.findByCampId(requireCampId(currentUser)).stream()
                .map(UserResponse::from).toList();
    }

    public UserResponse create(User currentUser, CreateUserRequest request) {
        // Rule 1: only SUPER_ADMIN may create admins. A CAMP_ADMIN creating another
        // CAMP_ADMIN (or a SUPER_ADMIN!) would be privilege escalation.
        if (currentUser.getRole() == Role.CAMP_ADMIN
                && request.role() != Role.SELLER && request.role() != Role.SELLER_LEAD) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN,
                    "Camp admins can only create sellers and seller leads");
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

        // Rule 3: a CAMP_ADMIN can only create users for their OWN camp
        if (currentUser.getRole() == Role.CAMP_ADMIN
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

        // CAMP_ADMIN may only touch users of their own camp
        if (currentUser.getRole() == Role.CAMP_ADMIN) {
            Long targetCampId = user.getCamp() != null ? user.getCamp().getId() : null;
            if (!requireCampId(currentUser).equals(targetCampId)) {
                throw new ResponseStatusException(HttpStatus.FORBIDDEN, "User belongs to another camp");
            }
        }

        user.setActive(active);
        return UserResponse.from(userRepository.save(user));
    }

    private Long requireCampId(User user) {
        if (user.getCamp() == null) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "You are not assigned to a camp");
        }
        return user.getCamp().getId();
    }
}
