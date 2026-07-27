package com.pos.backend.entity;

import jakarta.persistence.*;
import lombok.Data;
import lombok.ToString;

import java.time.LocalDateTime;

@Data // Lombok magic. Automatically generates getters, setters, toString, equals. Without Lombok you´d write 50 lines of boilerplate code manually.
@Entity // tells Spring Boot "this class is a database table"
@Table (name = "users") // actual table name in PostgreSQL

public class User {

    @Id // This field is the primary key
    @GeneratedValue(strategy = GenerationType.IDENTITY) // PostgreSQL auto increments the ID, you never set it manually
    private Long id;

    @Column(nullable = false) // this field is required, cant be empty in the database
    private String firstName;

    @Column(nullable = false)
    private String lastName;

    @Column (nullable = false, unique = true) // unique == true -> no users can have the same email
    private String email;

    @Column(nullable = false)
    private String password;

    @Enumerated(EnumType.STRING) // stores the role as text ("ADMIN") not a number in the database - always use STRING not ORDINAL, otherwise adding new roles breaks everything
    @Column(nullable = false)
    private Role role;

    // Which camp this user belongs to. Nullable on purpose: a SUPER_ADMIN belongs to no camp and sees everything.
    // EAGER (not LAZY) because the logged-in user is loaded inside the JWT filter, BEFORE the request's
    // database session exists - a lazy camp would blow up with LazyInitializationException when accessed later.
    @ToString.Exclude // @Data generates toString - excluding relations avoids surprise DB queries when the user gets logged
    @ManyToOne(fetch = FetchType.EAGER)
    @JoinColumn(name = "camp_id")
    private Camp camp;

    @Column(nullable = false)
    private boolean active = true;

    // true = the password was set by an admin (or the seeder), not by the user themselves.
    // The frontend blocks everything until the user picks their own password.
    // columnDefinition with DEFAULT: ddl-auto=update adds this column to the EXISTING users
    // table - without a default, Postgres refuses a NOT NULL column on non-empty tables.
    // (Proper migrations/Flyway will replace this trick in a later milestone.)
    @Column(nullable = false, columnDefinition = "boolean not null default false")
    private boolean mustChangePassword = false;

    // null = invited but never signed in yet. Lets an admin see at a glance whether
    // someone has actually picked up their invite.
    private LocalDateTime lastLoginAt;

    @Column(updatable = false)
    private LocalDateTime createdAt;

    @PrePersist // runs automatically before saving to database. Sets createdAt timestamp so you never have to do it manually.
    protected void onCreate(){
        createdAt = LocalDateTime.now();
    }

    /** Leadership = can oversee a camp (review, cash, team). Used for auto-acknowledging
     *  a cancellation they performed themselves - they ARE the oversight. */
    public boolean isLeadership() {
        return role == Role.SUPER_ADMIN || role == Role.CAMP_LEAD;
    }
}
