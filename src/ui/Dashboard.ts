import type { AuditReport, ProbeResult } from "../types/index.js";
import { renderAnomalyList, renderAnomalyCountBadge } from "./AnomalyVisualizer.js";

/* ------------------------------------------------------------------ */
/*  Module display helpers                                            */
/* ------------------------------------------------------------------ */
interface ModuleGroup {
  displayName: string;
  icon: string;
  probes: ProbeResult[];
}

function groupProbes(probes: ProbeResult[]): ModuleGroup[] {
  const groups: Record<string, ModuleGroup> = {
    prototypeIntegrity: { displayName: "Prototype Integrity", icon: "\uD83D\uDD11", probes: [] },
    workerCrossCheck: { displayName: "Worker Cross-Check", icon: "\u2699\uFE0F", probes: [] },
    canvasWebGL: { displayName: "Canvas &amp; WebGL", icon: "\uD83C\uDFA8", probes: [] },
    webAudio: { displayName: "Web Audio", icon: "\uD83C\uDFB5", probes: [] },
    networkProbing: { displayName: "Network Probing", icon: "\uD83C\uDF10", probes: [] },
    hardeningProbing: { displayName: "Hardening &amp; Extensions", icon: "\uD83D\uDEE1\uFE0F", probes: [] },
    engine: { displayName: "Engine", icon: "\u26A1", probes: [] },
  };

  for (const p of probes) {
    const prefix = (p.id.split(":")[0] ?? "").toLowerCase();
    const key = findGroupKey(prefix);
    const group = groups[key];
    if (group) {
      group.probes.push(p);
    } else {
      /* Fallback: put in engine group */
      groups.engine!.probes.push(p);
    }
  }

  return Object.entries(groups)
    .filter(([, g]) => g.probes.length > 0)
    .map(([, g]) => g);
}

function findGroupKey(prefix: string): string {
  switch (prefix) {
    case "prototype": return "prototypeIntegrity";
    case "worker": return "workerCrossCheck";
    case "canvas": return "canvasWebGL";
    case "audio": return "webAudio";
    case "network": return "networkProbing";
    case "hardening": return "hardeningProbing";
    case "engine": return "engine";
    default: return "engine";
  }
}

/* ------------------------------------------------------------------ */
/*  Probe status icon                                                 */
/* ------------------------------------------------------------------ */
function hardeningIcon(code: string): string {
  if (code.includes("adblock")) return "\uD83D\uDEE1\uFE0F";
  if (code.includes("canvasNoise")) return "\uD83C\uDFA8";
  if (code.includes("gpc")) return "\uD83D\uDD12";
  if (code.includes("dnt")) return "\uD83D\uDEAB";
  if (code.includes("rfp")) return "\uD83E\uDDEA";
  return "\uD83D\uDCCC";
}

function probeIcon(status: string): string {
  switch (status) {
    case "success": return "\u2705";
    case "error": return "\u274C";
    case "blocked": return "\u26D4";
    default: return "\u2753";
  }
}

function formatValue(val: unknown): string {
  if (val === null || val === undefined) return "<span class=\"val-null\">null</span>";
  if (typeof val === "string") {
    if (val.length > 80) return `<span class="val-string" title="${escapeHtml(val)}">${escapeHtml(val.slice(0, 80))}&hellip;</span>`;
    return `<span class="val-string">${escapeHtml(val)}</span>`;
  }
  if (typeof val === "number") return `<span class="val-number">${val}</span>`;
  if (typeof val === "boolean") return `<span class="val-boolean">${val}</span>`;
  if (Array.isArray(val)) {
    return `<span class="val-array">[${val.map((v) => formatValue(v)).join(", ")}]</span>`;
  }
  if (typeof val === "object") {
    try {
      return `<span class="val-object">${escapeHtml(JSON.stringify(val, null, 1).slice(0, 200))}</span>`;
    } catch {
      return `<span class="val-object">[Object]</span>`;
    }
  }
  return escapeHtml(String(val));
}

/* ------------------------------------------------------------------ */
/*  Module card rendering                                             */
/* ------------------------------------------------------------------ */
function renderModuleCards(groups: ModuleGroup[]): string {
  return groups
    .map((g) => {
      const anomalyCount = g.probes.filter((p) => p.status === "error").length;
      return `
    <details class="module-card" ${anomalyCount > 0 ? "open" : ""}>
      <summary class="module-summary">
        <span class="module-icon">${g.icon}</span>
        <span class="module-name">${g.displayName}</span>
        ${renderAnomalyCountBadge(anomalyCount)}
        <span class="module-probe-count">${g.probes.length} probes</span>
        <span class="module-toggle">+</span>
      </summary>
      <div class="module-body">
        ${g.probes
          .map(
            (p) => `
          <div class="probe-item ${p.status === "error" ? "probe-error" : ""} ${p.status === "blocked" ? "probe-blocked" : ""}">
            <div class="probe-header">
              <span class="probe-icon">${probeIcon(p.status)}</span>
              <span class="probe-label">${escapeHtml(p.label)}</span>
              <span class="probe-id">${escapeHtml(p.id)}</span>
              ${p.durationMs !== undefined ? `<span class="probe-duration">${p.durationMs}ms</span>` : ""}
            </div>
            ${p.value !== null ? `<div class="probe-value">${formatValue(p.value)}</div>` : ""}
            ${p.message ? `<div class="probe-message">${escapeHtml(p.message)}</div>` : ""}
          </div>
        `,
          )
          .join("")}
      </div>
    </details>
  `;
    })
    .join("");
}

/* ------------------------------------------------------------------ */
/*  Trust score colour & ring SVG                                     */
/* ------------------------------------------------------------------ */
function scoreColor(score: number): string {
  if (score >= 80) return "var(--accent-green)";
  if (score >= 50) return "#ffaa00";
  return "var(--accent-red)";
}

const RING_RADIUS = 56;
const RING_CIRCUMFERENCE = 2 * Math.PI * RING_RADIUS;

function renderTrustRing(score: number): string {
  const color = scoreColor(score);
  const offset = RING_CIRCUMFERENCE * (1 - score / 100);
  return `
    <svg viewBox="0 0 128 128" class="trust-ring">
      <circle cx="64" cy="64" r="${RING_RADIUS}" class="ring-bg" />
      <circle cx="64" cy="64" r="${RING_RADIUS}" class="ring-fg"
        style="stroke:${color}; stroke-dasharray:${RING_CIRCUMFERENCE}; stroke-dashoffset:${offset}" />
    </svg>
    <div class="trust-label" style="color:${color}">
      <span class="trust-pct">${score}%</span>
      <span class="trust-text">${score >= 80 ? "Trusted" : score >= 50 ? "Caution" : "Compromised"}</span>
    </div>
  `;
}

/* ------------------------------------------------------------------ */
/*  Stats bar                                                         */
/* ------------------------------------------------------------------ */
function renderStats(probes: ProbeResult[], anomaliesCount: number, blockedCount: number): string {
  return `
    <div class="stats-bar">
      <div class="stat-card">
        <span class="stat-value">${probes.length}</span>
        <span class="stat-label">Probes</span>
      </div>
      <div class="stat-card">
        <span class="stat-value" style="color:${anomaliesCount > 0 ? "var(--accent-red)" : "var(--accent-green)"}">${anomaliesCount}</span>
        <span class="stat-label">Anomalies</span>
      </div>
      <div class="stat-card">
        <span class="stat-value" style="color:${blockedCount > 0 ? "var(--accent-magenta)" : "var(--text-muted)"}">${blockedCount}</span>
        <span class="stat-label">Blocked</span>
      </div>
    </div>
  `;
}

/* ------------------------------------------------------------------ */
/*  Main render entry point                                           */
/* ------------------------------------------------------------------ */
export function render(report: AuditReport, root: HTMLElement): void {
  const groups = groupProbes(report.probes);

  root.innerHTML = `
    <div class="dashboard">
      <header class="dashboard-header">
        <div class="header-brand">
          <span class="header-logo">\uD83D\uDD2E</span>
          <h1>SPECTERJS</h1>
        </div>
        <p class="header-subtitle">Browser Integrity &amp; Fingerprint Audit</p>
        <div class="header-meta">
          <span>v${escapeHtml(report.version)}</span>
          <span class="meta-sep">|</span>
          <span>${escapeHtml(new Date(report.timestamp).toLocaleString())}</span>
        </div>
      </header>

      <section class="trust-section">
        ${renderTrustRing(report.trust.score)}
        ${renderStats(report.probes, report.trust.anomalyCount, report.trust.blockedCount)}
      </section>

      <section class="categories-section">
        <h2 class="section-title">Module Integrity Breakdown</h2>
        <div class="categories-grid">
          ${Object.entries(report.trust.categories)
            .map(
              ([key, val]) => `
            <div class="category-chip">
              <span class="chip-label">${escapeHtml(key)}</span>
              <span class="chip-score" style="color:${scoreColor(val)}">${val}%</span>
            </div>
          `,
            )
            .join("")}
        </div>
      </section>

      ${report.trust.hardening.length > 0 ? `
      <section class="hardening-section">
        <h2 class="section-title">Privacy &amp; Hardening Status</h2>
        <div class="hardening-grid">
          ${report.trust.hardening.map((h) => `
            <div class="hardening-badge">
              <div class="hardening-badge-header">
                <span class="hardening-icon">${hardeningIcon(h.code)}</span>
                <span class="hardening-label">${escapeHtml(h.title)}</span>
              </div>
              <div class="hardening-detail">${escapeHtml(h.detail)}</div>
              <div class="hardening-source">${escapeHtml(h.source)}</div>
            </div>
          `).join("")}
        </div>
      </section>
      ` : ""}

      <section class="modules-section">
        <h2 class="section-title">Probe Modules</h2>
        ${renderModuleCards(groups)}
      </section>

      ${report.anomalies.length > 0 ? `
      <section class="anomalies-section">
        <h2 class="section-title">Anomaly Details (${report.anomalies.length})</h2>
        ${renderAnomalyList(report.anomalies)}
      </section>
      ` : ""}

      <footer class="dashboard-footer">
        <p>SpecterJS v${escapeHtml(report.version)} &mdash; ${escapeHtml(report.userAgent.slice(0, 80))}</p>
      </footer>
    </div>
  `;
}

function escapeHtml(text: string): string {
  const div = document.createElement("div");
  div.textContent = text;
  return div.innerHTML;
}
