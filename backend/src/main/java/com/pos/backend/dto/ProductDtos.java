package com.pos.backend.dto;

import com.pos.backend.entity.Product;
import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;

import java.math.BigDecimal;

public class ProductDtos {

    // used for both create and update - same fields either way
    public record ProductRequest(
            @NotBlank String name,
            @NotNull @DecimalMin(value = "0.00") BigDecimal price,
            String category,
            String imageUrl
    ) {}

    public record ProductResponse(
            Long id,
            String name,
            BigDecimal price,
            String category,
            String imageUrl,
            boolean active
    ) {
        public static ProductResponse from(Product p) {
            return new ProductResponse(p.getId(), p.getName(), p.getPrice(),
                    p.getCategory(), p.getImageUrl(), p.isActive());
        }
    }
}
