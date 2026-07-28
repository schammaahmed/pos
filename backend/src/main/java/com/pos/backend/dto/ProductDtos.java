package com.pos.backend.dto;

import com.pos.backend.entity.Product;
import com.pos.backend.entity.ProductOption;
import jakarta.validation.Valid;
import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;

import java.math.BigDecimal;
import java.util.List;

public class ProductDtos {

    // One add-on line in the product form. id is null for a newly added option; present ones
    // are matched by id so existing options keep their identity across an edit.
    public record OptionRequest(
            Long id,
            @NotBlank String name,
            @NotNull @DecimalMin("0.00") BigDecimal surcharge
    ) {}

    // used for both create and update - same fields either way
    public record ProductRequest(
            @NotBlank String name,
            @NotNull @DecimalMin(value = "0.00") BigDecimal price,
            String category,
            String imageUrl,
            @Valid List<OptionRequest> options   // null/empty = no add-ons
    ) {}

    public record OptionResponse(Long id, String name, BigDecimal surcharge) {
        public static OptionResponse from(ProductOption o) {
            return new OptionResponse(o.getId(), o.getName(), o.getSurcharge());
        }
    }

    public record ProductResponse(
            Long id,
            String name,
            BigDecimal price,
            String category,
            String imageUrl,
            boolean active,
            List<OptionResponse> options
    ) {
        public static ProductResponse from(Product p) {
            return new ProductResponse(p.getId(), p.getName(), p.getPrice(),
                    p.getCategory(), p.getImageUrl(), p.isActive(),
                    p.getOptions().stream().map(OptionResponse::from).toList());
        }
    }
}
