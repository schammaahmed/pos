package com.pos.backend.service;

import com.pos.backend.dto.ProductDtos.OptionRequest;
import com.pos.backend.dto.ProductDtos.ProductRequest;
import com.pos.backend.dto.ProductDtos.ProductResponse;
import com.pos.backend.entity.AuditLog.Action;
import com.pos.backend.entity.AuditLog.EntityType;
import com.pos.backend.entity.Camp;
import com.pos.backend.entity.Product;
import com.pos.backend.entity.ProductOption;
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
                .add("Bild", p.getImageUrl(), request.imageUrl())
                .add("Extras", optionSummary(p.getOptions()), optionSummary(request.options()));

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
        syncOptions(p, request.options());
    }

    // Reconcile the product's option list with the one in the request. Existing options
    // (matched by id) are updated in place so their id survives - orders snapshot the label,
    // but keeping ids stable avoids churn and keeps the audit diff meaningful. Missing ids
    // are removed (orphanRemoval deletes them), new ones are appended.
    private void syncOptions(Product p, List<OptionRequest> requested) {
        List<OptionRequest> reqs = requested == null ? List.of() : requested;

        // remove options no longer present in the request
        var keptIds = reqs.stream().map(OptionRequest::id).filter(java.util.Objects::nonNull).collect(java.util.stream.Collectors.toSet());
        p.getOptions().removeIf(existing -> !keptIds.contains(existing.getId()));

        int order = 0;
        for (OptionRequest r : reqs) {
            ProductOption target = r.id() == null ? null
                    : p.getOptions().stream().filter(o -> r.id().equals(o.getId())).findFirst().orElse(null);
            if (target == null) {
                target = new ProductOption();
                target.setProduct(p);
                p.getOptions().add(target);
            }
            target.setName(r.name().trim());
            target.setSurcharge(r.surcharge());
            target.setSortOrder(order++);
        }
    }

    /** "Ketchup, Mayo (+0,50 €)" style summary for the audit diff. */
    private static String optionSummary(List<?> options) {
        if (options == null || options.isEmpty()) return null;
        return options.stream().map(o -> {
            if (o instanceof ProductOption po) return label(po.getName(), po.getSurcharge());
            OptionRequest r = (OptionRequest) o;
            return label(r.name(), r.surcharge());
        }).collect(java.util.stream.Collectors.joining(", "));
    }

    private static String label(String name, java.math.BigDecimal surcharge) {
        return surcharge != null && surcharge.signum() > 0
                ? name + " (+" + surcharge.setScale(2, java.math.RoundingMode.HALF_UP) + " €)"
                : name;
    }

    private Product loadChecked(User currentUser, Long id) {
        Product p = productRepository.findById(id)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Not found"));
        campAccess.checkSameCamp(currentUser, p.getCamp());
        return p;
    }
}
