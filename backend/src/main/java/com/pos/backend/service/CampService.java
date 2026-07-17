package com.pos.backend.service;

import com.pos.backend.dto.CampDtos.CampResponse;
import com.pos.backend.dto.CampDtos.CreateCampRequest;
import com.pos.backend.entity.Camp;
import com.pos.backend.entity.CampStatus;
import com.pos.backend.entity.Role;
import com.pos.backend.entity.User;
import com.pos.backend.repository.CampRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.web.server.ResponseStatusException;

import java.util.List;

@Service
@RequiredArgsConstructor
public class CampService {

    private final CampRepository campRepository;

    // SUPER_ADMIN sees all camps; everyone else only their own.
    // This filtering happens HERE on the server - the frontend can never "forget" to filter.
    public List<CampResponse> list(User currentUser) {
        if (currentUser.getRole() == Role.SUPER_ADMIN) {
            return campRepository.findAll().stream().map(CampResponse::from).toList();
        }
        if (currentUser.getCamp() == null) {
            return List.of(); // camp user without a camp assigned - nothing to see
        }
        return List.of(CampResponse.from(currentUser.getCamp()));
    }

    public CampResponse create(CreateCampRequest request) {
        if (request.endDate().isBefore(request.startDate())) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "End date must be after start date");
        }
        Camp camp = new Camp();
        camp.setName(request.name());
        camp.setCity(request.city());
        camp.setStartDate(request.startDate());
        camp.setEndDate(request.endDate());
        return CampResponse.from(campRepository.save(camp));
    }

    public CampResponse close(Long campId) {
        Camp camp = campRepository.findById(campId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Camp not found"));
        camp.setStatus(CampStatus.CLOSED);
        return CampResponse.from(campRepository.save(camp));
    }
}
