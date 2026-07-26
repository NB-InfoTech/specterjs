import type { LieReport } from "../types/index.js";

const SEVERITY_COLORS: Record<number, string> = {
  9: "var(--accent-red)",
  8: "var(--accent-red)",
  7: "var(--accent-red)",
  6: "var(--accent-magenta)",
  5: "var(--accent-magenta)",
  4: "#ffaa00",
  3: "var(--accent-cyan)",
};

function severityColor(severity: number): string {
  return SEVERITY_COLORS[severity] ?? "var(--text-muted)";
}

function severityLabel(severity: number): string {
  if (severity >= 8) return "CRITICAL";
  if (severity >= 6) return "HIGH";
  if (severity >= 4) return "MEDIUM";
  return "LOW";
}

export function renderAnomalyList(anomalies: LieReport[]): string {
  if (anomalies.length === 0) {
    return '<div class="anomaly-empty">No anomalies detected.</div>';
  }

  const items = anomalies
    .map(
      (a) => `
    <div class="anomaly-item" style="border-left-color: ${severityColor(a.severity)}">
      <div class="anomaly-header">
        <span class="anomaly-badge" style="background: ${severityColor(a.severity)}">
          ${severityLabel(a.severity)}
        </span>
        <span class="anomaly-code">${escapeHtml(a.code)}</span>
        <span class="anomaly-severity">sev ${a.severity}</span>
      </div>
      <div class="anomaly-title">${escapeHtml(a.title)}</div>
      <div class="anomaly-detail">${escapeHtml(a.detail)}</div>
      <div class="anomaly-source">Source: ${escapeHtml(a.source)}</div>
    </div>
  `,
    )
    .join("");

  return `<div class="anomaly-list">${items}</div>`;
}

export function renderAnomalyCountBadge(count: number): string {
  if (count === 0) return "";
  const color = count >= 3 ? "var(--accent-red)" : "var(--accent-magenta)";
  return `<span class="module-badge" style="background:${color}">${count} anomaly${count !== 1 ? "ies" : "y"}</span>`;
}

function escapeHtml(text: string): string {
  const div = document.createElement("div");
  div.textContent = text;
  return div.innerHTML;
}
