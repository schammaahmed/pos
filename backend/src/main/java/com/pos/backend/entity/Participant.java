package com.pos.backend.entity;

import jakarta.persistence.*;
import lombok.Data;
import lombok.ToString;

import java.math.BigDecimal;
import java.time.LocalDateTime;

// A camp participant. Only first + last name are required (Datenschutz: we store as little as possible).
// The SAME person attending two camps = two Participant rows, one per camp - camps are fully isolated.
@Data
@Entity
@Table(name = "participants")
public class Participant {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false)
    private String firstName;

    @Column(nullable = false)
    private String lastName;

    private String phone; // optional - for future SMS notifications / pre-orders

    // ONE field for both balance and debt: positive = credit, negative = owes money.
    // BigDecimal, never double/float - floating point math loses cents (0.1 + 0.2 != 0.3).
    // precision 10, scale 2 = up to 99,999,999.99 with exactly 2 decimal places.
    @Column(nullable = false, precision = 10, scale = 2)
    private BigDecimal balance = BigDecimal.ZERO;

    @ToString.Exclude
    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "camp_id")
    private Camp camp;

    // Optimistic locking: Hibernate adds "WHERE version = ?" to every UPDATE. If two sellers
    // charge the same participant at the same moment, the second UPDATE finds a changed version,
    // fails, and we retry with the fresh balance - no lost money, no explicit DB locks.
    @Version
    private Long version;

    @Column(updatable = false)
    private LocalDateTime createdAt;

    @PrePersist
    protected void onCreate() {
        createdAt = LocalDateTime.now();
    }
}
