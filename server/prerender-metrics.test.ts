import { describe, expect, it } from "vitest";
import { readContainerStats } from "./prerender-metrics.js";

const fakeFs = (files: Record<string, string>) => (path: string) => files[path] ?? null;

describe("readContainerStats", () => {
  it("reads cgroup v2 memory and CPU throttling", () => {
    const stats = readContainerStats(
      fakeFs({
        "/sys/fs/cgroup/memory.current": "429916160\n",
        "/sys/fs/cgroup/memory.max": "536870912\n",
        "/sys/fs/cgroup/cpu.max": "50000 100000\n",
        "/sys/fs/cgroup/cpu.stat": "usage_usec 9000000\nuser_usec 7000000\nsystem_usec 2000000\nnr_periods 400\nnr_throttled 120\nthrottled_usec 31500000\n",
      }),
    );
    expect(stats).toEqual({
      cgroup: "v2",
      memoryMb: 410,
      memoryLimitMb: 512,
      cpuQuotaCores: 0.5,
      cpuUsageMs: 9000,
      throttledCount: 120,
      throttledMs: 31500,
    });
  });

  it("treats an unlimited cgroup v2 as having no limit", () => {
    const stats = readContainerStats(
      fakeFs({
        "/sys/fs/cgroup/memory.current": "104857600",
        "/sys/fs/cgroup/memory.max": "max",
        "/sys/fs/cgroup/cpu.max": "max 100000",
        "/sys/fs/cgroup/cpu.stat": "usage_usec 1000\nnr_throttled 0\nthrottled_usec 0",
      }),
    );
    expect(stats.memoryLimitMb).toBeUndefined();
    expect(stats.cpuQuotaCores).toBeUndefined();
    expect(stats.memoryMb).toBe(100);
  });

  it("reads cgroup v1 (throttled_time is in nanoseconds)", () => {
    const stats = readContainerStats(
      fakeFs({
        "/sys/fs/cgroup/memory/memory.usage_in_bytes": "314572800",
        "/sys/fs/cgroup/memory/memory.limit_in_bytes": "536870912",
        "/sys/fs/cgroup/cpu/cpu.cfs_quota_us": "50000",
        "/sys/fs/cgroup/cpu/cpu.cfs_period_us": "100000",
        "/sys/fs/cgroup/cpu/cpu.stat": "nr_periods 10\nnr_throttled 4\nthrottled_time 2500000000",
        "/sys/fs/cgroup/cpuacct/cpuacct.usage": "7000000000",
      }),
    );
    expect(stats).toEqual({
      cgroup: "v1",
      memoryMb: 300,
      memoryLimitMb: 512,
      cpuQuotaCores: 0.5,
      cpuUsageMs: 7000,
      throttledCount: 4,
      throttledMs: 2500,
    });
  });

  it("returns an empty result outside a container", () => {
    expect(readContainerStats(fakeFs({}))).toEqual({ cgroup: "none" });
  });
});
