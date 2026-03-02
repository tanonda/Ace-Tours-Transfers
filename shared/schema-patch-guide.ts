// ─── ADD THESE FIELDS to the tours pgTable definition in shared/schema.ts ────
//
// Drop this block into the tours table definition after `childPriceCents`:
//
//   pricingType: text("pricing_type").notNull().default("per_person"),
//     // 'per_person' | 'group'
//   groupPriceCents: integer("group_price_cents").notNull().default(0),
//     // Flat rate for entire booking (VUV units). Used when pricingType === 'group'.
//   groupMaxPax: integer("group_max_pax"),
//     // Optional display hint: "up to N guests". Does not enforce a limit.
//
// ─── FULL PATCH (replace existing tours column block) ─────────────────────────

/*
  Example of updated tours table (relevant columns only):

  export const tours = pgTable("tours", {
    id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
    title: text("title").notNull(),
    price: text("price").notNull(),       // DEPRECATED: use adultPriceCents
    childPrice: text("child_price"),      // DEPRECATED: use childPriceCents
    adultPriceCents: integer("adult_price_cents").notNull().default(0),
    childPriceCents: integer("child_price_cents").notNull().default(0),

    // ── NEW: Pricing model ──────────────────────────────────────────────────
    pricingType: text("pricing_type").notNull().default("per_person"),
    //  'per_person' → adultPriceCents × adults + childPriceCents × children
    //  'group'      → flat groupPriceCents for the entire booking
    groupPriceCents: integer("group_price_cents").notNull().default(0),
    groupMaxPax: integer("group_max_pax"),
    // ────────────────────────────────────────────────────────────────────────

    duration: text("duration").notNull(),
    minPax: text("min_pax"),
    image: text("image").notNull(),
    description: text("description").array().notNull(),
    category: text("category").notNull(),
    isActive: boolean("is_active").notNull().default(true),
    capacity: integer("capacity").notNull().default(999),       // DEPRECATED
    defaultCapacity: integer("default_capacity").notNull().default(20),
    vehicleDetails: jsonb("vehicle_details"),
  });
*/

// ─── Zod type extension ───────────────────────────────────────────────────────
// In shared/schema.ts, the insertTourSchema and Tour type will automatically
// pick up the new columns once the pgTable definition is updated.
// No manual Zod changes required.

export {}; // This file is a patch guide — actual changes go in shared/schema.ts
