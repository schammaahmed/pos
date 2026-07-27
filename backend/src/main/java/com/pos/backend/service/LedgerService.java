package com.pos.backend.service;

import com.pos.backend.dto.LedgerDtos.LedgerEntry;
import com.pos.backend.entity.Camp;
import com.pos.backend.entity.User;
import com.pos.backend.repository.PreOrderRepository;
import com.pos.backend.repository.SaleRepository;
import com.pos.backend.repository.SpecialOrderRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;

// Assembles the unified sales-log ledger: over-the-counter Sales + collected Aktionen +
// picked-up Vorbestellungen, newest first. One camp-scoped read, three streams merged.
@Service
@RequiredArgsConstructor
public class LedgerService {

    private final SaleRepository saleRepository;
    private final SpecialOrderRepository specialOrderRepository;
    private final PreOrderRepository preOrderRepository;
    private final CampAccess campAccess;

    public List<LedgerEntry> list(User currentUser, Long campId) {
        Camp camp = campAccess.resolveCamp(currentUser, campId);
        Long id = camp.getId();

        List<LedgerEntry> entries = new ArrayList<>();
        saleRepository.findByCampIdOrderByCreatedAtDesc(id)
                .forEach(s -> entries.add(LedgerEntry.ofSale(s)));
        specialOrderRepository.findCollectedByCamp(id)
                .forEach(o -> entries.add(LedgerEntry.ofSpecial(o)));
        preOrderRepository.findPickedUpByCamp(id)
                .forEach(o -> entries.add(LedgerEntry.ofPreOrder(o)));

        // Merge-sort by the moment money moved, newest first. timestamp can be null in
        // theory (a half-migrated row); nulls sort last rather than throwing.
        entries.sort(Comparator.comparing(LedgerEntry::timestamp,
                Comparator.nullsLast(Comparator.reverseOrder())));
        return entries;
    }
}
