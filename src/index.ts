/* ------------------------------------------------------------------ */
/*  SpecterJS – Main Entry Point                                      */
/*  Bootstraps the audit engine & renders the Cyber-Lab dashboard.    */
/* ------------------------------------------------------------------ */

import { runAudit } from "./core/Engine.js";
import { render } from "./ui/Dashboard.js";

async function bootstrap(): Promise<void> {
  const root = document.getElementById("app");
  if (!root) {
    console.warn("[SpecterJS] Mount point #app not found.");
    return;
  }

  root.innerHTML = `
    <div class="loading-screen">
      <div class="loader"></div>
      <p>Scanning browser integrity&hellip;</p>
    </div>
  `;

  try {
    const report = await runAudit();
    render(report, root);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    root.innerHTML = `
      <div class="error-screen">
        <h2>Audit Error</h2>
        <pre>${escapeHtml(msg)}</pre>
      </div>
    `;
  }
}

function escapeHtml(text: string): string {
  const div = document.createElement("div");
  div.textContent = text;
  return div.innerHTML;
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", bootstrap);
} else {
  bootstrap();
}
