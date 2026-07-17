package com.pos.backend.entity;

import jakarta.persistence.*;
import lombok.Data;

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

    @Column(nullable = false)
    private boolean active = true;

    @Column(updatable = false)
    private LocalDateTime createdAt;

    @PrePersist // runs automatically before saving to database. Sets createdAt timestamp so you never have to do it manually.
    protected void onCreate(){
        createdAt = LocalDateTime.now();
    }
}
