import { build as esbuild, stop as stopEsbuild } from "esbuild";
import { build as viteBuild } from "vite";
import { rm, readFile } from "fs/promises";
import { runPrerender } from "../scripts/prerender.js";

// server deps to bundle to reduce openat(2) syscalls
// which helps cold start times
const allowlist = [
  "@google/generative-ai",
  "axios",
  "connect-pg-simple",
  "date-fns",
  "drizzle-orm",
  "drizzle-zod",
  "jsonwebtoken",
  "memorystore",
  "multer",
  "nanoid",
  "nodemailer",
  "openai",
  "passport",
  "passport-local",
  "stripe",
  "uuid",
  "ws",
  "xlsx",
  "zod",
  "zod-validation-error",
];

async function buildAll() {
  await rm("dist", { recursive: true, force: true });

  console.log("building client...");
  await viteBuild();

  console.log("building server...");
  const pkg = JSON.parse(await readFile("package.json", "utf-8"));
  const allDeps = [
    ...Object.keys(pkg.dependencies || {}),
    ...Object.keys(pkg.devDependencies || {}),
  ];
  const externals = allDeps.filter((dep) => !allowlist.includes(dep));

  await esbuild({
    entryPoints: ["server/index.ts", "server/instrument.ts"],
    platform: "node",
    target: "node20",
    bundle: true,
    format: "cjs",
    outdir: "dist",
    entryNames: "[dir]/[name]",
    outExtension: { ".js": ".cjs" },
    define: {
      "process.env.NODE_ENV": '"production"',
    },
    minify: true,
    external: externals,
    logLevel: "info",
    treeShaking: true,
    sourcemap: false,
  });

  if (process.env.PRERENDER !== "0") {
    console.log("prerendering public pages...");
    try {
      const didWrite = await runPrerender();
      if (!didWrite) {
        console.warn(
          "[build] prerender produced no snapshots — shipping SPA shell only. " +
          "Set PRERENDER=0 to silence, or check DATABASE_URL / server startup.",
        );
      }
    } catch (err) {
      console.warn(
        "[build] prerender failed (non-fatal); shipping SPA shell only:",
        err instanceof Error ? err.message : err,
      );
    }
  }

  // Stop esbuild's long-lived service process so this build exits cleanly in
  // CI/Docker instead of lingering after all output is written.
  stopEsbuild();
}

buildAll().catch((err) => {
  console.error(err);
  process.exit(1);
});
