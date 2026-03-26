/**
 * server/lib/product-translation.service.ts
 *
 * Resolves translated product content for a given locale.
 *
 * Strategy:
 *  - English ("en") → return products unchanged (English is the source of truth).
 *  - Other locales  → fetch matching rows from product_translations and merge
 *    translated fields over the base product, field-by-field. If a translation
 *    row doesn't exist for a product, the English fallback is returned silently.
 *
 * Usage (in routes.ts):
 *
 *   import { withProductTranslations } from "./lib/product-translation.service.js";
 *
 *   app.get("/api/products", async (req, res) => {
 *     const locale = (req.query.locale as string) || "en";
 *     const list   = await storage.getProducts();
 *     res.json(await withProductTranslations(list, locale));
 *   });
 */

import { db } from "../db.js";
import { productTranslations } from "../../shared/schema.js";
import { inArray, eq, and } from "drizzle-orm";
import { translateText, AUTO_TRANSLATE_TARGETS } from "./translate.js";
import type { Product } from "../../shared/schema.js";

/** Locales that the auto-translate service can handle. */
const AUTO_LOCALES = new Set(AUTO_TRANSLATE_TARGETS);

// ─── Core resolver ────────────────────────────────────────────────────────────

/**
 * Merge translation rows into a product array for the requested locale.
 * Returns the original array untouched for English.
 */
export async function withProductTranslations(
  products: Product[],
  locale: string,
): Promise<Product[]> {
  // English is the canonical source — nothing to merge.
  if (!locale || locale === "en") return products;
  if (products.length === 0) return products;

  const ids = products.map((p) => p.id);

  const rows = await db
    .select()
    .from(productTranslations)
    .where(
      and(
        inArray(productTranslations.productId, ids),
        eq(productTranslations.locale, locale),
      ),
    );

  // Build a fast lookup by productId.
  const byProductId = new Map(rows.map((r) => [r.productId, r]));

  return products.map((product) => {
    const t = byProductId.get(product.id);
    if (!t) return product; // graceful fallback: serve English

    return {
      ...product,
      // Only override a field when the translation is non-null / non-empty.
      title:              t.title              ?? product.title,
      description:        t.description        ?? product.description,
      itineraryIntro:     t.itineraryIntro     ?? product.itineraryIntro,
      pickupInstructions: t.pickupInstructions ?? product.pickupInstructions,
      meetingPoint:       t.meetingPoint       ?? product.meetingPoint,
      operatingHours:     t.operatingHours     ?? product.operatingHours,
      cancellationPolicy: t.cancellationPolicy ?? product.cancellationPolicy,
      includedItems:      t.includedItems      ?? product.includedItems,
      excludedItems:      t.excludedItems      ?? product.excludedItems,
      additionalInfo:     t.additionalInfo     ?? product.additionalInfo,
    } as Product;
  });
}

// ─── Auto-translation helper ──────────────────────────────────────────────────

/**
 * Auto-translate all translatable text fields for a single product into every
 * supported locale (fr, es, zh) and upsert the results into product_translations.
 *
 * Bislama ("bi") is intentionally skipped — it must be entered manually because
 * Google Translate does not support it.
 *
 * Called from the admin route:
 *   POST /api/admin/products/:id/auto-translate
 */
export async function autoTranslateProduct(product: Product): Promise<void> {
  const targets = AUTO_TRANSLATE_TARGETS; // ['fr', 'es', 'zh']

  await Promise.all(
    targets.map(async (locale) => {
      try {
        // Translate in parallel for each field.
        const [
          title,
          itineraryIntro,
          pickupInstructions,
          meetingPoint,
          operatingHours,
          cancellationPolicy,
          ...descriptionParts
        ] = await Promise.all([
          translateText(product.title, locale),
          product.itineraryIntro
            ? translateText(product.itineraryIntro, locale)
            : Promise.resolve(null),
          product.pickupInstructions
            ? translateText(product.pickupInstructions, locale)
            : Promise.resolve(null),
          product.meetingPoint
            ? translateText(product.meetingPoint, locale)
            : Promise.resolve(null),
          product.operatingHours
            ? translateText(product.operatingHours, locale)
            : Promise.resolve(null),
          product.cancellationPolicy
            ? translateText(product.cancellationPolicy, locale)
            : Promise.resolve(null),
          // Translate each description paragraph individually.
          ...(product.description ?? []).map((d) => translateText(d, locale)),
        ]);

        // Translate array fields.
        const includedItems = product.includedItems?.length
          ? await Promise.all(product.includedItems.map((s) => translateText(s, locale)))
          : null;

        const excludedItems = product.excludedItems?.length
          ? await Promise.all(product.excludedItems.map((s) => translateText(s, locale)))
          : null;

        const additionalInfo = product.additionalInfo?.length
          ? await Promise.all(product.additionalInfo.map((s) => translateText(s, locale)))
          : null;

        // Upsert — create or overwrite the row for this (product, locale) pair.
        await db
          .insert(productTranslations)
          .values({
            productId:          product.id,
            locale,
            title,
            description:        descriptionParts.length ? descriptionParts : null,
            itineraryIntro:     itineraryIntro     ?? null,
            pickupInstructions: pickupInstructions ?? null,
            meetingPoint:       meetingPoint       ?? null,
            operatingHours:     operatingHours     ?? null,
            cancellationPolicy: cancellationPolicy ?? null,
            includedItems:      includedItems      ?? null,
            excludedItems:      excludedItems      ?? null,
            additionalInfo:     additionalInfo     ?? null,
          })
          .onConflictDoUpdate({
            target: [productTranslations.productId, productTranslations.locale],
            set: {
              title,
              description:        descriptionParts.length ? descriptionParts : null,
              itineraryIntro:     itineraryIntro     ?? null,
              pickupInstructions: pickupInstructions ?? null,
              meetingPoint:       meetingPoint       ?? null,
              operatingHours:     operatingHours     ?? null,
              cancellationPolicy: cancellationPolicy ?? null,
              includedItems:      includedItems      ?? null,
              excludedItems:      excludedItems      ?? null,
              additionalInfo:     additionalInfo     ?? null,
              updatedAt:          new Date(),
            },
          });
      } catch (err: any) {
        // Log but don't throw — a failure for one locale shouldn't abort others.
        console.error(
          `[PRODUCT TRANSLATE] Failed for product=${product.id} locale=${locale}:`,
          err?.message,
        );
      }
    }),
  );
}

// ─── Manual upsert (for admin translation editor) ────────────────────────────

/**
 * Save or update a manually-entered translation for a specific locale.
 * Used by the admin translation editor panel.
 */
export async function upsertProductTranslation(data: {
  productId: string;
  locale: string;
  fields: Partial<{
    title: string;
    description: string[];
    itineraryIntro: string;
    pickupInstructions: string;
    meetingPoint: string;
    operatingHours: string;
    cancellationPolicy: string;
    includedItems: string[];
    excludedItems: string[];
    additionalInfo: string[];
  }>;
}): Promise<void> {
  await db
    .insert(productTranslations)
    .values({
      productId:  data.productId,
      locale:     data.locale,
      updatedAt:  new Date(),
      ...data.fields,
    })
    .onConflictDoUpdate({
      target: [productTranslations.productId, productTranslations.locale],
      set: {
        ...data.fields,
        updatedAt: new Date(),
      },
    });
}

/**
 * Fetch all saved translations for a product (used in the admin editor).
 */
export async function getProductTranslations(productId: string) {
  return db
    .select()
    .from(productTranslations)
    .where(eq(productTranslations.productId, productId));
}
