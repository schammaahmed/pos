package com.pos.backend.dto;

import java.math.BigDecimal;
import java.util.List;

// Excel import happens in two steps on purpose: upload -> preview -> confirm.
// A silent one-shot import is how 60 wrong participants end up in the database.
public class ImportDtos {

    /** What happened to a single spreadsheet row. */
    public enum RowStatus {
        OK,         // will be created
        DUPLICATE,  // already exists - skipped, not an error
        ERROR       // unusable (missing name, unparseable price, ...)
    }

    public record ParticipantRow(
            int row,                 // 1-based row number in the sheet, so the user can find it
            String firstName,
            String lastName,
            String gender,           // "M" / "W" / null
            String phone,
            BigDecimal initialBalance,
            RowStatus status,
            String message           // why it is a duplicate or an error
    ) {}

    public record ProductRow(
            int row,
            String name,
            BigDecimal price,
            String category,
            String imageUrl,
            RowStatus status,
            String message
    ) {}

    public record ParticipantPreview(List<ParticipantRow> rows, int okCount, int duplicateCount, int errorCount) {}

    public record ProductPreview(List<ProductRow> rows, int okCount, int duplicateCount, int errorCount) {}

    /** Result of actually writing the confirmed rows. */
    public record ImportResult(int created, int skipped) {}
}
