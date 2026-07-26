import type { ProbeResult, LieReport } from "../types/index.js";

const MODULE = "canvasWebGL";

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

/** FNV-1a 32-bit hash – deterministic, fast, no external deps */
function fnv1a(data: string): string {
  let hash = 0x811c9dc5 >>> 0;
  for (let i = 0; i < data.length; i++) {
    hash ^= data.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return hash.toString(16).padStart(8, "0");
}

function extractNativeString(fn: Function): string | null {
  try {
    const raw = Function.prototype.toString.call(fn);
    return typeof raw === "string" ? raw : null;
  } catch {
    return null;
  }
}

function isNative(str: string | null): boolean {
  return str !== null && /\{\s*\[native code\]\s*\}/.test(str);
}

/** Score a probe result into the shared arrays */
function runProbe(
  probes: ProbeResult[],
  anomalies: LieReport[],
  id: string,
  label: string,
  severity: number,
  check: () => { passed: boolean; value: unknown; detail?: string },
): void {
  const start = performance.now();
  try {
    const r = check();
    probes.push({
      id: `canvas:${id}`,
      label,
      status: r.passed ? "success" : "error",
      value: r.value,
      durationMs: Math.round(performance.now() - start),
    });
    if (!r.passed) {
      anomalies.push({
        code: id,
        title: label,
        detail: r.detail ?? "Unexpected result – possible tampering",
        severity,
        source: MODULE,
      });
    }
  } catch (err) {
    probes.push({
      id: `canvas:${id}`,
      label,
      status: "blocked",
      value: null,
      message: err instanceof Error ? err.message : String(err),
      durationMs: Math.round(performance.now() - start),
    });
  }
}

/* ------------------------------------------------------------------ */
/*  1. 2D Canvas fingerprinting                                       */
/* ------------------------------------------------------------------ */

function renderTestImage(canvas: HTMLCanvasElement): void {
  const ctx = canvas.getContext("2d");
  if (!ctx) return;

  canvas.width = 500;
  canvas.height = 300;

  /* -- Background gradient -- */
  const grad = ctx.createLinearGradient(0, 0, 500, 300);
  grad.addColorStop(0, "#ff6b6b");
  grad.addColorStop(0.5, "#4ecdc4");
  grad.addColorStop(1, "#45b7d1");
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 500, 300);

  /* -- Semi-transparent circles -- */
  ctx.fillStyle = "rgba(255, 255, 255, 0.85)";
  ctx.beginPath();
  ctx.arc(120, 80, 55, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = "rgba(0, 0, 0, 0.25)";
  ctx.fillRect(330, 90, 110, 70);

  /* -- Text with fallback fonts -- */
  ctx.font = 'bold 26px "Segoe UI", Arial, Helvetica, sans-serif';
  ctx.fillStyle = "#ffffff";
  ctx.fillText("SpecterJS", 40, 180);

  ctx.font = '14px "Cascadia Code", "Fira Code", monospace';
  ctx.fillStyle = "#ffe066";
  ctx.fillText("CANVAS_FINGERPRINT_v1", 40, 220);

  /* -- Emoji sequence -- */
  ctx.font = "42px sans-serif";
  ctx.fillText("\uD83D\uDD0D\uD83D\uDD2C\uD83D\uDEE1\uFE0F", 320, 160);

  /* -- Drop-shadow rectangle -- */
  ctx.shadowColor = "rgba(0, 0, 0, 0.6)";
  ctx.shadowBlur = 12;
  ctx.fillStyle = "#a29bfe";
  ctx.fillRect(390, 30, 70, 90);
  ctx.shadowColor = "transparent";
  ctx.shadowBlur = 0;

  /* -- Small detail: arc with stroke -- */
  ctx.strokeStyle = "#fd79a8";
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.arc(400, 240, 40, 0, Math.PI * 1.5);
  ctx.stroke();
}

function captureCanvasHash(): {
  dataUrl: string;
  hash: string;
  width: number;
  height: number;
} | null {
  const canvas = document.createElement("canvas");
  renderTestImage(canvas);
  try {
    const dataUrl = canvas.toDataURL("image/png");
    if (typeof dataUrl !== "string" || !dataUrl.startsWith("data:image/")) {
      return null;
    }
    return {
      dataUrl,
      hash: fnv1a(dataUrl),
      width: canvas.width,
      height: canvas.height,
    };
  } catch {
    return null;
  }
}

/* ------------------------------------------------------------------ */
/*  2. WebGL & GPU unmasked info                                      */
/* ------------------------------------------------------------------ */

function getWebGLContext(): WebGLRenderingContext | null {
  try {
    const c = document.createElement("canvas");
    let gl = c.getContext("webgl") as WebGLRenderingContext | null;
    if (!gl) {
      gl = c.getContext("experimental-webgl") as WebGLRenderingContext | null;
    }
    return gl;
  } catch {
    return null;
  }
}

interface WebGLInfo {
  vendor: string;
  renderer: string;
  unmaskedVendor: string | null;
  unmaskedRenderer: string | null;
  maxTextureSize: number;
  extensions: string[];
  shaderPrecision: string | null;
}

function collectWebGLInfo(gl: WebGLRenderingContext): WebGLInfo {
  /* Standard parameters */
  const vendor = String(gl.getParameter(gl.VENDOR) ?? "");
  const renderer = String(gl.getParameter(gl.RENDERER) ?? "");
  const maxTextureSize = (gl.getParameter(gl.MAX_TEXTURE_SIZE) as number) ?? 0;

  /* Extensions */
  const extList = gl.getSupportedExtensions() ?? [];
  const extensions = [...extList].sort();

  /* Unmasked vendor / renderer via debug extension */
  const debugExt = gl.getExtension("WEBGL_debug_renderer_info") as
    | { UNMASKED_VENDOR_WEBGL?: number; UNMASKED_RENDERER_WEBGL?: number }
    | null;

  let unmaskedVendor: string | null = null;
  let unmaskedRenderer: string | null = null;
  if (debugExt && debugExt.UNMASKED_VENDOR_WEBGL && debugExt.UNMASKED_RENDERER_WEBGL) {
    try {
      unmaskedVendor = String(gl.getParameter(debugExt.UNMASKED_VENDOR_WEBGL) ?? "");
      unmaskedRenderer = String(gl.getParameter(debugExt.UNMASKED_RENDERER_WEBGL) ?? "");
    } catch {
      /* Extension exists but parameters blocked */
    }
  }

  /* Fragment shader high-precision range */
  let shaderPrecision: string | null = null;
  try {
    const prec = gl.getShaderPrecisionFormat(gl.FRAGMENT_SHADER, gl.HIGH_FLOAT);
    if (prec) {
      shaderPrecision = `${prec.precision} bits (${prec.rangeMin}..${prec.rangeMax})`;
    }
  } catch {
    /* ignored */
  }

  return { vendor, renderer, unmaskedVendor, unmaskedRenderer, maxTextureSize, extensions, shaderPrecision };
}

/* ------------------------------------------------------------------ */
/*  3. Canvas noise & tampering detection                             */
/* ------------------------------------------------------------------ */

function detectCanvasNoise(): {
  hasNoise: boolean;
  sampleA: string;
  sampleB: string;
} | null {
  try {
    const c = document.createElement("canvas");
    renderTestImage(c);
    const dataA = c.toDataURL("image/png");
    renderTestImage(c);
    const dataB = c.toDataURL("image/png");
    if (typeof dataA !== "string" || typeof dataB !== "string") return null;
    return { hasNoise: dataA !== dataB, sampleA: dataA.slice(0, 60), sampleB: dataB.slice(0, 60) };
  } catch {
    return null;
  }
}

/* ------------------------------------------------------------------ */
/*  Main entry point                                                  */
/* ------------------------------------------------------------------ */
export async function execute(): Promise<{
  probes: ProbeResult[];
  anomalies: LieReport[];
}> {
  const probes: ProbeResult[] = [];
  const anomalies: LieReport[] = [];

  /* ========  Canvas 2D ======== */

  /* Canvas fingerprint hash */
  runProbe(probes, anomalies, "fingerprint", "Canvas 2D fingerprint hash", 0, () => {
    const fp = captureCanvasHash();
    if (!fp) {
      return { passed: false, value: null, detail: "Failed to capture canvas fingerprint" };
    }
    return { passed: true, value: { hash: fp.hash, size: `${fp.width}\u00D7${fp.height}` } };
  });

  /* Canvas noise detection (two renders) */
  runProbe(probes, anomalies, "noiseCheck", "Canvas noise injection check", 7, () => {
    const result = detectCanvasNoise();
    if (!result) {
      return { passed: true, value: "unavailable" };
    }
    return {
      passed: !result.hasNoise,
      value: { hasNoise: result.hasNoise },
      detail: result.hasNoise
        ? "Consecutive canvas renders produce different output – anti-fingerprinting noise active"
        : undefined,
    };
  });

  /* toDataURL prototype integrity */
  runProbe(probes, anomalies, "toDataURLIntegrity", "HTMLCanvasElement.prototype.toDataURL is native", 7, () => {
    const str = extractNativeString(HTMLCanvasElement.prototype.toDataURL);
    const native = isNative(str);
    return {
      passed: native,
      value: str?.slice(0, 120),
      detail: native ? undefined : "toDataURL has been overridden or proxied",
    };
  });

  /* ========  WebGL ======== */

  const gl = getWebGLContext();

  runProbe(probes, anomalies, "webgl:availability", "WebGL context availability", 0, () => {
    if (!gl) {
      return { passed: false, value: "unavailable", detail: "WebGL is disabled or blocked" };
    }
    return { passed: true, value: "available" };
  });

  if (gl) {
    const info = collectWebGLInfo(gl);

    /* Unmasked vendor */
    runProbe(probes, anomalies, "webgl:unmaskedVendor", "WebGL unmasked vendor", 0, () => ({
      passed: true,
      value: info.unmaskedVendor ?? info.vendor,
    }));

    /* Unmasked renderer */
    runProbe(probes, anomalies, "webgl:unmaskedRenderer", "WebGL unmasked renderer", 0, () => ({
      passed: true,
      value: info.unmaskedRenderer ?? info.renderer,
    }));

    /* Debug extension availability (for tampering detection) */
    const debugAvail = !!(info.unmaskedVendor || info.unmaskedRenderer);
    runProbe(probes, anomalies, "webgl:debugExtension", "WEBGL_debug_renderer_info availability", 3, () => ({
      passed: debugAvail,
      value: debugAvail ? "available" : "blocked",
      detail: debugAvail ? undefined : "WEBGL_debug_renderer_info is blocked – possible GPU spoofing",
    }));

    /* Max texture size */
    runProbe(probes, anomalies, "webgl:maxTextureSize", "WebGL max texture size", 0, () => ({
      passed: true,
      value: info.maxTextureSize,
    }));

    /* Extension count */
    runProbe(probes, anomalies, "webgl:extensions", "WebGL supported extensions", 0, () => ({
      passed: true,
      value: { count: info.extensions.length, list: info.extensions },
    }));

    /* Shader precision */
    runProbe(probes, anomalies, "webgl:shaderPrecision", "WebGL shader precision (HIGH_FLOAT)", 0, () => ({
      passed: true,
      value: info.shaderPrecision,
    }));

    /* getParameter integrity */
    runProbe(probes, anomalies, "webgl:getParameterIntegrity", "WebGLRenderingContext.getParameter is native", 7, () => {
      const str = extractNativeString(WebGLRenderingContext.prototype.getParameter);
      const native = isNative(str);
      return {
        passed: native,
        value: str?.slice(0, 120),
        detail: native ? undefined : "getParameter has been overridden or proxied",
      };
    });
  }

  /* ========  WebGL2 availability  ======== */
  runProbe(probes, anomalies, "webgl2:availability", "WebGL2 context availability", 0, () => {
    try {
      const c = document.createElement("canvas");
      const gl2 = c.getContext("webgl2") as WebGL2RenderingContext | null;
      return { passed: true, value: gl2 ? "available" : "unavailable" };
    } catch {
      return { passed: true, value: "unavailable" };
    }
  });

  return { probes, anomalies };
}
