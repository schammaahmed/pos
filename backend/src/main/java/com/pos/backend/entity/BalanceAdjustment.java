package com.pos.backend.entity;

import jakarta.persistence.*;
import lombok.Data;
import lombok.ToString;

import java.math.BigDecimal;
import java.time.LocalDateTime;

// Every balance change that is NOT a sale: deposits ("here is 10€ for the week")
// and debt settlements at the end of camp. Gives us a full audit trail -
// the balance number alone can't tell you WHERE the money came from.
@Data
@Entity
@Table(name = "balance_adjustments")
public class BalanceAdjustment {

    public enum Type {
        DEPOSIT,         // participant hands over cash to top up their balance
        DEBT_SETTLEMENT  // open debt collected/erased at the end of camp
    }

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ToString.Exclude
    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "participant_id")
    private Participant participant;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private Type type;

    // the amount the balance CHANGED by (deposit: +10.00, settlement of -7€ debt: +7.00)
    @Column(nullable = false, precision = 10, scale = 2)
    private BigDecimal amount;

    // who performed it - accountability when cash is involved
    @ToString.Exclude
    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "created_by")
    private User createdBy;

    @Column(updatable = false)
    private LocalDateTime createdAt;

    @PrePersist
    protected void onCreate() {
        createdAt = LocalDateTime.now();
    }
}
