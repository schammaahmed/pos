package com.pos.backend.entity;

import jakarta.persistence.*;
import lombok.Data;
import lombok.ToString;

import java.math.BigDecimal;
import java.time.LocalDateTime;

// Money moving in or out of the physical cash box that ISN'T a sale: topping up
// change during the day, or taking cash out to bank it. Together with the camp's
// starting float and the cash taken in sales, this is the camp's Kassenbuch.
@Data
@Entity
@Table(name = "cash_movements")
public class CashMovement {

    // amount is always stored positive; the type says which direction it went
    public enum Type {
        DEPOSIT,   // Nachlegen - more change put into the box
        WITHDRAWAL // Entnahme - cash taken out (e.g. banked)
    }

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ToString.Exclude
    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "camp_id")
    private Camp camp;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private Type type;

    @Column(nullable = false, precision = 10, scale = 2)
    private BigDecimal amount;

    private String note; // "gewechselt bei der Bank", "Tageslosung entnommen", ...

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
