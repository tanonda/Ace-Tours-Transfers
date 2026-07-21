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

  it("stops the server and exits non-zero when prerender fails", () => {
    expect(startupScript).toContain('if [ "$prerender_status" -ne 0 ]');
    expect(startupScript).toContain("stop_server");
    expect(startupScript).toContain('exit "$prerender_status"');
  });

  it("keeps the server supervised after successful validation", () => {
    expect(startupScript).toContain("prerender complete and validated");
    expect(startupScript).toContain('wait "$server_pid"');
  });
});
