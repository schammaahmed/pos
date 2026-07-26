package com.pos.backend.entity;

import jakarta.persistence.*;
import lombok.Data;
import lombok.ToString;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;

// A planned offer at the stand, e.g. "Waffeln am Samstag, 3 € — Bestellung bis Freitag Abend".
// Unlike a Product (impulse buy on the till), a Special is reserved in advance and handed out
// later; the *reservation* costs nothing, the participant pays at collection.
@Data
@Entity
@Table(name = "specials", indexes = @Index(name = "idx_special_camp", columnList = "camp_id"))
public class Special {

    public enum Status { ACTIVE, CLOSED }

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ToString.Exclude
    @ManyToOne(optional = false, fetch = FetchType.LAZY)
    @JoinColumn(name = "camp_id", nullable = false)
    private Camp camp;

    @Column(nullable = false)
    private String name;

    @Column(length = 500)
    private String description;

    @Column(nullable = false, precision = 10, scale = 2)
    private BigDecimal price;

    // Bestellschluss — no more reservations after this. Nullable = open until closed by hand.
    private LocalDateTime orderableUntil;

    // Ausgabetag — when the goods will be handed over. Drives the Ausgabe list.
    @Column(nullable = false)
    private LocalDate collectionDate;

    // Soft cap: the UI warns once reached but does NOT block extra orders - the kitchen
    // may be OK to make more, and the seller can judge. Null = no cap.
    private Integer capacity;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private Status status = Status.ACTIVE;

    @Column(updatable = false)
    private LocalDateTime createdAt;

    @PrePersist
    protected void onCreate() {
        createdAt = LocalDateTime.now();
    }
}
