import type { AuditReport, ProbeResult, LieReport } from "../types/index.js";
import { execute as prototypeCheck } from "../modules/prototypeIntegrity.js";
import { execute as workerCheck } from "../modules/workerCrossCheck.js";
import { execute as canvasCheck } from "../modules/canvasWebGL.js";
import { execute as audioCheck } from "../modules/webAudio.js";
import { execute as networkCheck } from "../modules/networkProbing.js";
import { execute as hardeningCheck } from "../modules/hardeningProbing.js";
import { calculate } from "./TrustScore.js";

interface ModuleEntry {
  name: string;
  fn: () => Promise<{ probes: ProbeResult[]; anomalies: LieReport[] }>;
}

const MODULES: ModuleEntry[] = [
  { name: "prototypeIntegrity", fn: prototypeCheck },
  { name: "workerCrossCheck", fn: workerCheck },
  { name: "canvasWebGL", fn: canvasCheck },
  { name: "webAudio", fn: audioCheck },
  { name: "networkProbing", fn: networkCheck },
  { name: "hardeningProbing", fn: hardeningCheck },
];

function getErrorMessage(err: unknown): string {
  if (err instanceof Error) return err.message;
  return String(err);
}

/**
 * Run every probe module, aggregate all results & anomalies, then
 * compute the final trust score.
 */
export async function runAudit(): Promise<AuditReport> {
  const results = await Promise.allSettled(
    MODULES.map(async (m) => {
      const out = await m.fn();
      return { name: m.name, ...out };
    }),
  );

  const allProbes: ProbeResult[] = [];
  const allAnomalies: LieReport[] = [];

  for (const result of results) {
    if (result.status === "fulfilled") {
      allProbes.push(...result.value.probes);
      allAnomalies.push(...result.value.anomalies);
    } else {
      const reason = result.reason;
      allProbes.push({
        id: "engine:moduleCrash",
        label: `Module crash: ${getErrorMessage(reason)}`,
        status: "error",
        value: null,
        message: getErrorMessage(reason),
      });
    }
  }

  const trust = calculate(allProbes, allAnomalies);

  return {
    version: "0.1.0",
    timestamp: new Date().toISOString(),
    userAgent: navigator.userAgent,
    probes: allProbes,
    anomalies: allAnomalies,
    trust,
  };
}
