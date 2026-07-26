package com.pos.backend.entity;

import jakarta.persistence.*;
import lombok.Data;
import lombok.ToString;

import java.math.BigDecimal;
import java.time.LocalDateTime;

// A self-serve pre-order: a participant scans the stand QR, picks a Product, and asks
// for it to be ready at a specific time. Different from SpecialOrder (which reserves a
// planned camp-wide *Aktion*): a PreOrder is any regular Product, chosen by the kid.
//
// Payment happens at pickup, exactly like SpecialOrder.collect - the split (cash / balance /
// debt) is applied then and stored on this row, so CashService can sum both streams into
// the Kassenbuch consistently.
//
// Product name + unit price are SNAPSHOTTED so the line survives a product being renamed,
// re-priced or deactivated after the order was placed.
@Data
@Entity
@Table(name = "pre_orders", indexes = {
        @Index(name = "idx_preorder_camp", columnList = "camp_id"),
        @Index(name = "idx_preorder_participant", columnList = "participant_id"),
        @Index(name = "idx_preorder_status", columnList = "status"),
})
public class PreOrder {

    // Lifecycle:
    //   NEW          participant placed it, nothing done yet
    //   IN_PROGRESS  a seller/kitchen picked it up and started preparing
    //   READY        prepared, waiting for the participant to collect
    //   PICKED_UP    handed out + paid (terminal, revenue counted here)
    //   CANCELLED    dropped before pickup (terminal, no money moves)
    // Fast-forward paths are allowed for items that need no prep — e.g. a Snickers goes
    // NEW → PICKED_UP directly. See PreOrderService.transition() for the guardrails.
    public enum Status { NEW, IN_PROGRESS, READY, PICKED_UP, CANCELLED }

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    // Denormalised camp link so the queries don't have to walk through participant/product
    // to filter by camp - the isolation boundary should be one hop, not three.
    @ToString.Exclude
    @ManyToOne(optional = false, fetch = FetchType.LAZY)
    @JoinColumn(name = "camp_id", nullable = false)
    private Camp camp;

    @ToString.Exclude
    @ManyToOne(optional = false, fetch = FetchType.LAZY)
    @JoinColumn(name = "participant_id", nullable = false)
    private Participant participant;

    // Optional link to the source Product - stays for reference / reports, but the
    // name + price snapshot is what the row actually shows and charges.
    @ToString.Exclude
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "product_id")
    private Product product;

    @Column(nullable = false)
    private String productName;

    @Column(nullable = false, precision = 10, scale = 2)
    private BigDecimal unitPrice;

    @Column(nullable = false)
    private int quantity = 1;

    // When the participant wants to pick it up. Free-form time; staff sort the queue by it.
    private LocalDateTime requestedFor;

    // Optional free-text note the participant can add ("ohne Zwiebel").
    @Column(length = 300)
    private String note;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private Status status = Status.NEW;

    // Payment split filled at pickup. Same shape as Sale / SpecialOrder so the cash-box
    // maths and any future revenue view can treat all three streams uniformly.
    @Column(precision = 10, scale = 2, columnDefinition = "numeric(10,2) not null default 0")
    private BigDecimal paidCash = BigDecimal.ZERO;

    @Column(precision = 10, scale = 2, columnDefinition = "numeric(10,2) not null default 0")
    private BigDecimal paidFromBalance = BigDecimal.ZERO;

    @Column(precision = 10, scale = 2, columnDefinition = "numeric(10,2) not null default 0")
    private BigDecimal debtAmount = BigDecimal.ZERO;

    @Column(precision = 10, scale = 2, columnDefinition = "numeric(10,2) not null default 0")
    private BigDecimal extraCredited = BigDecimal.ZERO;

    @ToString.Exclude
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "started_by")
    private User startedBy;

    @ToString.Exclude
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "ready_by")
    private User readyBy;

    @ToString.Exclude
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "picked_up_by")
    private User pickedUpBy;

    @Column(updatable = false)
    private LocalDateTime createdAt;
    private LocalDateTime startedAt;
    private LocalDateTime readyAt;
    private LocalDateTime pickedUpAt;
    private LocalDateTime cancelledAt;

    @PrePersist
    protected void onCreate() {
        createdAt = LocalDateTime.now();
    }

    /** The row's total, computed from the snapshot. */
    public BigDecimal totalAmount() {
        return unitPrice.multiply(BigDecimal.valueOf(quantity));
    }
}
