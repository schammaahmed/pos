package com.pos.backend.service;

import com.pos.backend.dto.ProductDtos.ProductRequest;
import com.pos.backend.dto.ProductDtos.ProductResponse;
import com.pos.backend.entity.AuditLog.Action;
import com.pos.backend.entity.AuditLog.EntityType;
import com.pos.backend.entity.Camp;
import com.pos.backend.entity.Product;
import com.pos.backend.entity.User;
import com.pos.backend.repository.ProductRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.web.server.ResponseStatusException;

import java.util.List;

@Service
@RequiredArgsConstructor
public class ProductService {

    private final ProductRepository productRepository;
    private final CampAccess campAccess;
    private final AuditService auditService;

    // activeOnly=true is what the seller panel uses (only sellable things),
    // admins pass false to also see deactivated products
    public List<ProductResponse> list(User currentUser, Long campId, boolean activeOnly) {
        Camp camp = campAccess.resolveCamp(currentUser, campId);
        List<Product> products = activeOnly
                ? productRepository.findByCampIdAndActiveTrueOrderByCategoryAscNameAsc(camp.getId())
                : productRepository.findByCampIdOrderByCategoryAscNameAsc(camp.getId());
        return products.stream().map(ProductResponse::from).toList();
    }

    public ProductResponse create(User currentUser, Long campId, ProductRequest request) {
        Camp camp = campAccess.resolveCamp(currentUser, campId);
        campAccess.checkCampActive(camp);

        Product p = new Product();
        applyRequest(p, request);
        p.setCamp(camp);
        Product saved = productRepository.save(p);

        auditService.record(currentUser, camp, EntityType.PRODUCT, saved.getId(), saved.getName(),
                Action.CREATED, "Preis: " + saved.getPrice() + " €"
                        + (saved.getCategory() != null ? "; Kategorie: " + saved.getCategory() : ""));
        return ProductResponse.from(saved);
    }

    public ProductResponse update(User currentUser, Long id, ProductRequest request) {
        Product p = loadChecked(currentUser, id);

        // capture the before-values so the log can say what actually changed
        var diff = new AuditService.Diff()
                .add("Name", p.getName(), request.name() == null ? null : request.name().trim())
                .money("Preis", p.getPrice(), request.price())
                .add("Kategorie", p.getCategory(), request.category())
                .add("Bild", p.getImageUrl(), request.imageUrl());

        applyRequest(p, request);
        Product saved = productRepository.save(p);

        if (!diff.isEmpty()) {
            auditService.record(currentUser, saved.getCamp(), EntityType.PRODUCT, saved.getId(),
                    saved.getName(), Action.UPDATED, diff.text());
        }
        return ProductResponse.from(saved);
    }

    public ProductResponse setActive(User currentUser, Long id, boolean active) {
        Product p = loadChecked(currentUser, id);
        p.setActive(active);
        Product saved = productRepository.save(p);

        auditService.record(currentUser, saved.getCamp(), EntityType.PRODUCT, saved.getId(),
                saved.getName(), active ? Action.ACTIVATED : Action.DEACTIVATED);
        return ProductResponse.from(saved);
    }

    private void applyRequest(Product p, ProductRequest request) {
        p.setName(request.name().trim());
        p.setPrice(request.price());
        p.setCategory(request.category());
        p.setImageUrl(request.imageUrl());
    }

    private Product loadChecked(User currentUser, Long id) {
        Product p = productRepository.findById(id)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Not found"));
        campAccess.checkSameCamp(currentUser, p.getCamp());
        return p;
    }
}
