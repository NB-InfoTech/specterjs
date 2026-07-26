import type { ProbeResult, LieReport } from "../types/index.js";

const MODULE = "networkProbing";
const ICE_TIMEOUT_MS = 3_000;

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
      id: `network:${id}`,
      label,
      status: r.passed ? "success" : "error",
      value: r.value,
      durationMs: Math.round(performance.now() - start),
    });
    if (!r.passed) {
      anomalies.push({
        code: id,
        title: label,
        detail: r.detail ?? "Unexpected result",
        severity,
        source: MODULE,
      });
    }
  } catch (err) {
    probes.push({
      id: `network:${id}`,
      label,
      status: "blocked",
      value: null,
      message: err instanceof Error ? err.message : String(err),
      durationMs: Math.round(performance.now() - start),
    });
  }
}

/* ------------------------------------------------------------------ */
/*  WebRTC ICE candidate gathering                                    */
/* ------------------------------------------------------------------ */
async function gatherICECandidates(): Promise<{
  candidates: string[];
  addresses: string[];
}> {
  const config: RTCConfiguration = {
    iceServers: [{ urls: "stun:stun.l.google.com:19302" }],
  };

  const pc = new RTCPeerConnection(config);
  pc.createDataChannel("specterjs_ice");

  const offer = await pc.createOffer();
  await pc.setLocalDescription(offer);

  return new Promise((resolve, _reject) => {
    const addresses = new Set<string>();
    const candidates: string[] = [];

    const timer = setTimeout(() => {
      pc.close();
      resolve({ candidates, addresses: [...addresses] });
    }, ICE_TIMEOUT_MS);

    pc.onicecandidate = (ev: RTCPeerConnectionIceEvent) => {
      if (ev.candidate) {
        candidates.push(ev.candidate.candidate);
        /* Extract IP address from candidate string */
        const ipMatch = ev.candidate.candidate.match(/\b(\d{1,3}\.){3}\d{1,3}\b/);
        if (ipMatch) {
          addresses.add(ipMatch[0]);
        }
      }
    };

    pc.onicegatheringstatechange = () => {
      if (pc.iceGatheringState === "complete") {
        clearTimeout(timer);
        pc.close();
        resolve({ candidates: [...candidates], addresses: [...addresses] });
      }
    };

  });
}

/* ------------------------------------------------------------------ */
/*  High-resolution timer measurement                                 */
/* ------------------------------------------------------------------ */
function measureTimerResolution(): number {
  const samples: number[] = [];
  let last = performance.now();
  for (let i = 0; i < 500; i++) {
    const now = performance.now();
    const delta = now - last;
    if (delta > 0) {
      samples.push(delta);
    }
    last = now;
  }
  if (samples.length === 0) return 0;
  return Math.min(...samples);
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

  /* ---- WebRTC ICE ---- */
  try {
    const ice = await gatherICECandidates();

    runProbe(probes, anomalies, "webrtc", "WebRTC ICE candidates", 0, () => ({
      passed: true,
      value: { count: ice.candidates.length, addresses: ice.addresses },
    }));

    /* Detect blocked WebRTC (no candidates at all) */
    if (ice.candidates.length === 0) {
      runProbe(probes, anomalies, "webrtcBlocked", "WebRTC candidate availability", 4, () => ({
        passed: false,
        value: "empty",
        detail: "No ICE candidates gathered – WebRTC may be blocked or proxied",
      }));
    }
  } catch (err) {
    runProbe(probes, anomalies, "webrtc", "WebRTC ICE candidates", 4, () => ({
      passed: false,
      value: null,
      detail: err instanceof Error ? err.message : "WebRTC blocked or unavailable",
    }));
  }

  /* ---- Timer resolution ---- */
  const resolution = measureTimerResolution();
  runProbe(probes, anomalies, "timerResolution", "performance.now() resolution (ms)", 0, () => ({
    passed: true,
    value: resolution,
  }));

  /* Clamped timer detection (privacy protection) */
  runProbe(probes, anomalies, "timerClamping", "High-resolution timer clamping", 6, () => {
    const clamped = resolution >= 100;
    return {
      passed: !clamped,
      value: { resolutionMs: resolution, clamped },
      detail: clamped
        ? `Timer resolution is ${resolution.toFixed(2)}ms – indicates privacy clamping`
        : undefined,
    };
  });

  return { probes, anomalies };
}
