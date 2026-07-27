package com.pos.backend.entity;

import jakarta.persistence.*;
import lombok.Data;
import lombok.ToString;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;

// One completed checkout (a whole basket, not a single item).
// The four paid* fields describe HOW the total was covered - they always add up:
// totalAmount = paidCash + paidFromBalance + debtAmount   (extraCredited is on top of cash)
@Data
@Entity
@Table(name = "sales")
public class Sale {

    public enum Status {
        COMPLETED,
        REVERSED // undone - money/balance restored, kept in DB for the audit trail
    }

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ToString.Exclude
    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "camp_id")
    private Camp camp;

    // nullable: a visitor buying a coke with cash needs no participant account
    @ToString.Exclude
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "participant_id")
    private Participant participant;

    @ToString.Exclude
    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "seller_id")
    private User seller;

    // cascade = the items are saved/deleted together with their sale;
    // orphanRemoval = removing an item from this list deletes its row
    @ToString.Exclude
    @OneToMany(mappedBy = "sale", cascade = CascadeType.ALL, orphanRemoval = true)
    private List<SaleItem> items = new ArrayList<>();

    @Column(nullable = false, precision = 10, scale = 2)
    private BigDecimal totalAmount;

    @Column(nullable = false, precision = 10, scale = 2)
    private BigDecimal paidCash;

    @Column(nullable = false, precision = 10, scale = 2)
    private BigDecimal paidFromBalance;

    @Column(nullable = false, precision = 10, scale = 2)
    private BigDecimal debtAmount;

    // "keep the rest" - overpaid cash credited to the participant's balance
    @Column(nullable = false, precision = 10, scale = 2)
    private BigDecimal extraCredited;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private Status status = Status.COMPLETED;

    // set when a plain SELLER reverses a sale: the lead sees it in their review queue (requirement #4/#12)
    @Column(nullable = false)
    private boolean flaggedForReview = false;

    // who raised the concern and when - without this a flag is untraceable
    @ToString.Exclude
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "flagged_by")
    private User flaggedBy;

    private LocalDateTime flaggedAt;

    @ToString.Exclude
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "reversed_by")
    private User reversedBy;

    private LocalDateTime reversedAt;

    @ToString.Exclude
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "reviewed_by")
    private User reviewedBy;
    private LocalDateTime reviewedAt;

    @Column(updatable = false)
    private LocalDateTime createdAt;

    @PrePersist
    protected void onCreate() {
        createdAt = LocalDateTime.now();
    }
}
