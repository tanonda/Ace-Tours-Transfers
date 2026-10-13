import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import path from "path";
import express from "express";
import request from "supertest";
import { buildRobotsTxt, noindexApiResponses } from "./seo.routes.js";

const disallows = (txt: string) => txt.split("\n").filter((l) => l.startsWith("Disallow:")).sort();

// The served robots.txt comes from code; client/public/robots.txt is the copy in the build.
describe("robots.txt", () => {
  it("served rules match client/public/robots.txt", () => {
    const file = readFileSync(path.resolve("client/public/robots.txt"), "utf8");
    expect(disallows(buildRobotsTxt())).toEqual(disallows(file));
  });

  // Google applies robots.txt while rendering; tour, transfer and blog pages load
  // their content from /api, so blocking it makes them render as errors.
  it("lets crawlers fetch the API that pages render from", () => {
    expect(disallows(buildRobotsTxt()).some((l) => /^Disallow:\s*\/api/.test(l))).toBe(false);
  });
});

describe("API responses", () => {
  it("are marked noindex so the JSON itself stays out of search", async () => {
    const app = express();
    app.use("/api", noindexApiResponses);
    app.get("/api/articles/x", (_req, res) => res.json({}));
    app.get("/tours", (_req, res) => res.send("page"));

    expect((await request(app).get("/api/articles/x")).headers["x-robots-tag"]).toBe("noindex");
    expect((await request(app).get("/tours")).headers["x-robots-tag"]).toBeUndefined();
  });
});
