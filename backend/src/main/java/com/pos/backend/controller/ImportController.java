package com.pos.backend.controller;

import com.pos.backend.dto.ImportDtos.*;
import com.pos.backend.entity.User;
import com.pos.backend.service.ImportService;
import lombok.RequiredArgsConstructor;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import java.util.List;

// Two-step import: /preview parses and judges the file without writing anything,
// /commit writes only the rows the user confirmed. Same permissions as creating
// participants and products by hand - not something a plain seller can do.
@RestController
@RequestMapping("/api/import")
@RequiredArgsConstructor
@PreAuthorize("hasAnyRole('SUPER_ADMIN', 'CAMP_ADMIN', 'SELLER_LEAD')")
public class ImportController {

    private final ImportService importService;

    @PostMapping("/participants/preview")
    public ParticipantPreview previewParticipants(@AuthenticationPrincipal User currentUser,
                                                  @RequestParam(required = false) Long campId,
                                                  @RequestParam("file") MultipartFile file) {
        return importService.previewParticipants(currentUser, campId, file);
    }

    @PostMapping("/participants")
    public ImportResult importParticipants(@AuthenticationPrincipal User currentUser,
                                           @RequestParam(required = false) Long campId,
                                           @RequestBody List<ParticipantRow> rows) {
        return importService.commitParticipants(currentUser, campId, rows);
    }

    @PostMapping("/products/preview")
    public ProductPreview previewProducts(@AuthenticationPrincipal User currentUser,
                                          @RequestParam(required = false) Long campId,
                                          @RequestParam("file") MultipartFile file) {
        return importService.previewProducts(currentUser, campId, file);
    }

    @PostMapping("/products")
    public ImportResult importProducts(@AuthenticationPrincipal User currentUser,
                                       @RequestParam(required = false) Long campId,
                                       @RequestBody List<ProductRow> rows) {
        return importService.commitProducts(currentUser, campId, rows);
    }
}
