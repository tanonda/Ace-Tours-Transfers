import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import path from "path";
import { buildRobotsTxt } from "./seo.routes.js";

const disallows = (txt: string) => txt.split("\n").filter((l) => l.startsWith("Disallow:")).sort();

// The served robots.txt comes from code; client/public/robots.txt is the copy in the build.
describe("robots.txt", () => {
  it("served rules match client/public/robots.txt", () => {
    const file = readFileSync(path.resolve("client/public/robots.txt"), "utf8");
    expect(disallows(buildRobotsTxt())).toEqual(disallows(file));
  });
});
