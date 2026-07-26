import type { ProbeResult, LieReport } from "../types/index.js";

const MODULE = "hardeningProbing";

/** FNV-1a 32-bit hash */
function fnv1a(data: string): string {
  let hash = 0x811c9dc5 >>> 0;
  for (let i = 0; i < data.length; i++) {
    hash ^= data.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return hash.toString(16).padStart(8, "0");
}

function runProbe(
  probes: ProbeResult[],
  anomalies: LieReport[],
  id: string,
  label: string,
  check: () => { passed: boolean; value: unknown; detail?: string },
  anomaly?: { severity: number; title: string; category: "tampering" | "hardening" },
): void {
  const start = performance.now();
  try {
    const r = check();
    probes.push({
      id: `hardening:${id}`,
      label,
      status: r.passed ? "success" : "error",
      value: r.value,
      durationMs: Math.round(performance.now() - start),
    });
    if (!r.passed && anomaly) {
      anomalies.push({
        code: id,
        title: anomaly.title,
        detail: r.detail ?? "Unexpected result",
        severity: anomaly.severity,
        source: MODULE,
        category: anomaly.category,
      });
    }
  } catch (err) {
    probes.push({
      id: `hardening:${id}`,
      label,
      status: "blocked",
      value: null,
      message: err instanceof Error ? err.message : String(err),
      durationMs: Math.round(performance.now() - start),
    });
  }
}

/* ---------------------------------------------------------------- */
/*  1. AdBlocker DOM Bait Test                                      */
/* ---------------------------------------------------------------- */
async function domBaitTest(): Promise<{
  blocked: boolean; removed: boolean; hidden: boolean;
}> {
  const bait = document.createElement("div");
  bait.className = "adsbox banner-ad ad-zone advert dfp-tag";
  bait.setAttribute("id", "specterjs-bait-" + Date.now());
  bait.style.cssText = "position:fixed;top:-1px;left:-1px;width:1px;height:1px;pointer-events:none;";

  document.body.appendChild(bait);

  /* Give content-filter scriptlets a tick to act */
  await new Promise((r) => setTimeout(r, 150));

  const removed = !document.body.contains(bait);
  const hidden = bait.offsetHeight === 0 || getComputedStyle(bait).display === "none";

  try { bait.remove(); } catch { /* ignore */ }

  return { blocked: removed || hidden, removed, hidden };
}

/* ---------------------------------------------------------------- */
/*  2. AdBlocker Network Bait Test                                  */
/* ---------------------------------------------------------------- */
async function networkBaitTest(): Promise<boolean> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 3000);

  try {
    const resp = await fetch(
      "https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js",
      { method: "HEAD", mode: "no-cors", signal: controller.signal },
    );
    /* no-cors returns opaque (status 0) even on success – reaching here means
       the request was NOT blocked by an adblocker at the network level */
    return resp.type === "opaque" || resp.ok;
  } catch {
    /* AdBlocker or network error blocked the request */
    return false;
  } finally {
    clearTimeout(timer);
  }
}

/* ---------------------------------------------------------------- */
/*  3. Dynamic Canvas Noise Test                                    */
/* ---------------------------------------------------------------- */
function renderTestCanvas(c: HTMLCanvasElement): void {
  const ctx = c.getContext("2d");
  if (!ctx) return;
  c.width = 200;
  c.height = 100;
  ctx.fillStyle = "#4a6fa5";
  ctx.fillRect(10, 10, 180, 80);
  ctx.fillStyle = "#ffffff";
  ctx.font = "bold 16px Arial, sans-serif";
  ctx.fillText("NoiseTest", 25, 55);
  ctx.fillStyle = "#ffcc00";
  ctx.beginPath();
  ctx.arc(150, 60, 15, 0, Math.PI * 2);
  ctx.fill();
}

function detectCanvasNoise(): { hasNoise: boolean; hashA: string; hashB: string } | null {
  try {
    const c = document.createElement("canvas");

    renderTestCanvas(c);
    const hashA = fnv1a(c.toDataURL("image/png"));

    renderTestCanvas(c);
    const hashB = fnv1a(c.toDataURL("image/png"));

    return { hasNoise: hashA !== hashB, hashA, hashB };
  } catch {
    return null;
  }
}

/* ---------------------------------------------------------------- */
/*  4. Privacy Signals (GPC / DNT)                                  */
/* ---------------------------------------------------------------- */
function checkPrivacySignals(): {
  gpc: boolean | null;
  dnt: boolean | null;
} {
  const nav = navigator as Navigator & { globalPrivacyControl?: boolean };
  return {
    gpc: typeof nav.globalPrivacyControl === "boolean" ? nav.globalPrivacyControl : null,
    dnt: navigator.doNotTrack === "1" || navigator.doNotTrack === "yes" ? true : null,
  };
}

/* ---------------------------------------------------------------- */
/*  5. Firefox RFP Detection                                        */
/* ---------------------------------------------------------------- */
function detectRFP(): { likelyRFP: boolean; reasons: string[] } {
  const reasons: string[] = [];
  const isFirefox = /firefox/i.test(navigator.userAgent);

  /* RFP forces UTC timezone */
  const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
  if (tz === "UTC") reasons.push("timeZone forced to UTC");

  /* RFP rounds screen dimensions */
  if (screen.width % 100 !== 0 && screen.availWidth % 100 !== 0) {
    /* Not obviously rounded, but still possible */
  }

  /* RFP spoofs platform to Win32 on macOS/Linux */
  if (!/win/i.test(navigator.platform) && isFirefox) {
    /* On Firefox non-Windows, RFP would normally set it to Win32 – this is not RFP */
  }
  if (/win/i.test(navigator.platform) && !/windows/i.test(navigator.userAgent) && isFirefox) {
    reasons.push("platform spoofed to Win32 on non-Windows");
  }

  return {
    likelyRFP: isFirefox && reasons.length >= 1,
    reasons,
  };
}

/* ---------------------------------------------------------------- */
/*  Main entry point                                                */
/* ---------------------------------------------------------------- */
export async function execute(): Promise<{
  probes: ProbeResult[];
  anomalies: LieReport[];
}> {
  const probes: ProbeResult[] = [];
  const anomalies: LieReport[] = [];

  /* ---- 1. AdBlocker DOM bait ---- */
  const domResult = await domBaitTest();
  runProbe(probes, anomalies, "adblockDOM", "AdBlocker DOM bait detection", () => ({
    passed: !domResult.blocked,
    value: domResult,
    detail: domResult.blocked ? "Bait element was removed or hidden by content filter" : undefined,
  }), domResult.blocked ? { severity: 2, title: "AdBlocker / Content Filter Detected (DOM)", category: "hardening" } : undefined);

  /* ---- 2. AdBlocker network bait ---- */
  const networkOk = await networkBaitTest();
  runProbe(probes, anomalies, "adblockNetwork", "AdBlocker network bait detection", () => ({
    passed: networkOk,
    value: networkOk ? "reachable" : "blocked",
    detail: networkOk ? undefined : "Request to ad network URL was blocked",
  }), !networkOk ? { severity: 2, title: "AdBlocker / Extension Detected (Network)", category: "hardening" } : undefined);

  /* ---- 3. Canvas noise ---- */
  const noiseResult = detectCanvasNoise();
  runProbe(probes, anomalies, "canvasNoise", "Dynamic canvas noise injection", () => {
    if (!noiseResult) return { passed: true, value: "unavailable", detail: undefined };
    return {
      passed: !noiseResult.hasNoise,
      value: noiseResult,
      detail: noiseResult.hasNoise ? "Consecutive renders differ – anti-fingerprinting noise active" : undefined,
    };
  }, noiseResult?.hasNoise ? { severity: 3, title: "Dynamic Canvas Noise Spoofing", category: "hardening" } : undefined);

  /* ---- 4. GPC & DNT ---- */
  const signals = checkPrivacySignals();

  runProbe(probes, anomalies, "gpc", "Global Privacy Control (GPC)", () => ({
    passed: true,
    value: signals.gpc === true ? "enabled" : signals.gpc === false ? "disabled" : "unsupported",
  }), signals.gpc === true ? { severity: 0, title: "Global Privacy Control (GPC) Enabled", category: "hardening" } : undefined);

  runProbe(probes, anomalies, "dnt", "Do Not Track (DNT)", () => ({
    passed: true,
    value: signals.dnt === true ? "enabled" : "disabled / unsupported",
  }), signals.dnt === true ? { severity: 0, title: "Do Not Track (DNT) Enabled", category: "hardening" } : undefined);

  /* ---- 5. Firefox RFP ---- */
  const rfp = detectRFP();
  runProbe(probes, anomalies, "rfp", "Firefox resistFingerprinting (RFP)", () => ({
    passed: true,
    value: rfp,
  }), rfp.likelyRFP ? { severity: 1, title: "Firefox RFP – Fingerprinting Protection Active", category: "hardening" } : undefined);

  return { probes, anomalies };
}
