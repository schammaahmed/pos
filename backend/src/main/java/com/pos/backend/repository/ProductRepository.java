package com.pos.backend.repository;

import com.pos.backend.entity.Product;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface ProductRepository extends JpaRepository<Product, Long> {

    List<Product> findByCampIdOrderByCategoryAscNameAsc(Long campId);

    List<Product> findByCampIdAndActiveTrueOrderByCategoryAscNameAsc(Long campId);
}
