import type { ProbeResult, LieReport, TrustMetrics } from "../types/index.js";

/**
 * Compute aggregate trust metrics from all probes & detected anomalies.
 *
 * Scoring logic:
 *  - Tampering anomalies (category "tampering" or unset) deduct from the
 *    integrity score (starting at 100).
 *  - Hardening badges (category "hardening") are collected separately and
 *    do NOT reduce the integrity score.
 *  - Each module category gets its own 0-100 sub-score.
 *  - Blocked probes are counted but do not directly reduce score.
 */
export function calculate(
  probes: ProbeResult[],
  anomalies: LieReport[],
): TrustMetrics {
  const tampering = anomalies.filter((a) => a.category !== "hardening");
  const hardening = anomalies.filter((a) => a.category === "hardening");

  /* ---- Overall score (tampering only) ---- */
  const totalSeverity = tampering.reduce((sum, a) => sum + a.severity, 0);
  const score = clamp(100 - totalSeverity, 0, 100);

  /* ---- Category sub-scores (tampering only) ---- */
  const catBuckets: Record<string, number[]> = {};
  for (const a of tampering) {
    const list = catBuckets[a.source] ?? [];
    list.push(a.severity);
    catBuckets[a.source] = list;
  }

  const categories: Record<string, number> = {};
  for (const [source, severities] of Object.entries(catBuckets)) {
    const catTotal = severities.reduce((s, v) => s + v, 0);
    categories[source] = clamp(100 - catTotal, 0, 100);
  }

  return {
    score,
    anomalyCount: tampering.length,
    blockedCount: probes.filter((p) => p.status === "blocked").length,
    categories,
    hardening,
  };
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}
