package com.pos.backend.entity;

import jakarta.persistence.*;
import lombok.Data;
import lombok.ToString;

import java.math.BigDecimal;

// An optional add-on for a product, e.g. a Käsetoast's "+ Ketchup" or "+ Mayo". Each can
// carry a surcharge (0 = free extra). Options belong to one product; choosing them at order
// time adds their surcharge to the line and is snapshotted onto the order (see PreOrder).
@Data
@Entity
@Table(name = "product_options", indexes = @Index(name = "idx_option_product", columnList = "product_id"))
public class ProductOption {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ToString.Exclude
    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "product_id", nullable = false)
    private Product product;

    @Column(nullable = false)
    private String name;

    // Extra charged per unit when this option is chosen. 0.00 = a free extra.
    @Column(nullable = false, precision = 10, scale = 2)
    private BigDecimal surcharge = BigDecimal.ZERO;

    // Position in the list, so "Ketchup, Mayo, Senf" keep the order the lead entered them.
    @Column(nullable = false)
    private int sortOrder = 0;
}
