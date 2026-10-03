import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const repoRoot = fileURLToPath(new URL("../", import.meta.url));
const dockerfile = readFileSync(`${repoRoot}Dockerfile`, "utf8");
const startupScript = readFileSync(`${repoRoot}scripts/start-with-prerender.sh`, "utf8");

describe("Docker prerender startup supervision", () => {
  it("uses the supervised startup script without swallowing failures", () => {
    expect(dockerfile).toContain('CMD ["/app/scripts/start-with-prerender.sh"]');
    expect(dockerfile).not.toContain("npm run prerender || true");
  });

  // Every route already has a snapshot seeded from the previous deploy (or falls back
  // to the app shell), so a page that fails its fresh render must not take the whole
  // site down — and on Render a failing startup becomes a restart loop.
  it("logs a prerender failure but keeps the server online", () => {
    expect(startupScript).toContain('if [ "$prerender_status" -ne 0 ]');
    expect(startupScript).toContain("keeping the service online");
    expect(startupScript).not.toContain('exit "$prerender_status"');
  });

  it("still stops the server on termination signals", () => {
    expect(startupScript).toContain("trap handle_signal INT TERM HUP");
    expect(startupScript).toContain("stop_server");
  });

  it("keeps the server supervised after successful validation", () => {
    expect(startupScript).toContain("prerender complete and validated");
    expect(startupScript).toContain('wait "$server_pid"');
  });
});
