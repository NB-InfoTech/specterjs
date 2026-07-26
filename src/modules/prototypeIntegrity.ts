import type { ProbeResult, LieReport } from "../types/index.js";

type ProbeStatus = "success" | "blocked" | "error";

interface CheckOutput {
  passed: boolean;
  value: unknown;
  detail?: string;
}

interface NativeFnDef {
  id: string;
  label: string;
  severity: number;
  fn: () => Function | null;
}

interface ProtoPairDef {
  id: string;
  label: string;
  severity: number;
  accessor: (w: Window) => object | null;
}

const MODULE = "prototypeIntegrity";

/* ------------------------------------------------------------------ */
/*  Helper: run a single probe with timing, error boundary & anomaly  */
/* ------------------------------------------------------------------ */
function runProbe(
  probes: ProbeResult[],
  anomalies: LieReport[],
  id: string,
  label: string,
  severity: number,
  check: () => CheckOutput,
): void {
  const start = performance.now();

  try {
    const result = check();
    const status: ProbeStatus = result.passed ? "success" : "error";

    probes.push({
      id: `prototype:${id}`,
      label,
      status,
      value: result.value,
      durationMs: Math.round(performance.now() - start),
    });

    if (!result.passed) {
      anomalies.push({
        code: id,
        title: label,
        detail: result.detail ?? "Unexpected value – possible tampering",
        severity,
        source: MODULE,
      });
    }
  } catch (err) {
    probes.push({
      id: `prototype:${id}`,
      label,
      status: "blocked",
      value: null,
      message: err instanceof Error ? err.message : String(err),
      durationMs: Math.round(performance.now() - start),
    });
  }
}

/* ---------------------------------------------------------------- */
/*  1. Native Function.prototype.toString integrity checks          */
/* ---------------------------------------------------------------- */
function extractNativeString(fn: Function): string | null {
  try {
    const raw = Function.prototype.toString.call(fn);
    return typeof raw === "string" ? raw : null;
  } catch {
    return null;
  }
}

function checkNativeFunctions(
  probes: ProbeResult[],
  anomalies: LieReport[],
): void {
  const NATIVE_FNS: NativeFnDef[] = [
    { id: "toString:ObjectToString", label: "Object.prototype.toString is native", severity: 9, fn: () => Object.prototype.toString },
    { id: "toString:FunctionToString", label: "Function.prototype.toString is native", severity: 9, fn: () => Function.prototype.toString },
    { id: "toString:sendBeacon", label: "navigator.sendBeacon is native", severity: 7, fn: () => navigator.sendBeacon.bind(navigator) },
    { id: "toString:toDataURL", label: "HTMLCanvasElement.toDataURL is native", severity: 7, fn: () => HTMLCanvasElement.prototype.toDataURL },
    { id: "toString:getUserMedia", label: "navigator.mediaDevices.getUserMedia is native", severity: 7, fn: () => navigator.mediaDevices?.getUserMedia?.bind(navigator.mediaDevices) ?? null },
    { id: "toString:createOscillator", label: "AudioContext.prototype.createOscillator is native", severity: 7, fn: () => AudioContext.prototype.createOscillator },
    { id: "toString:getParameter", label: "WebGLRenderingContext.getParameter is native", severity: 7, fn: () => {
      const c = document.createElement("canvas");
      const gl = c.getContext("webgl") as WebGLRenderingContext | null;
      return gl?.getParameter?.bind(gl) ?? null;
    }},
    { id: "toString:createOffer", label: "RTCPeerConnection.prototype.createOffer is native", severity: 7, fn: () => RTCPeerConnection.prototype.createOffer },
    { id: "toString:fetch", label: "fetch is native", severity: 7, fn: () => fetch },
    { id: "toString:JSONparse", label: "JSON.parse is native", severity: 7, fn: () => JSON.parse },
    { id: "toString:JSONstringify", label: "JSON.stringify is native", severity: 7, fn: () => JSON.stringify },
    { id: "toString:btoa", label: "btoa is native", severity: 7, fn: () => btoa },
    { id: "toString:postMessage", label: "window.postMessage is native", severity: 5, fn: () => window.postMessage },
  ];

  for (const def of NATIVE_FNS) {
    runProbe(probes, anomalies, def.id, def.label, def.severity, () => {
      const fn = def.fn();
      if (fn === null) {
        return { passed: true, value: "unavailable" };
      }
      const str = extractNativeString(fn);
      if (str === null) {
        return { passed: false, value: null, detail: "Could not extract toString output" };
      }
      const isNative = /\{\s*\[native code\]\s*\}/.test(str);
      return {
        passed: isNative,
        value: str.length > 120 ? str.slice(0, 120) + "…" : str,
        detail: isNative ? undefined : `Native pattern missing: ${str.slice(0, 200)}`,
      };
    });
  }
}

/* ---------------------------------------------------------------- */
/*  2. Iframe prototype synchronisation check                       */
/* ---------------------------------------------------------------- */
async function createHiddenIframe(): Promise<HTMLIFrameElement | null> {
  try {
    const ifr = document.createElement("iframe");
    ifr.style.display = "none";
    ifr.src = "about:blank";
    (document.body ?? document.documentElement).appendChild(ifr);

    await new Promise<void>((resolve, reject) => {
      const timeout = setTimeout(() => reject(new Error("iframe load timeout")), 5_000);
      const done = (err?: Error) => {
        clearTimeout(timeout);
        if (err) reject(err); else resolve();
      };
      ifr.onload = () => done();
      ifr.onerror = () => done(new Error("iframe load failed"));
      if (ifr.contentDocument?.readyState === "complete") done();
    });

    return ifr;
  } catch {
    return null;
  }
}

async function checkIframePrototypes(
  probes: ProbeResult[],
  anomalies: LieReport[],
): Promise<void> {
  let ifr: HTMLIFrameElement | null = null;

  try {
    ifr = await createHiddenIframe();
  } catch {
    runProbe(probes, anomalies, "iframe:creation", "Iframe creation for prototype sync", 3, () => ({
      passed: true,
      value: "blocked",
    }));
    return;
  }

  if (!ifr || !ifr.contentWindow) {
    runProbe(probes, anomalies, "iframe:creation", "Iframe creation for prototype sync", 3, () => ({
      passed: true,
      value: "blocked",
    }));
    return;
  }

  const iframeWin: Window = ifr.contentWindow;

  const PAIRS: ProtoPairDef[] = [
    { id: "proto:navigator", label: "Navigator prototype matches iframe", severity: 6, accessor: (w) => Object.getPrototypeOf(w.navigator) },
    { id: "proto:document", label: "Document prototype matches iframe", severity: 6, accessor: (w) => Object.getPrototypeOf(w.document) },
    { id: "proto:history", label: "History prototype matches iframe", severity: 5, accessor: (w) => Object.getPrototypeOf(w.history) },
    { id: "proto:location", label: "Location prototype matches iframe", severity: 5, accessor: (w) => Object.getPrototypeOf(w.location) },
    { id: "proto:window", label: "Window prototype matches iframe", severity: 5, accessor: (w) => Object.getPrototypeOf(w) },
  ];

  for (const pair of PAIRS) {
    runProbe(probes, anomalies, pair.id, pair.label, pair.severity, () => {
      const mainProto = pair.accessor(window);
      const ifrProto = pair.accessor(iframeWin);

      if (!mainProto || !ifrProto) {
        return { passed: true, value: { main: mainProto, iframe: ifrProto } };
      }

      // Direct reference equality – tampered prototypes won't match
      const match = mainProto === ifrProto;
      return {
        passed: match,
        value: {
          main: mainProto.constructor?.name ?? null,
          iframe: ifrProto.constructor?.name ?? null,
          match,
        },
        detail: match
          ? undefined
          : `Prototype reference mismatch: main="${mainProto.constructor?.name}", iframe="${ifrProto.constructor?.name}"`,
      };
    });
  }

  // Cleanup
  try {
    ifr.parentNode?.removeChild(ifr);
  } catch { /* ignore */ }
}

/* ---------------------------------------------------------------- */
/*  3. Navigator Proxy / trap detection                             */
/* ---------------------------------------------------------------- */
function checkNavigatorProxy(
  probes: ProbeResult[],
  anomalies: LieReport[],
): void {
  /* 3a. Own-property descriptor of window.navigator */
  runProbe(probes, anomalies, "trap:navigatorDescriptor", "navigator has a valid property descriptor", 7, () => {
    const desc = Object.getOwnPropertyDescriptor(window, "navigator");
    if (!desc) {
      return { passed: false, value: null, detail: "window.navigator has no property descriptor – likely Proxy" };
    }
    // Native navigator is a configurable getter on window
    const isGetter = typeof desc.get === "function";
    const getterStr = isGetter ? extractNativeString(desc.get as Function) : null;
    const nativeGetter = getterStr !== null && /\{\s*\[native code\]\s*\}/.test(getterStr);
    return {
      passed: nativeGetter,
      value: { configurable: desc.configurable, enumerable: desc.enumerable, getterIsNative: nativeGetter },
      detail: nativeGetter ? undefined : "navigator getter is not native – likely replaced by Proxy",
    };
  });

  /* 3b. navigator.plugins reference stability */
  runProbe(probes, anomalies, "trap:pluginsStability", "navigator.plugins returns stable reference", 6, () => {
    const a = navigator.plugins;
    const b = navigator.plugins;
    const stable = a === b;
    return {
      passed: stable,
      value: stable,
      detail: stable ? undefined : "navigator.plugins returns different references per access – likely Proxy trap",
    };
  });

  /* 3c. navigator.mimeTypes reference stability */
  runProbe(probes, anomalies, "trap:mimeTypesStability", "navigator.mimeTypes returns stable reference", 6, () => {
    const a = navigator.mimeTypes;
    const b = navigator.mimeTypes;
    const stable = a === b;
    return {
      passed: stable,
      value: stable,
      detail: stable ? undefined : "navigator.mimeTypes returns different references per access – likely Proxy trap",
    };
  });

  /* 3d. navigator.userAgent type & consistency */
  runProbe(probes, anomalies, "trap:userAgentType", "navigator.userAgent is a non-empty string", 5, () => {
    const ua = navigator.userAgent;
    const valid = typeof ua === "string" && ua.length > 0;
    return {
      passed: valid,
      value: valid ? ua.slice(0, 120) : typeof ua,
      detail: valid ? undefined : `userAgent is not a normal string: ${typeof ua}`,
    };
  });

  /* 3e. Check for Proxy on Object.keys(navigator) – native should have ~5 own props */
  runProbe(probes, anomalies, "trap:navigatorOwnKeys", "navigator has expected own property count", 4, () => {
    const keys = Object.getOwnPropertyNames(navigator);
    // Native Navigator exposes very few own properties; most are on the prototype.
    // A high count or unusual keys suggests a Proxy or injected properties.
    const suspicious = keys.length > 20;
    return {
      passed: !suspicious,
      value: { count: keys.length, keys: keys.slice(0, 15) },
      detail: suspicious ? `navigator has ${keys.length} own properties – unusual` : undefined,
    };
  });

  /* 3f. Compare prototypes via iframe (already done above, but add a specific check here) */
  /* 3g. Symbol.toStringTag consistency */
  runProbe(probes, anomalies, "trap:toStringTag", "navigator[Symbol.toStringTag] is consistent", 4, () => {
    const tag = Object.prototype.toString.call(navigator);
    const expected = "[object Navigator]";
    const match = tag === expected;
    return {
      passed: match,
      value: tag,
      detail: match ? undefined : `navigator toStringTag is "${tag}" instead of "${expected}"`,
    };
  });
}

/* ---------------------------------------------------------------- */
/*  4. Additional global integrity checks                           */
/* ---------------------------------------------------------------- */
function checkGlobalOverrides(
  probes: ProbeResult[],
  anomalies: LieReport[],
): void {
  /* 4a. document.all – the IE-era falsy-object quirk */
  runProbe(probes, anomalies, "override:documentAll", "document.all exhibits correct falsy-object semantics", 6, () => {
    const exists = "all" in document;
    if (!exists) {
      return { passed: true, value: "not present" };
    }
    // Route through unknown so typeof reveals the runtime [[IsHTMLDDA]] quirk
    const rawAll: unknown = document.all;
    const typeOfAll = typeof rawAll;
    const inBoolean = !rawAll;
    const typeIsUndefined = typeOfAll === "undefined";
    // Spec: typeof document.all === "undefined" and Boolean(document.all) === false
    const correct = typeIsUndefined && inBoolean === true;
    return {
      passed: correct,
      value: { typeof: typeOfAll, boolean: inBoolean },
      detail: correct ? undefined : `document.all semantics broken: typeof=${typeOfAll}, Boolean=${inBoolean}`,
    };
  });

  /* 4b. Element.prototype.hasAttribute – common hook target */
  runProbe(probes, anomalies, "override:hasAttribute", "Element.prototype.hasAttribute is native", 7, () => {
    const str = extractNativeString(Element.prototype.hasAttribute);
    if (str === null) return { passed: false, value: null, detail: "Could not extract toString" };
    const native = /\{\s*\[native code\]\s*\}/.test(str);
    return { passed: native, value: str.slice(0, 120), detail: native ? undefined : "hasAttribute overridden" };
  });

  /* 4c. Storage.prototype.getItem – common hook target for fingerprinting scripts */
  runProbe(probes, anomalies, "override:getItem", "Storage.prototype.getItem is native", 7, () => {
    const str = extractNativeString(Storage.prototype.getItem);
    if (str === null) return { passed: false, value: null, detail: "Could not extract toString" };
    const native = /\{\s*\[native code\]\s*\}/.test(str);
    return { passed: native, value: str.slice(0, 120), detail: native ? undefined : "getItem overridden" };
  });
}

/* ---------------------------------------------------------------- */
/*  Main entry point                                                */
/* ---------------------------------------------------------------- */
export async function execute(): Promise<{ probes: ProbeResult[]; anomalies: LieReport[] }> {
  const probes: ProbeResult[] = [];
  const anomalies: LieReport[] = [];

  checkNativeFunctions(probes, anomalies);
  await checkIframePrototypes(probes, anomalies);
  checkNavigatorProxy(probes, anomalies);
  checkGlobalOverrides(probes, anomalies);

  return { probes, anomalies };
}
