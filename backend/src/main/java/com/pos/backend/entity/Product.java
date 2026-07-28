package com.pos.backend.entity;

import jakarta.persistence.*;
import lombok.Data;
import lombok.ToString;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;

// Something the Verkaufsstand sells. Belongs to ONE camp - camp 2 buying leftovers
// from camp 1 will be a StockTransfer (later milestone), not shared products.
@Data
@Entity
@Table(name = "products")
public class Product {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false)
    private String name;

    @Column(nullable = false, precision = 10, scale = 2)
    private BigDecimal price;

    private String category; // e.g. "Süßes", "Getränke" - free text for now

    // For now pasted manually (any https URL). Auto-fetch from the internet is a later milestone -
    // the field stays the same, only where the URL comes from changes.
    @Column(length = 1000)
    private String imageUrl;

    // Inactive = hidden from the seller panel but kept for sales history.
    // "Sold out" or "not selling this anymore" - never DELETE a product that has sales.
    @Column(nullable = false)
    private boolean active = true;

    @ToString.Exclude
    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "camp_id")
    private Camp camp;

    // Optional add-ons (Ketchup, Mayo …). Cascade + orphanRemoval so editing a product's
    // option list in one PUT adds/updates/removes them in step.
    @ToString.Exclude
    @OneToMany(mappedBy = "product", cascade = CascadeType.ALL, orphanRemoval = true)
    @OrderBy("sortOrder ASC, id ASC")
    private List<ProductOption> options = new ArrayList<>();

    @Column(updatable = false)
    private LocalDateTime createdAt;

    @PrePersist
    protected void onCreate() {
        createdAt = LocalDateTime.now();
    }
}
