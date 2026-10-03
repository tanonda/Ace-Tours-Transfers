import { readFileSync } from "node:fs";

/**
 * Container resource counters, read from Linux cgroups (v2, falling back to v1).
 * The prerenderer records these per route so a slow run on Render can be traced to
 * CPU-quota throttling or memory pressure (both visible at /api/seo/prerender-status).
 */
export interface ContainerStats {
  cgroup: "v2" | "v1" | "none";
  memoryMb?: number;
  memoryLimitMb?: number;
  /** CPU limit in cores (e.g. 0.5 on Render's starter plan). */
  cpuQuotaCores?: number;
  /** Cumulative CPU time used by the container. */
  cpuUsageMs?: number;
  /** Cumulative count of scheduler periods in which the container was throttled. */
  throttledCount?: number;
  /** Cumulative time the container was held back by its CPU quota. */
  throttledMs?: number;
}

type Reader = (path: string) => string | null;

const defaultReader: Reader = (path) => {
  try {
    return readFileSync(path, "utf-8");
  } catch {
    return null;
  }
};

const mb = (bytes: number) => Math.round(bytes / (1024 * 1024));

function num(text: string | null): number | undefined {
  const n = Number(text?.trim());
  return text != null && Number.isFinite(n) ? n : undefined;
}

function statField(stat: string | null, key: string): number | undefined {
  const match = stat?.match(new RegExp(`^${key} (\\d+)$`, "m"));
  return match ? Number(match[1]) : undefined;
}

/** Sanity cap: cgroup v1 reports "no limit" as a huge number rather than "max". */
const NO_LIMIT_BYTES = 2 ** 60;

export function readContainerStats(read: Reader = defaultReader): ContainerStats {
  const v2Memory = num(read("/sys/fs/cgroup/memory.current"));
  if (v2Memory !== undefined) {
    const limit = num(read("/sys/fs/cgroup/memory.max"));
    const [quota, period] = (read("/sys/fs/cgroup/cpu.max") ?? "").trim().split(/\s+/).map(Number);
    const stat = read("/sys/fs/cgroup/cpu.stat");
    const usage = statField(stat, "usage_usec");
    const throttled = statField(stat, "throttled_usec");
    return clean({
      cgroup: "v2",
      memoryMb: mb(v2Memory),
      memoryLimitMb: limit !== undefined ? mb(limit) : undefined,
      cpuQuotaCores: quota > 0 && period > 0 ? quota / period : undefined,
      cpuUsageMs: usage !== undefined ? usage / 1000 : undefined,
      throttledCount: statField(stat, "nr_throttled"),
      throttledMs: throttled !== undefined ? throttled / 1000 : undefined,
    });
  }

  const v1Memory = num(read("/sys/fs/cgroup/memory/memory.usage_in_bytes"));
  if (v1Memory !== undefined) {
    const limit = num(read("/sys/fs/cgroup/memory/memory.limit_in_bytes"));
    const quota = num(read("/sys/fs/cgroup/cpu/cpu.cfs_quota_us"));
    const period = num(read("/sys/fs/cgroup/cpu/cpu.cfs_period_us"));
    const stat = read("/sys/fs/cgroup/cpu/cpu.stat");
    const usageNs = num(read("/sys/fs/cgroup/cpuacct/cpuacct.usage"));
    const throttledNs = statField(stat, "throttled_time");
    return clean({
      cgroup: "v1",
      memoryMb: mb(v1Memory),
      memoryLimitMb: limit !== undefined && limit < NO_LIMIT_BYTES ? mb(limit) : undefined,
      cpuQuotaCores: quota !== undefined && quota > 0 && period ? quota / period : undefined,
      cpuUsageMs: usageNs !== undefined ? usageNs / 1e6 : undefined,
      throttledCount: statField(stat, "nr_throttled"),
      throttledMs: throttledNs !== undefined ? throttledNs / 1e6 : undefined,
    });
  }

  return { cgroup: "none" };
}

function clean(stats: ContainerStats): ContainerStats {
  return Object.fromEntries(Object.entries(stats).filter(([, v]) => v !== undefined)) as ContainerStats;
}
