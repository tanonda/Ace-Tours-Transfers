import { describe, it, expect, vi, beforeEach } from "vitest";
import { v2 as cloudinary } from "cloudinary";

const cfg = vi.hoisted(() => ({ enabled: true }));
vi.mock("../../config.js", () => ({ config: { cloudinary: cfg } }));

beforeEach(() => {
  cloudinary.config({ cloud_name: "demo-cloud", api_key: "123456", api_secret: "shh-secret" });
});

describe("CloudinaryService.signVideoUpload", () => {
  it("signs folder, timestamp and the eager loop versions with the API secret", async () => {
    const { CloudinaryService } = await import("./cloudinary-service.js");
    const sig = new CloudinaryService().signVideoUpload("ace-tours/hero-video");
    expect(sig).toMatchObject({ cloudName: "demo-cloud", apiKey: "123456", folder: "ace-tours/hero-video" });
    expect(Math.abs(sig.timestamp - Date.now() / 1000)).toBeLessThan(5);
    const { HERO_LOOP_EAGER } = await import("../../../shared/hero-video.js");
    expect(sig).toMatchObject({ eager: HERO_LOOP_EAGER, eagerAsync: true });
    expect(sig.signature).toBe(
      cloudinary.utils.api_sign_request({ eager: HERO_LOOP_EAGER, eager_async: true, folder: "ace-tours/hero-video", timestamp: sig.timestamp }, "shh-secret"),
    );
    expect(JSON.stringify(sig)).not.toContain("shh-secret");
  });

  it("reports the cloud name", async () => {
    const { CloudinaryService } = await import("./cloudinary-service.js");
    expect(new CloudinaryService().cloudName()).toBe("demo-cloud");
  });

  it("throws and has no cloud name when disabled", async () => {
    cfg.enabled = false;
    const { CloudinaryService } = await import("./cloudinary-service.js");
    const svc = new CloudinaryService();
    expect(svc.cloudName()).toBeNull();
    expect(() => svc.signVideoUpload("x")).toThrow(/not enabled/);
    cfg.enabled = true;
  });
});
