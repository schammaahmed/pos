package com.pos.backend.entity;

import jakarta.persistence.*;
import lombok.Data;
import lombok.ToString;

import java.time.LocalDateTime;

// One line of "who did what, when". Written on every change so questions like
// "who changed the price of the Cola?" have an answer instead of a shrug.
//
// The label and the change text are stored as plain text on purpose: the log has
// to stay readable even after the product or participant it refers to is gone.
@Data
@Entity
@Table(name = "audit_logs", indexes = {
        @Index(name = "idx_audit_camp_created", columnList = "camp_id, createdAt"),
        @Index(name = "idx_audit_actor", columnList = "actor_id"),
        @Index(name = "idx_audit_entity", columnList = "entityType, entityId"),
})
public class AuditLog {

    public enum EntityType { PRODUCT, PARTICIPANT, SALE, USER, CAMP, SPECIAL, SPECIAL_ORDER }

    public enum Action {
        CREATED, UPDATED, DELETED,
        ACTIVATED, DEACTIVATED,
        DEPOSIT, DEBT_SETTLED,
        SOLD, FLAGGED, REVERSED, REVIEWED,
        IMPORTED,
        RESERVED, COLLECTED, CANCELLED, CLOSED
    }

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    // nullable: user and camp management isn't tied to a single camp
    @ToString.Exclude
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "camp_id")
    private Camp camp;

    // who did it. Kept even if that account is later deactivated.
    @ToString.Exclude
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "actor_id")
    private User actor;

    // denormalised so the entry survives the actor being deleted
    @Column(nullable = false)
    private String actorName;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private EntityType entityType;

    private Long entityId;

    /** e.g. "Coca Cola", "Mira Muster" - what the row was called at the time. */
    @Column(nullable = false)
    private String entityLabel;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private Action action;

    /** Human readable diff, e.g. "Preis: 1,50 € → 1,80 €". Null for plain creates. */
    @Column(length = 1000)
    private String changes;

    @Column(updatable = false)
    private LocalDateTime createdAt;

    @PrePersist
    protected void onCreate() {
        createdAt = LocalDateTime.now();
    }
}
