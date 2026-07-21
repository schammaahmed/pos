package com.pos.backend.service;

import com.pos.backend.dto.ImportDtos.*;
import com.pos.backend.entity.Camp;
import com.pos.backend.entity.Participant;
import com.pos.backend.entity.Product;
import com.pos.backend.entity.User;
import com.pos.backend.repository.ParticipantRepository;
import com.pos.backend.repository.ProductRepository;
import lombok.RequiredArgsConstructor;
import org.apache.poi.ss.usermodel.*;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.multipart.MultipartFile;
import org.springframework.web.server.ResponseStatusException;

import java.io.IOException;
import java.io.InputStream;
import java.math.BigDecimal;
import java.util.*;

// Bulk import from the spreadsheets camp leaders already maintain.
// Parsing and writing are deliberately separate: parse() only reads and judges,
// commit() only writes rows that were judged OK, and re-checks them.
@Service
@RequiredArgsConstructor
public class ImportService {

    private final ParticipantRepository participantRepository;
    private final ProductRepository productRepository;
    private final CampAccess campAccess;

    // Column aliases: leaders name their columns in German or English, capitalised
    // or not. Everything is matched lower-case and without spaces.
    private static final Map<String, List<String>> PARTICIPANT_COLUMNS = Map.of(
            "firstName", List.of("vorname", "firstname", "first name"),
            "lastName", List.of("nachname", "lastname", "last name", "familienname"),
            "gender", List.of("geschlecht", "gender", "m/w"),
            "phone", List.of("telefon", "handy", "phone", "mobile", "telefonnummer"),
            "balance", List.of("guthaben", "balance", "startguthaben", "betrag")
    );

    private static final Map<String, List<String>> PRODUCT_COLUMNS = Map.of(
            "name", List.of("name", "produkt", "artikel", "product"),
            "price", List.of("preis", "price", "vk", "verkaufspreis"),
            "category", List.of("kategorie", "category", "gruppe"),
            "imageUrl", List.of("bild", "bild-url", "image", "imageurl", "foto")
    );

    // ---------------------------------------------------------------- participants
    public ParticipantPreview previewParticipants(User currentUser, Long campId, MultipartFile file) {
        Camp camp = campAccess.resolveCamp(currentUser, campId);

        // names already in this camp - used to flag duplicates instead of creating twins
        Set<String> existing = new HashSet<>();
        for (Participant p : participantRepository.findByCampIdOrderByLastNameAscFirstNameAsc(camp.getId())) {
            existing.add(nameKey(p.getFirstName(), p.getLastName()));
        }

        List<ParticipantRow> rows = new ArrayList<>();
        Set<String> seenInFile = new HashSet<>(); // the sheet can contain the same person twice

        withSheet(file, (sheet, columns) -> {
            Integer first = columns.get("firstName");
            Integer last = columns.get("lastName");
            if (first == null || last == null) {
                throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                        "Spalten 'Vorname' und 'Nachname' wurden nicht gefunden");
            }

            for (int i = sheet.getFirstRowNum() + 1; i <= sheet.getLastRowNum(); i++) {
                Row row = sheet.getRow(i);
                if (row == null || isBlankRow(row)) continue;

                int rowNumber = i + 1; // Excel is 1-based and shows the header as row 1
                String firstName = str(row, first);
                String lastName = str(row, last);

                if (firstName.isBlank() || lastName.isBlank()) {
                    rows.add(new ParticipantRow(rowNumber, firstName, lastName, null, null, null,
                            RowStatus.ERROR, "Vor- und Nachname sind Pflicht"));
                    continue;
                }

                BigDecimal balance = null;
                Integer balanceCol = columns.get("balance");
                if (balanceCol != null) {
                    try {
                        balance = number(row, balanceCol);
                    } catch (NumberFormatException e) {
                        rows.add(new ParticipantRow(rowNumber, firstName, lastName, null, null, null,
                                RowStatus.ERROR, "Guthaben ist keine Zahl: " + str(row, balanceCol)));
                        continue;
                    }
                }

                String gender = gender(str(row, columns.get("gender")));
                String phone = str(row, columns.get("phone"));
                String key = nameKey(firstName, lastName);

                RowStatus status = RowStatus.OK;
                String message = null;
                if (existing.contains(key)) {
                    status = RowStatus.DUPLICATE;
                    message = "Ist schon im Camp";
                } else if (!seenInFile.add(key)) {
                    status = RowStatus.DUPLICATE;
                    message = "Kommt in der Datei doppelt vor";
                }

                rows.add(new ParticipantRow(rowNumber, firstName, lastName, gender,
                        phone.isBlank() ? null : phone, balance, status, message));
            }
        });

        return new ParticipantPreview(rows, count(rows, ParticipantRow::status, RowStatus.OK),
                count(rows, ParticipantRow::status, RowStatus.DUPLICATE),
                count(rows, ParticipantRow::status, RowStatus.ERROR));
    }

    @Transactional
    public ImportResult commitParticipants(User currentUser, Long campId, List<ParticipantRow> rows) {
        Camp camp = campAccess.resolveCamp(currentUser, campId);
        campAccess.checkCampActive(camp);

        // re-check against the database: the preview may be minutes old
        Set<String> existing = new HashSet<>();
        for (Participant p : participantRepository.findByCampIdOrderByLastNameAscFirstNameAsc(camp.getId())) {
            existing.add(nameKey(p.getFirstName(), p.getLastName()));
        }

        int created = 0, skipped = 0;
        for (ParticipantRow row : rows) {
            String firstName = row.firstName() == null ? "" : row.firstName().trim();
            String lastName = row.lastName() == null ? "" : row.lastName().trim();
            if (firstName.isBlank() || lastName.isBlank() || !existing.add(nameKey(firstName, lastName))) {
                skipped++;
                continue;
            }

            Participant p = new Participant();
            p.setFirstName(firstName);
            p.setLastName(lastName);
            p.setPhone(row.phone());
            if (row.gender() != null) p.setGender(Participant.Gender.valueOf(row.gender()));
            // starting money is applied directly here; the balance column is a
            // statement of what they handed in at check-in
            if (row.initialBalance() != null && row.initialBalance().signum() > 0) {
                p.setBalance(row.initialBalance());
            }
            p.setCamp(camp);
            participantRepository.save(p);
            created++;
        }
        return new ImportResult(created, skipped);
    }

    // ---------------------------------------------------------------- products
    public ProductPreview previewProducts(User currentUser, Long campId, MultipartFile file) {
        Camp camp = campAccess.resolveCamp(currentUser, campId);

        Set<String> existing = new HashSet<>();
        for (Product p : productRepository.findByCampIdOrderByCategoryAscNameAsc(camp.getId())) {
            existing.add(p.getName().trim().toLowerCase());
        }

        List<ProductRow> rows = new ArrayList<>();
        Set<String> seenInFile = new HashSet<>();

        withSheet(file, (sheet, columns) -> {
            Integer nameCol = columns.get("name");
            Integer priceCol = columns.get("price");
            if (nameCol == null || priceCol == null) {
                throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                        "Spalten 'Name' und 'Preis' wurden nicht gefunden");
            }

            for (int i = sheet.getFirstRowNum() + 1; i <= sheet.getLastRowNum(); i++) {
                Row row = sheet.getRow(i);
                if (row == null || isBlankRow(row)) continue;

                int rowNumber = i + 1;
                String name = str(row, nameCol);
                if (name.isBlank()) {
                    rows.add(new ProductRow(rowNumber, name, null, null, null,
                            RowStatus.ERROR, "Name ist Pflicht"));
                    continue;
                }

                BigDecimal price;
                try {
                    price = number(row, priceCol);
                } catch (NumberFormatException e) {
                    rows.add(new ProductRow(rowNumber, name, null, null, null,
                            RowStatus.ERROR, "Preis ist keine Zahl: " + str(row, priceCol)));
                    continue;
                }
                if (price == null || price.signum() < 0) {
                    rows.add(new ProductRow(rowNumber, name, price, null, null,
                            RowStatus.ERROR, "Preis fehlt oder ist negativ"));
                    continue;
                }

                String category = str(row, columns.get("category"));
                String imageUrl = str(row, columns.get("imageUrl"));
                String key = name.trim().toLowerCase();

                RowStatus status = RowStatus.OK;
                String message = null;
                if (existing.contains(key)) {
                    status = RowStatus.DUPLICATE;
                    message = "Gibt es schon";
                } else if (!seenInFile.add(key)) {
                    status = RowStatus.DUPLICATE;
                    message = "Kommt in der Datei doppelt vor";
                }

                rows.add(new ProductRow(rowNumber, name.trim(), price,
                        category.isBlank() ? null : category.trim(),
                        imageUrl.isBlank() ? null : imageUrl.trim(), status, message));
            }
        });

        return new ProductPreview(rows, count(rows, ProductRow::status, RowStatus.OK),
                count(rows, ProductRow::status, RowStatus.DUPLICATE),
                count(rows, ProductRow::status, RowStatus.ERROR));
    }

    @Transactional
    public ImportResult commitProducts(User currentUser, Long campId, List<ProductRow> rows) {
        Camp camp = campAccess.resolveCamp(currentUser, campId);
        campAccess.checkCampActive(camp);

        Set<String> existing = new HashSet<>();
        for (Product p : productRepository.findByCampIdOrderByCategoryAscNameAsc(camp.getId())) {
            existing.add(p.getName().trim().toLowerCase());
        }

        int created = 0, skipped = 0;
        for (ProductRow row : rows) {
            String name = row.name() == null ? "" : row.name().trim();
            if (name.isBlank() || row.price() == null || row.price().signum() < 0
                    || !existing.add(name.toLowerCase())) {
                skipped++;
                continue;
            }

            Product p = new Product();
            p.setName(name);
            p.setPrice(row.price());
            p.setCategory(row.category());
            p.setImageUrl(row.imageUrl());
            p.setCamp(camp);
            productRepository.save(p);
            created++;
        }
        return new ImportResult(created, skipped);
    }

    // ---------------------------------------------------------------- sheet plumbing
    @FunctionalInterface
    private interface SheetReader {
        void read(Sheet sheet, Map<String, Integer> columns);
    }

    /** Opens the first sheet, maps its header row to column indexes, hands both over. */
    private void withSheet(MultipartFile file, SheetReader reader) {
        if (file == null || file.isEmpty()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Keine Datei hochgeladen");
        }
        try (InputStream in = file.getInputStream(); Workbook workbook = WorkbookFactory.create(in)) {
            Sheet sheet = workbook.getSheetAt(0);
            if (sheet == null || sheet.getPhysicalNumberOfRows() == 0) {
                throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Die Datei ist leer");
            }
            reader.read(sheet, mapColumns(sheet.getRow(sheet.getFirstRowNum())));
        } catch (ResponseStatusException e) {
            throw e;
        } catch (IOException | RuntimeException e) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                    "Datei konnte nicht gelesen werden - ist es eine .xlsx-Datei? (" + e.getMessage() + ")");
        }
    }

    /** Matches header cells against BOTH alias tables, so one reader serves both imports. */
    private Map<String, Integer> mapColumns(Row header) {
        Map<String, Integer> found = new HashMap<>();
        if (header == null) return found;

        for (int c = header.getFirstCellNum(); c < header.getLastCellNum(); c++) {
            String label = str(header, c).trim().toLowerCase().replace(" ", "");
            if (label.isEmpty()) continue;

            for (var table : List.of(PARTICIPANT_COLUMNS, PRODUCT_COLUMNS)) {
                for (var entry : table.entrySet()) {
                    boolean matches = entry.getValue().stream()
                            .anyMatch(alias -> alias.replace(" ", "").equals(label));
                    if (matches) found.putIfAbsent(entry.getKey(), c);
                }
            }
        }
        return found;
    }

    private static String str(Row row, Integer col) {
        if (col == null) return "";
        Cell cell = row.getCell(col, Row.MissingCellPolicy.RETURN_BLANK_AS_NULL);
        if (cell == null) return "";
        return switch (cell.getCellType()) {
            case STRING -> cell.getStringCellValue().trim();
            // a whole number typed into Excel comes back as 5.0 - don't show "5.0" to the user
            case NUMERIC -> {
                double d = cell.getNumericCellValue();
                yield d == Math.floor(d) ? String.valueOf((long) d) : String.valueOf(d);
            }
            case BOOLEAN -> String.valueOf(cell.getBooleanCellValue());
            case FORMULA -> {
                try {
                    yield cell.getStringCellValue().trim();
                } catch (IllegalStateException e) {
                    yield String.valueOf(cell.getNumericCellValue());
                }
            }
            default -> "";
        };
    }

    /** Accepts "1,50" as well as "1.50" and "€ 1,50" - people type prices freely. */
    private static BigDecimal number(Row row, Integer col) {
        if (col == null) return null;
        Cell cell = row.getCell(col, Row.MissingCellPolicy.RETURN_BLANK_AS_NULL);
        if (cell == null) return null;
        if (cell.getCellType() == CellType.NUMERIC) {
            return BigDecimal.valueOf(cell.getNumericCellValue());
        }
        String raw = str(row, col).replace("€", "").replace(" ", "").replace(",", ".");
        if (raw.isBlank()) return null;
        return new BigDecimal(raw); // NumberFormatException is caught by the caller
    }

    private static String gender(String raw) {
        if (raw == null) return null;
        String g = raw.trim().toLowerCase();
        if (g.startsWith("m") || g.startsWith("j")) return "M";       // männlich / male / Junge
        if (g.startsWith("w") || g.startsWith("f")) return "W";       // weiblich / female / Mädchen
        return null;
    }

    private static String nameKey(String first, String last) {
        return (first + "|" + last).trim().toLowerCase();
    }

    private static boolean isBlankRow(Row row) {
        for (int c = row.getFirstCellNum(); c >= 0 && c < row.getLastCellNum(); c++) {
            if (!str(row, c).isBlank()) return false;
        }
        return true;
    }

    private static <T> int count(List<T> rows, java.util.function.Function<T, RowStatus> get, RowStatus status) {
        return (int) rows.stream().filter(r -> get.apply(r) == status).count();
    }
}
