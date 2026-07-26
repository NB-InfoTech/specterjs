import type { ProbeResult, LieReport } from "../types/index.js";

const MODULE = "webAudio";

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
  severity: number,
  check: () => { passed: boolean; value: unknown; detail?: string },
): void {
  const start = performance.now();
  try {
    const r = check();
    probes.push({
      id: `audio:${id}`,
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
      id: `audio:${id}`,
      label,
      status: "blocked",
      value: null,
      message: err instanceof Error ? err.message : String(err),
      durationMs: Math.round(performance.now() - start),
    });
  }
}

/* ------------------------------------------------------------------ */
/*  Async audio fingerprint rendering                                 */
/* ------------------------------------------------------------------ */
async function renderAudioFingerprint(): Promise<{
  hash: string;
  samples: number;
  channels: number;
} | null> {
  const ctx = new OfflineAudioContext({ numberOfChannels: 1, length: 44100, sampleRate: 44100 });

  const osc = ctx.createOscillator();
  osc.type = "sawtooth";
  osc.frequency.value = 440;

  const osc2 = ctx.createOscillator();
  osc2.type = "triangle";
  osc2.frequency.value = 880;

  const compressor = ctx.createDynamicsCompressor();
  compressor.threshold.value = -50;
  compressor.knee.value = 40;
  compressor.ratio.value = 12;
  compressor.attack.value = 0;
  compressor.release.value = 0.25;

  const gain = ctx.createGain();
  gain.gain.value = 0.3;

  osc.connect(compressor);
  osc2.connect(compressor);
  compressor.connect(gain);
  gain.connect(ctx.destination);

  osc.start(0);
  osc2.start(0);

  const buffer = await ctx.startRendering();
  const channel = buffer.getChannelData(0);

  if (!channel || channel.length === 0) return null;

  /* Downsample to 1024 samples for a stable fingerprint */
  const step = Math.max(1, Math.floor(channel.length / 1024));
  const values: number[] = [];
  for (let i = 0; i < channel.length && values.length < 1024; i += step) {
    values.push(channel[i] ?? 0);
  }

  const hash = fnv1a(values.map((v) => v.toFixed(6)).join("|"));
  return { hash, samples: channel.length, channels: buffer.numberOfChannels };
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

  /* ---- Availability check ---- */
  try {
    new OfflineAudioContext({ numberOfChannels: 1, length: 1, sampleRate: 44100 });
  } catch {
    runProbe(probes, anomalies, "availability", "OfflineAudioContext availability", 3, () => ({
      passed: false,
      value: "unavailable",
      detail: "OfflineAudioContext is blocked or not supported",
    }));
    return { probes, anomalies };
  }

  runProbe(probes, anomalies, "availability", "OfflineAudioContext availability", 0, () => ({
    passed: true,
    value: "available",
  }));

  /* ---- Audio fingerprint ---- */
  const start = performance.now();
  let fp: Awaited<ReturnType<typeof renderAudioFingerprint>> = null;
  try {
    fp = await renderAudioFingerprint();
  } catch (err) {
    runProbe(probes, anomalies, "fingerprint", "AudioContext dynamics fingerprint", 4, () => ({
      passed: false,
      value: null,
      detail: err instanceof Error ? err.message : "Audio rendering failed",
    }));
    return { probes, anomalies };
  }

  if (!fp) {
    runProbe(probes, anomalies, "fingerprint", "AudioContext dynamics fingerprint", 4, () => ({
      passed: false,
      value: null,
      detail: "Audio buffer is empty",
    }));
    return { probes, anomalies };
  }

  probes.push({
    id: "audio:fingerprint",
    label: "AudioContext dynamics fingerprint",
    status: "success",
    value: { hash: fp.hash, samples: fp.samples, channels: fp.channels },
    durationMs: Math.round(performance.now() - start),
  });

  return { probes, anomalies };
}
