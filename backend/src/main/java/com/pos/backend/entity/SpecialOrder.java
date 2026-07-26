package com.pos.backend.entity;

import jakarta.persistence.*;
import lombok.Data;
import lombok.ToString;

import java.math.BigDecimal;
import java.time.LocalDateTime;

// One participant's reservation of a Special. Narrow lifecycle:
//   RESERVED  → the default; taken by a seller/lead on behalf of a participant
//   COLLECTED → picked up and paid; the payment split is stored on this row
//   CANCELLED → dropped before collection, no money moves
//
// A SpecialOrder is deliberately its OWN revenue record - not a Sale. Sales have a
// tight schema (each item must reference a Product) that a Special (a one-off event
// item) doesn't fit. So the split is stored here and CashService sums both streams.
@Data
@Entity
@Table(name = "special_orders", indexes = {
        @Index(name = "idx_order_special", columnList = "special_id"),
        @Index(name = "idx_order_participant", columnList = "participant_id"),
        @Index(name = "idx_order_status", columnList = "status"),
})
public class SpecialOrder {

    public enum Status { RESERVED, COLLECTED, CANCELLED }

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ToString.Exclude
    @ManyToOne(optional = false, fetch = FetchType.LAZY)
    @JoinColumn(name = "special_id", nullable = false)
    private Special special;

    @ToString.Exclude
    @ManyToOne(optional = false, fetch = FetchType.LAZY)
    @JoinColumn(name = "participant_id", nullable = false)
    private Participant participant;

    @Column(nullable = false)
    private int quantity = 1;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private Status status = Status.RESERVED;

    // Payment split - null on RESERVED, filled on COLLECTED. Same shape as Sale so the
    // cash-box maths and any future "revenue" report can treat the two streams uniformly.
    // columnDefinition keeps ddl-auto=update happy on rows created before this column existed.
    @Column(precision = 10, scale = 2, columnDefinition = "numeric(10,2) not null default 0")
    private BigDecimal paidCash = BigDecimal.ZERO;

    @Column(precision = 10, scale = 2, columnDefinition = "numeric(10,2) not null default 0")
    private BigDecimal paidFromBalance = BigDecimal.ZERO;

    @Column(precision = 10, scale = 2, columnDefinition = "numeric(10,2) not null default 0")
    private BigDecimal debtAmount = BigDecimal.ZERO;

    @Column(precision = 10, scale = 2, columnDefinition = "numeric(10,2) not null default 0")
    private BigDecimal extraCredited = BigDecimal.ZERO;

    // who booked the reservation
    @ToString.Exclude
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "created_by")
    private User createdBy;

    // who handed it out
    @ToString.Exclude
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "collected_by")
    private User collectedBy;

    @Column(updatable = false)
    private LocalDateTime createdAt;
    private LocalDateTime collectedAt;
    private LocalDateTime cancelledAt;

    @PrePersist
    protected void onCreate() {
        createdAt = LocalDateTime.now();
    }

    /** The total the participant paid across all channels - handy for reports and the UI. */
    public BigDecimal getTotalPaid() {
        return paidCash.add(paidFromBalance);
    }
}
