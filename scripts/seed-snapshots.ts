/**
 * Copy crawler snapshots from the deploy currently serving the public site, so this
 * container never serves the empty app shell while its own prerender runs.
 * See server/prerender-seed.ts. Always exits 0: seeding is best-effort.
 *
 *   tsx scripts/seed-snapshots.ts   (SNAPSHOT_SEED_URL overrides the source)
 */
import path from "node:path";
import { fileURLToPath } from "node:url";
import { seedSnapshotsFromPreviousDeploy } from "../server/prerender-seed.js";

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const source = process.env.SNAPSHOT_SEED_URL || process.env.APP_URL || "https://acetoursvanuatu.com";

seedSnapshotsFromPreviousDeploy({ sourceUrl: source, distPath: path.join(REPO_ROOT, "dist", "public") })
  .then(({ seeded, skipped }) => {
    console.log(`[seed] copied ${seeded.length} snapshots from ${source}; skipped ${skipped.length}`);
    for (const { route, reason } of skipped.slice(0, 10)) console.log(`[seed]   skip ${route}: ${reason}`);
  })
  .catch((err) => console.error("[seed] failed (continuing without seeded snapshots):", err))
  .finally(() => process.exit(0));
