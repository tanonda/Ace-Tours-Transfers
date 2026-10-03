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

  it.each(["contact_email", "whatsapp_number", "gtm_container_id", "ga4_measurement_id", "ewallet_phone_number"])(
    "treats %s as public",
    (key) => expect(isPrivateSettingKey(key)).toBe(false),
  );
});

describe("visibleSettings", () => {
  it("hides private keys from visitors", () => {
    expect(visibleSettings(settings, false).map((s) => s.key)).toEqual(["contact_email", "whatsapp_number"]);
  });

  it("returns everything to admins so the settings page can edit it", () => {
    expect(visibleSettings(settings, true)).toEqual(settings);
  });
});
