# Camp POS — a point-of-sale system for youth camps

A full-stack point-of-sale application for the *Verkaufsstand* (kiosk) at Austrian summer and
winter camps. Kids pay with a prepaid balance, cash, or "on the tab"; camp leads run the stand
and its cash box; a super-admin oversees every camp from one place.

Built as a learning project to go deep on **Spring Boot**, **React**, and the design decisions
that make a small money-handling system trustworthy: strict data isolation between camps, an
audit trail on every change, and money math that never loses a cent.

**Stack:** Java 21 · Spring Boot 4.1 · Spring Security (JWT) · JPA/Hibernate · PostgreSQL ·
React 19 · Vite · Tailwind CSS 4 · React Router

<!-- Add screenshots to docs/screenshots/ and they'll render here -->
<!--
![Cross-camp overview](docs/screenshots/overview.png)
![The selling panel](docs/screenshots/seller-panel.png)
-->

---

## Highlights

- **Three-tier role model** — `SUPER_ADMIN` oversees all camps · `CAMP_LEAD` (Stand-Leitung)
  runs one camp end to end · `SELLER` works the till. Enforced server-side with Spring Security
  `@PreAuthorize` plus a fine-grained privilege layer in `UserService`.
- **Camp data isolation** — a single `CampAccess` service is the privacy boundary: every
  camp-scoped request resolves and verifies its camp, and a cross-camp id returns `404`, never
  another camp's data. The frontend can never "forget" to filter.
- **Amount-based checkout** — one basket is paid by any mix of prepaid balance → cash → debt,
  with overpaid cash optionally kept as credit ("stimmt so"). The split is pure, unit-tested
  math (`PaymentSplit`); anonymous cash sales can never go into debt.
- **Cash box (Kassenbuch)** with reconciliation — expected cash is *derived*, never stored
  (`Startgeld + Barverkäufe + Nachlagen − Entnahmen`), so it can't drift; a *Kassensturz*
  compares it against a physical count.
- **Review-before-cancel** — a plain seller can't silently undo a sale; their reversal is
  flagged for a lead to check. Nothing disappears unnoticed.
- **Audit trail** — every mutation (sale, reversal, cash movement, user change) is recorded by
  a service that never throws, so logging can't break the actual operation.
- **Super-admin cockpit** — a cross-camp overview (revenue, participants, open debt, cash per
  camp) with a top-bar camp switcher that scopes the whole app to one camp at a time.
- **Concurrency-safe** — optimistic locking (`@Version`) on participant balances; two sellers
  charging the same kid at once retry cleanly instead of losing money.
- **Quality-of-life** — first-login forced password change, Excel import of participants/
  products, CSV export of the sales log, a role-specific onboarding guide, and a responsive
  UI that works one-handed on a phone at the stand and full-width on a laptop.

## Architecture

```
backend/   Spring Boot REST API (port 8080)
  controller/   thin HTTP layer, @PreAuthorize role gates
  service/      business logic — CampAccess (isolation), PaymentSplit (money),
                CashService, SaleService, AuditService, OverviewService …
  entity/       JPA entities — Camp, Participant, Product, Sale, CashMovement,
                AuditLog, User, Role …
  repository/   Spring Data JPA
  config/       security, JWT, data seeding, one-off migrations

frontend/  React + Vite SPA (port 5173, proxies /api → 8080)
  pages/        Overview, SellerPanel, Participants, Products, SalesLog, Review, Admin
  components/   Layout, CampSwitcher, CashBox, OnboardingTour, dialogs, shared ui
  campContext   global "active camp" for super admins; api.js attaches the JWT + campId
```

**Key design decisions**

- *Server-side filtering only.* Camp isolation lives in `CampAccess`, never in the client — the
  UI can't leak another camp's data even with a hand-crafted request.
- *Derived over stored.* Cash expectations and balances are computed from source rows, so they
  stay correct by construction.
- *Soft over hard.* Users and sales are deactivated/reversed, not deleted, to keep history and
  the audit trail intact.
- *German UI, English code.* Labels are German for the people at the stand; code and comments
  are English and written to explain *why*, not just *what*.

## Tech stack

| Layer     | Tech |
|-----------|------|
| Backend   | Java 21, Spring Boot 4.1, Spring Security + JWT, Spring Data JPA / Hibernate, Bean Validation |
| Database  | PostgreSQL |
| Frontend  | React 19, Vite, React Router, Tailwind CSS 4, lucide-react icons |
| Testing   | JUnit 5 (backend), manual end-to-end verification against an isolated sandbox DB |

## Getting started

**Prerequisites:** Java 21, Node 18+, and Docker (for PostgreSQL).

**1. Start PostgreSQL**

```bash
docker run --name pos-db -e POSTGRES_PASSWORD=postgres -e POSTGRES_DB=posdb \
  -p 5432:5432 -d postgres:16
```

**2. Configure the backend**

`backend/src/main/resources/application.properties` is gitignored (it holds DB and JWT
config). Create it with:

```properties
spring.datasource.url=jdbc:postgresql://localhost:5432/posdb
spring.datasource.username=postgres
spring.datasource.password=postgres
spring.jpa.hibernate.ddl-auto=update

app.jwt.secret=change-me-to-a-long-random-string
app.jwt.expiration-ms=43200000
```

**3. Run the backend**

```bash
cd backend
./mvnw spring-boot:run        # http://localhost:8080
```

On first start it seeds a super-admin: **admin@pos.local / admin123** (you're forced to change
the password at first login).

**4. Run the frontend**

```bash
cd frontend
npm install
npm run dev                   # http://localhost:5173
```

Log in as the seeded admin, create a camp, invite a Stand-Leitung, add products and
participants — and you're selling.

## Roles at a glance

| Role | Sees / can do |
|------|---------------|
| **Super-Admin** | Cross-camp overview; create/close camps; switch into any camp and do anything within it |
| **Stand-Leitung** (`CAMP_LEAD`) | Runs one camp: team, products, participants, cash box, review queue — and can sell |
| **Verkäufer:in** (`SELLER`) | Works the till; can flag a sale for review but not undo it |

## Tests

```bash
cd backend && ./mvnw test
```

Covers the payment-split math and application wiring. UI flows are verified end to end against
an isolated sandbox database (a separate profile/port) so verification never touches dev data.

## How I built this

This is a solo learning project. I drove the design and the decisions — the domain model, the
camp-isolation and money-handling rules, the role model, the feature roadmap — and used an AI
coding assistant as a hands-on **senior/mentor**: to pair on implementation, explain trade-offs,
and review my work as I learned Spring Boot and modern React. The comments throughout the code
reflect that: they explain the reasoning, the way a good mentor would.
