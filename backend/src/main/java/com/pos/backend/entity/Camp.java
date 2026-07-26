package com.pos.backend.entity;

import jakarta.persistence.*;
import lombok.Data;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.LocalTime;

// One camp = one season in one city (e.g. "Sommerlager Wien 2026").
// A new season is a FRESH camp - participants, products and sales all hang off a camp,
// which is also the privacy boundary: sellers only ever see data of their own camp.
@Data
@Entity
@Table(name = "camps")
public class Camp {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false)
    private String name;

    @Column(nullable = false)
    private String city; // today everything is Vienna, but camps can run in parallel in other cities later

    @Column(nullable = false)
    private LocalDate startDate;

    @Column(nullable = false)
    private LocalDate endDate;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private CampStatus status = CampStatus.ACTIVE;

    // The float the cash box starts the camp with (Wechselgeld). All cash-box maths
    // start from here. columnDefinition keeps ddl-auto happy on existing rows.
    @Column(nullable = false, precision = 10, scale = 2,
            columnDefinition = "numeric(10,2) not null default 0")
    private BigDecimal startingCash = BigDecimal.ZERO;

    // The random opaque token embedded in the stand's QR code. Nullable until a lead
    // opens self-serve for this camp; rotatable if the QR is ever compromised.
    @Column(unique = true)
    private String selfServeToken;

    // A single "orders open" window applied to every day. Both null = always open
    // whenever the camp is ACTIVE. Kept as LocalTimes to stay timezone-neutral;
    // "18:00" means 18:00 in the camp's local wall clock.
    private LocalTime selfServeOpenFrom;
    private LocalTime selfServeOpenUntil;

    @Column(updatable = false)
    private LocalDateTime createdAt;

    @PrePersist
    protected void onCreate() {
        createdAt = LocalDateTime.now();
    }
}
