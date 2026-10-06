import type { Express } from "express";
import { invalidPersonName } from "../../shared/person-name.js";
import { storage } from "../storage.js";
import { config } from "../config.js";
import { db } from "../db.js";
import { sql, eq } from "drizzle-orm";
import { insertWishlistItemSchema, insertCmsContentSchema, newsletterSubscribers } from "../../shared/schema.js";
import { isPrivateSettingKey, visibleSettings } from "../lib/public-settings.js";
import { PRICING_RULES_SETTING_KEY, parsePricingRules } from "../../shared/pricing-rules.js";
import { BANK_TRANSFER_SETTING_KEYS, settingText } from "../../shared/bank-transfer.js";
import { invalidatePricingRulesCache } from "../domain/pricing/PricingEngine.js";

import crypto from "crypto";
import { sendEmail, sendAdminEmail, getNewsletterConfirmationTemplate, getContactFormTemplate, sendNewsletterEmail, getContactAutoReplyTemplate } from "../lib/mail.js";
import { translateToAll } from "../lib/translate.js";
import { adminAudit } from "../infrastructure/audit/admin-audit-log.service.js";

import { contactLimiter, escapeHtml, newsletterLimiter, requireAdmin, requireAuth } from "./shared.js";

export function registerSiteRoutes(app: Express) {
  // Site Configuration API
  app.get("/api/config", (_req, res) => {
    res.json({
      ddd: config.ddd,
      payments: {
        enabled: config.payments.enabled,
        manual: config.payments.manual,
      },
      killSwitches: config.killSwitches
    });
  });

  // Settings API
  app.get("/api/settings", async (req, res) => {
    try {
      const settings = await storage.getSiteSettings();
      // Admins and visitors get different bodies; never let a shared cache mix them.
      res.set("Cache-Control", "private, no-cache");
      res.json(visibleSettings(settings, req.session.userRole === "admin"));
    } catch (error: any) {
      const ref = Date.now().toString();
      console.error(`[SETTINGS ERROR][${ref}]`, error?.message, error?.code);
      // Return empty array so the UI degrades gracefully
      res.json([]);
    }
  });

  app.get("/api/settings/:key", async (req, res) => {
    try {
      const hidden = isPrivateSettingKey(req.params.key) && req.session.userRole !== "admin";
      const setting = hidden ? undefined : await storage.getSiteSetting(req.params.key);
      if (!setting) return res.status(404).json({ error: "Setting not found" });
      res.set("Cache-Control", "private, no-cache");
      res.json(setting);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch setting" });
    }
  });

  app.put("/api/admin/settings/:key", requireAdmin, async (req, res) => {
    try {
      const before = await storage.getSiteSetting(req.params.key).catch(() => null);
      const isPricingRules = req.params.key === PRICING_RULES_SETTING_KEY;
      // Pricing rules drive checkout totals: store only a normalised, in-range copy.
      const value = isPricingRules ? parsePricingRules(req.body.value) : req.body.value;
      const setting = await storage.upsertSiteSetting({ key: req.params.key, value });
      if (isPricingRules) invalidatePricingRulesCache();
      await adminAudit.log({
        action: "settings.update",
        entityType: "site_settings",
        entityId: req.params.key,
        entityName: req.params.key,
        performedBy: req.session.userId,
        previousValue: before ? { value: (before as any).value } : null,
        newValue: { value },
        req,
      });
      // Guests pay into these details: a change (by a person, or by someone who got into
      // an admin account) must never go unnoticed.
      const previous = settingText((before as any)?.value);
      if (BANK_TRANSFER_SETTING_KEYS.includes(req.params.key) && previous !== settingText(value)) {
        sendAdminEmail(
          `⚠️ Bank details changed: ${req.params.key}`,
          `<div style="font-family: Arial, sans-serif; padding: 20px; color: #333;">
            <h2 style="color: #b45309;">Bank transfer details were changed</h2>
            <p><strong>Setting:</strong> ${escapeHtml(req.params.key)}<br>
            <strong>Before:</strong> ${escapeHtml(previous || "(empty)")}<br>
            <strong>After:</strong> ${escapeHtml(settingText(value) || "(empty)")}</p>
            <p>Guests choosing bank transfer now see the new value in their email and on the booking page.
            If you did not make this change, correct it in Admin → Settings → Payments and change the admin passwords.</p>
          </div>`
        ).catch((err) => console.error("[SETTINGS] Bank change alert failed:", err));
      }
      res.json(setting);
    } catch (error) {
      res.status(400).json({ error: "Failed to update setting" });
    }
  });

  // Wishlist API
  app.get("/api/wishlist", requireAuth, async (req, res) => {
    try {
      const items = await storage.getWishlistItems(req.session.userId!);
      res.json(items);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch wishlist" });
    }
  });

  app.post("/api/wishlist", requireAuth, async (req, res) => {
    try {
      const validatedData = insertWishlistItemSchema.parse({ ...req.body, userId: req.session.userId });
      const item = await storage.addToWishlist(validatedData);
      res.status(201).json(item);
    } catch (error) {
      res.status(400).json({ error: "Failed to add to wishlist" });
    }
  });

  app.delete("/api/wishlist/:tourId", requireAuth, async (req, res) => {
    try {
      await storage.removeFromWishlist(req.session.userId!, req.params.tourId);
      res.json({ message: "Removed from wishlist" });
    } catch (error) {
      res.status(400).json({ error: "Failed to remove from wishlist" });
    }
  });

  app.get("/api/wishlist/check/:tourId", requireAuth, async (req, res) => {
    try {
      const inWishlist = await storage.isInWishlist(req.session.userId!, req.params.tourId);
      res.json({ inWishlist });
    } catch (error) {
      res.status(500).json({ error: "Failed to check wishlist" });
    }
  });

  // Newsletter API
  app.get("/api/newsletter/subscribers", requireAdmin, async (_req, res) => {
    try {
      const subs = await storage.getNewsletterSubscribers();
      res.json(subs);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch subscribers" });
    }
  });

  // Update subscriber (manually confirm, unsubscribe, re-subscribe, edit name)
  app.patch("/api/newsletter/subscribers/:id", requireAdmin, async (req, res) => {
    try {
      const { id } = req.params;
      const { confirmed, unsubscribedAt, name } = req.body;
      const nameError = invalidPersonName(name);
      if (nameError) return res.status(400).json({ error: nameError });
      // Build update using drizzle ORM
      const updateData: Record<string, any> = {};
      if (confirmed !== undefined) updateData.confirmed = confirmed;
      if (unsubscribedAt !== undefined) updateData.unsubscribedAt = unsubscribedAt === null ? null : new Date(unsubscribedAt);
      if (name !== undefined) updateData.name = name;
      if (Object.keys(updateData).length === 0) return res.json({ success: true });
      await db.update(newsletterSubscribers).set(updateData).where(eq(newsletterSubscribers.id, id));
      res.json({ success: true });
    } catch (error) {
      console.error("[NEWSLETTER PATCH ERROR]:", error);
      res.status(500).json({ error: "Failed to update subscriber" });
    }
  });

  // Delete subscriber permanently
  // PUBLIC: One-click newsletter unsubscribe (CAN-SPAM compliance)
  app.get("/api/newsletter/unsubscribe", async (req, res) => {
    try {
      const { email, token } = req.query as { email?: string; token?: string };
      if (!email || !token) {
        return res.status(400).send("<html><body><h2>Invalid unsubscribe link.</h2></body></html>");
      }

      // Verify HMAC token to prevent abuse
      const expectedToken = crypto
        .createHmac("sha256", config.session.secret || "newsletter-unsub")
        .update(email.toLowerCase().trim())
        .digest("hex")
        .slice(0, 16);

      if (token !== expectedToken) {
        return res.status(403).send("<html><body><h2>Invalid or expired unsubscribe link.</h2></body></html>");
      }

      // Find and unsubscribe
      const existing = await db.execute(
        sql`UPDATE newsletter_subscribers SET unsubscribed_at = NOW() WHERE LOWER(email) = ${email.toLowerCase().trim()} AND unsubscribed_at IS NULL`
      );

      const safeUrl = escapeHtml(process.env.APP_URL || 'https://acetours.vu');
      res.send(`
        <html><body style="font-family:sans-serif;text-align:center;padding:60px;">
          <h2>You've been unsubscribed</h2>
          <p>You will no longer receive newsletter emails from Ace Tours &amp; Transfers.</p>
          <p><a href="${safeUrl}">Return to website</a></p>
        </body></html>
      `);
    } catch (error) {
      console.error("[NEWSLETTER] Unsubscribe error:", error);
      res.status(500).send("<html><body><h2>Something went wrong. Please contact us.</h2></body></html>");
    }
  });

  app.delete("/api/newsletter/subscribers/:id", requireAdmin, async (req, res) => {
    try {
      const { id } = req.params;
      await db.execute(sql`DELETE FROM newsletter_subscribers WHERE id = ${id}`);
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ error: "Failed to delete subscriber" });
    }
  });

  app.post("/api/newsletter/subscribe", newsletterLimiter, async (req, res) => {
    try {
      // Check feature flag
      const newsletterFlag = await storage.getFeatureFlag("newsletter");
      if (newsletterFlag && !newsletterFlag.enabled) {
        return res.status(403).json({ error: "Newsletter subscriptions are currently disabled." });
      }

      const { email, name, locale, source } = req.body;
      if (!email) return res.status(400).json({ error: "Email is required" });
      const nameError = invalidPersonName(name);
      if (nameError) return res.status(400).json({ error: nameError });

      // Basic email format validation to prevent junk
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(email)) return res.status(400).json({ error: "Invalid email address" });
      if (email.length > 254) return res.status(400).json({ error: "Email address too long" });

      // Sanitize name
      const safeName = typeof name === "string" ? name.slice(0, 100).trim() : null;
      const safeLocale = typeof locale === "string" ? locale.slice(0, 10).trim() : "en";
      const safeSource = typeof source === "string" ? source.slice(0, 50).trim() : "website";

      const subscriber = await storage.subscribeNewsletter({
        email: email.toLowerCase().trim(),
        name: safeName,
        locale: safeLocale,
        source: safeSource
      });

      // Send branded confirmation email with List-Unsubscribe header (CAN-SPAM)
      try {
        await sendNewsletterEmail(
          email.toLowerCase().trim(),
          "You're subscribed to Ace Tours & Transfers!",
          await getNewsletterConfirmationTemplate(email.toLowerCase().trim(), safeName || undefined),
        );
      } catch (emailErr) {
        console.error("[NEWSLETTER] Confirmation email failed (non-fatal):", emailErr);
      }

      res.status(201).json({ message: "Subscribed!", subscriber });
    } catch (error) {
      res.status(400).json({ error: "Failed to subscribe" });
    }
  });

  // ── Contact Form ─────────────────────────────────────────────────────────
  /**
   * POST /api/contact
   * Accepts a guest contact form submission.
   * - Sends a branded notification email to admin
   * - Sends an auto-reply confirmation to the guest
   */
  app.post("/api/contact", contactLimiter, async (req, res) => {
    try {
      const { name, email, phone, subject, message } = req.body;

      // Validation
      if (!name || typeof name !== "string" || name.trim().length < 2) {
        return res.status(400).json({ error: "A valid name is required." });
      }
      const nameError = invalidPersonName(name);
      if (nameError) return res.status(400).json({ error: nameError });
      if (!email || typeof email !== "string") {
        return res.status(400).json({ error: "A valid email address is required." });
      }
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(email) || email.length > 254) {
        return res.status(400).json({ error: "Invalid email address." });
      }
      if (!message || typeof message !== "string" || message.trim().length < 10) {
        return res.status(400).json({ error: "Message must be at least 10 characters." });
      }
      if (message.trim().length > 3000) {
        return res.status(400).json({ error: "Message is too long (max 3000 characters)." });
      }

      const contact = {
        name: name.trim().slice(0, 100),
        email: email.toLowerCase().trim(),
        phone: typeof phone === "string" ? phone.trim().slice(0, 30) || undefined : undefined,
        subject: typeof subject === "string" ? subject.trim().slice(0, 200) || undefined : undefined,
        message: message.trim(),
      };

      // 1. Notify admin
      try {
        await sendAdminEmail(
          `📬 Contact Form: ${contact.subject || "New Enquiry"} — ${contact.name}`,
          await getContactFormTemplate(contact)
        );
      } catch (adminEmailErr) {
        console.error("[CONTACT] Admin notification email failed:", adminEmailErr);
        // Still attempt guest auto-reply even if admin email fails
      }

      // 2. Auto-reply to guest
      try {
        const locale = req.body.locale || 'en';
        const autoReplyHtml = await getContactAutoReplyTemplate(contact, locale);

        await sendEmail({
          to: contact.email,
          subject: locale === 'en' ? "We received your message — Ace Tours & Transfers" 
                 : locale === 'fr' ? "Nous avons reçu votre message — Ace Tours & Transfers"
                 : locale === 'es' ? "Recibimos su mensaje — Ace Tours & Transfers"
                 : locale === 'zh' ? "我们已收到您的留言 — Ace Tours & Transfers"
                 : "Mifola Kasem Mesej blong Yula — Ace Tours",
          html: autoReplyHtml,
        });
      } catch (guestEmailErr) {
        console.error("[CONTACT] Guest auto-reply email failed (non-fatal):", guestEmailErr);
      }

      return res.status(200).json({ message: "Message sent! We'll be in touch shortly." });
    } catch (error: any) {
      console.error("[CONTACT] Unexpected error:", error);
      return res.status(500).json({ error: "Failed to send message. Please try again." });
    }
  });

  // CMS/Content Blocks API
  app.get("/api/content-blocks", async (req, res) => {
    try {
      const locale = req.query.locale as string | undefined;
      const allContent = await storage.getAllCmsContentByLocale(locale || 'en');
      // Use null-prototype object to prevent prototype pollution via bracket notation
      const result: Record<string, any[]> = Object.create(null);

      allContent.forEach(item => {
        const slug = item.blockSlug;
        // Guard against prototype pollution: only allow simple string slugs
        if (typeof slug !== 'string' || slug === '__proto__' || slug === 'constructor' || slug === 'prototype') return;
        if (!result[slug]) {
          result[slug] = [];
        }
        result[slug].push(item);
      });

      res.json(result);
    } catch (error: any) {
      console.error("[ROUTE] GET /api/content-blocks failed:", error?.message, error?.code);
      res.json({});
    }
  });

  app.get("/api/cms-content/:blockSlug", async (req, res) => {
    try {
      const content = await storage.getCmsContent(req.params.blockSlug, req.query.locale as string);
      res.json(content);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch content" });
    }
  });

  app.post("/api/admin/cms-content", requireAdmin, async (req, res) => {
    try {
      const validatedData = insertCmsContentSchema.parse(req.body);
      const content = await storage.createCmsContent(validatedData);
      res.status(201).json(content);
    } catch (error) {
      res.status(400).json({ error: "Failed to create content" });
    }
  });

  app.patch("/api/admin/cms-content/:id", requireAdmin, async (req, res) => {
    try {
      const content = await storage.updateCmsContent(req.params.id, req.body);
      if (!content) return res.status(404).json({ error: "Content not found" });
      res.json(content);
    } catch (error) {
      res.status(400).json({ error: "Failed to update content" });
    }
  });

  // Auto-translate a CMS content item to all supported languages
  app.post("/api/admin/cms-content/auto-translate", requireAdmin, async (req, res) => {
    try {
      const { id } = req.body;
      if (!id) return res.status(400).json({ error: "Content ID is required" });

      const source = await storage.getCmsContentItem(id);
      if (!source) return res.status(404).json({ error: "Content not found" });
      if (!source.value?.trim()) return res.status(400).json({ error: "Content value is empty — nothing to translate" });

      const translations = await translateToAll(source.value);

      const results: any[] = [];
      for (const [locale, translatedValue] of Object.entries(translations)) {
        const row = await storage.upsertCmsContentByLocale(
          source.blockSlug,
          source.contentKey,
          locale,
          translatedValue,
          source.contentType || 'text',
        );
        results.push(row);
      }

      res.json({ translated: results, sourceId: id, locales: Object.keys(translations) });
    } catch (error: any) {
      console.error("[ROUTE] POST /api/admin/cms-content/auto-translate failed:", error?.message);
      res.status(500).json({ error: "Auto-translation failed" });
    }
  });

  app.delete("/api/admin/cms-content/:id", requireAdmin, async (req, res) => {
    try {
      await storage.deleteCmsContent(req.params.id);
      res.status(204).end();
    } catch (error) {
      res.status(500).json({ error: "Failed to delete content" });
    }
  });

  // Feature Flags
  app.get("/api/feature-flags", async (_req, res) => {
    try {
      const flags = await storage.getFeatureFlags();
      res.json(flags);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch feature flags" });
    }
  });

  app.get("/api/admin/feature-flags/:slug", requireAdmin, async (req, res) => {
    try {
      const { slug } = req.params;
      const flag = await storage.getFeatureFlag(slug);
      if (!flag) {
        return res.status(404).json({ error: "Feature flag not found" });
      }
      res.json(flag);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch feature flag" });
    }
  });

  app.patch("/api/admin/feature-flags/:slug", requireAdmin, async (req, res) => {
    try {
      const { slug } = req.params;
      const { enabled } = req.body;

      if (typeof enabled !== 'boolean') {
        return res.status(400).json({ error: "Enabled state must be a boolean" });
      }

      const flag = await storage.getFeatureFlag(slug);
      if (!flag) {
        return res.status(404).json({ error: "Feature flag not found" });
      }

      const updated = await storage.upsertFeatureFlag({
        ...flag,
        enabled
      });

      await adminAudit.log({
        action: "flag.toggle",
        entityType: "feature_flag",
        entityId: slug,
        entityName: (flag as any).displayName || (flag as any).name || slug,
        performedBy: req.session.userId,
        previousValue: { enabled: flag.enabled },
        newValue: { enabled: updated.enabled },
        req,
      });

      console.log(`[FEATURE-FLAG] ${updated.slug} toggled to ${updated.enabled ? 'ON' : 'OFF'} by admin`);
      res.json(updated);
    } catch (error) {
      res.status(500).json({ error: "Failed to update feature flag" });
    }
  });

}
