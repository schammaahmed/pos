package com.pos.backend.entity;

// Three tiers, top to bottom:
//   SUPER_ADMIN - runs the whole system, oversees every camp, creates camp leads
//   CAMP_LEAD   - the "Stand-Leitung": runs ONE camp end to end (team, products,
//                 participants, cash, review) and may sell like anyone else
//   SELLER      - sells at the stand
// Earlier there were two overlapping middle roles (CAMP_ADMIN + SELLER_LEAD); they
// were merged into CAMP_LEAD - see RoleMigration for how existing rows are moved.
public enum Role {
    SUPER_ADMIN,
    CAMP_LEAD,
    SELLER
}
