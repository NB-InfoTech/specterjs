/** Possible status of any single probe execution */
export type ProbeStatus = "success" | "blocked" | "error";

/** Generic result shape returned by every module probe */
export interface ProbeResult {
  /** Unique probe identifier, e.g. "prototype:toString" */
  id: string;
  /** Human-readable label */
  label: string;
  status: ProbeStatus;
  /** Arbitrary payload – typed per probe via discriminated union */
  value: unknown;
  /** Human-readable explanation when status is not "success" */
  message?: string;
  /** Duration in ms the probe took to complete */
  durationMs?: number;
}

/**
 * Describes a single detected lie or tampering attempt.
 * Each anomaly carries a severity so the trust scorer can weigh it.
 *
 * Category "hardening" entries are treated as informational privacy-browser
 * badges and do NOT reduce the integrity score.
 */
export interface LieReport {
  /** Unique code for the lie, e.g. "toString:overridden" */
  code: string;
  /** Short human-readable title */
  title: string;
  /** Detailed explanation of what was detected */
  detail: string;
  /** Severity weight used by TrustScore (higher = more suspicious) */
  severity: number;
  /** Reference to the module that detected this lie */
  source: string;
  /** "tampering" (deducts trust) | "hardening" (informational badge) */
  category?: "tampering" | "hardening";
}

/** Aggregate trust metrics computed from all probe results & lie reports */
export interface TrustMetrics {
  /** Overall trust score 0–100 (100 = fully trustworthy) */
  score: number;
  /** Total number of tampering anomalies detected */
  anomalyCount: number;
  /** Total number of probes that were blocked by the environment */
  blockedCount: number;
  /** Categorised breakdown for the radar-chart visualisation */
  categories: Record<string, number>;
  /** Privacy-hardening badges (adblock, GPC, RFP, etc.) */
  hardening: LieReport[];
}

/** Top-level audit report returned by the Engine */
export interface AuditReport {
  /** Engine / library version */
  version: string;
  /** ISO-8601 timestamp of the audit run */
  timestamp: string;
  /** User-agent string captured at audit time */
  userAgent: string;
  /** All individual probe results */
  probes: ProbeResult[];
  /** All detected lies & anomalies */
  anomalies: LieReport[];
  /** Computed trust metrics */
  trust: TrustMetrics;
}
