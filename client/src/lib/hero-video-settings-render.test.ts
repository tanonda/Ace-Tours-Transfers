import { describe, it, expect } from "vitest";
import { createElement } from "react";
import { renderToString } from "react-dom/server";
import { HeroVideoSettings } from "@/components/admin/hero-video-settings";

const getContent = (key: string) => ({ id: key === "hero_video_pages" ? "p1" : undefined, key, value: key === "hero_video_pages" ? "tours" : "" });
const render = (saving: boolean) => renderToString(createElement(HeroVideoSettings, { getContent, onSave: () => {}, saving }));
const checkboxes = (html: string) => html.match(/<button[^>]*role="checkbox"[^>]*>/g) ?? [];

describe("HeroVideoSettings while a save is in flight", () => {
  it("disables the page tick boxes so a second click can't build on stale data", () => {
    const boxes = checkboxes(render(true));
    expect(boxes).toHaveLength(3);
    for (const b of boxes) expect(b).toMatch(/disabled=""/);
  });

  it("enables them otherwise, with saved pages ticked", () => {
    const boxes = checkboxes(render(false));
    expect(boxes).toHaveLength(3);
    for (const b of boxes) expect(b).not.toMatch(/disabled=""/);
    expect(boxes.filter((b) => b.includes('aria-checked="true"'))).toHaveLength(1);
  });
});
