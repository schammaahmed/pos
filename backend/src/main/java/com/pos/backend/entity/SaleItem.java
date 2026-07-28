package com.pos.backend.entity;

import jakarta.persistence.*;
import lombok.Data;
import lombok.ToString;

import java.math.BigDecimal;

// One line of a sale: "2x Bueno à 1.00".
@Data
@Entity
@Table(name = "sale_items")
public class SaleItem {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ToString.Exclude
    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "sale_id")
    private Sale sale;

    @ToString.Exclude
    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "product_id")
    private Product product;

    @Column(nullable = false)
    private int quantity;

    // SNAPSHOT of the price at the moment of sale. If the admin changes the Bueno price
    // tomorrow, yesterday's sales must still show what was actually paid. Includes any
    // chosen option surcharges (see optionsLabel).
    @Column(nullable = false, precision = 10, scale = 2)
    private BigDecimal unitPrice;

    // Snapshot of the chosen add-ons for this line, e.g. "+ Ketchup, + Mayo". Null when none.
    @Column(length = 500)
    private String optionsLabel;
}
