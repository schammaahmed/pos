package com.pos.backend.controller;

import com.pos.backend.dto.ProductDtos.ProductRequest;
import com.pos.backend.dto.ProductDtos.ProductResponse;
import com.pos.backend.entity.User;
import com.pos.backend.service.ProductService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/products")
@RequiredArgsConstructor
public class ProductController {

    private final ProductService productService;

    // sellers read products; ?activeOnly=false lets admins see deactivated ones too
    @GetMapping
    public List<ProductResponse> list(@AuthenticationPrincipal User currentUser,
                                      @RequestParam(required = false) Long campId,
                                      @RequestParam(defaultValue = "true") boolean activeOnly) {
        return productService.list(currentUser, campId, activeOnly);
    }

    // changing the product range is lead/admin work - a helping hand at the stand
    // should not be able to change prices (user requirement #4)
    @PostMapping
    @PreAuthorize("hasAnyRole('SUPER_ADMIN', 'CAMP_ADMIN', 'SELLER_LEAD')")
    public ProductResponse create(@AuthenticationPrincipal User currentUser,
                                  @RequestParam(required = false) Long campId,
                                  @Valid @RequestBody ProductRequest request) {
        return productService.create(currentUser, campId, request);
    }

    @PutMapping("/{id}")
    @PreAuthorize("hasAnyRole('SUPER_ADMIN', 'CAMP_ADMIN', 'SELLER_LEAD')")
    public ProductResponse update(@AuthenticationPrincipal User currentUser,
                                  @PathVariable Long id,
                                  @Valid @RequestBody ProductRequest request) {
        return productService.update(currentUser, id, request);
    }

    @PostMapping("/{id}/activate")
    @PreAuthorize("hasAnyRole('SUPER_ADMIN', 'CAMP_ADMIN', 'SELLER_LEAD')")
    public ProductResponse activate(@AuthenticationPrincipal User currentUser, @PathVariable Long id) {
        return productService.setActive(currentUser, id, true);
    }

    @PostMapping("/{id}/deactivate")
    @PreAuthorize("hasAnyRole('SUPER_ADMIN', 'CAMP_ADMIN', 'SELLER_LEAD')")
    public ProductResponse deactivate(@AuthenticationPrincipal User currentUser, @PathVariable Long id) {
        return productService.setActive(currentUser, id, false);
    }
}
