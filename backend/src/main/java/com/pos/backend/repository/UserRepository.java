package com.pos.backend.repository;

import com.pos.backend.entity.Role;
import com.pos.backend.entity.User;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

// JpaRepository gives us save(), findById(), findAll(), delete() etc. for free.
// Spring generates the SQL from the method NAME - "findByEmail" becomes "SELECT * FROM users WHERE email = ?"
public interface UserRepository extends JpaRepository<User, Long> {

    Optional<User> findByEmail(String email); // Optional = "might not exist", forces us to handle the not-found case

    boolean existsByRole(Role role); // used by the seeder to check if a SUPER_ADMIN already exists

    List<User> findByCampId(Long campId); // "camp.id" navigated through the relation - Spring figures out the JOIN
}
