import { describe, expect, it } from "vitest";
import { isPrivateSettingKey, visibleSettings } from "./public-settings.js";

const settings = [
  { key: "contact_email", value: "acetoursvanuatu@outlook.com" },
  { key: "admin_email", value: "owner@example.com" },
  { key: "whatsapp_number", value: "+678 7114045" },
  { key: "smtp_password", value: "hunter2" },
  { key: "google_places_api_key", value: "AIza..." },
];

describe("isPrivateSettingKey", () => {
  it.each(["admin_email", "smtp_password", "google_places_api_key", "webhook_secret", "auth_token"])(
    "treats %s as private",
    (key) => expect(isPrivateSettingKey(key)).toBe(true),
  );

  it.each(["smtp_host", "pricing_rules", "booking_alert_email", "some_future_setting"])(
    "treats unlisted %s as private",
    (key) => expect(isPrivateSettingKey(key)).toBe(true),
  );

  // Every key the live storefront served publicly on 2026-10-07 must stay public.
  it.each([
    "contact_email", "contact_phone", "contact_phone_2", "contact_address", "site_phone", "site_email",
    "app_url", "business_name", "business_info", "default_currency", "gtm_container_id", "ga4_measurement_id",
    "whatsapp", "whatsapp_number", "whatsapp_greeting", "social_facebook", "social_instagram",
    "social_custom_links", "booking_terms", "cancellation_policy", "review_provider", "email_from_name",
    "footer_backlinks", "launch_date", "seo_title_template", "seo_canonical_url", "schema_phone",
    "cs_bg_images", "cs_show_countdown", "bank_transfer_account_number", "cash_instructions",
    "ewallet_phone_number",
  ])("treats %s as public", (key) => expect(isPrivateSettingKey(key)).toBe(false));

  it("keeps secret-looking names private even under a public prefix", () => {
    expect(isPrivateSettingKey("seo_api_key")).toBe(true);
    expect(isPrivateSettingKey("contact_form_secret")).toBe(true);
  });
});

describe("visibleSettings", () => {
  it("hides private keys from visitors", () => {
    expect(visibleSettings(settings, false).map((s) => s.key)).toEqual(["contact_email", "whatsapp_number"]);
  });

  it("returns everything to admins so the settings page can edit it", () => {
    expect(visibleSettings(settings, true)).toEqual(settings);
  });
});
