import type { ProbeResult, LieReport } from "../types/index.js";

const MODULE = "workerCrossCheck";
const WORKER_TIMEOUT_MS = 2_000;

/* ------------------------------------------------------------------ */
/*  Inline worker code (serialised as a Blob)                         */
/* ------------------------------------------------------------------ */
interface WorkerTelemetry {
  userAgent: string;
  hardwareConcurrency: number;
  language: string;
  languages: readonly string[];
  platform: string;
  timeZone: string;
  error?: string;
}

function buildWorkerBlob(): Blob {
  const code = [
    "self.onmessage=function(){",
    "try{",
    'var tz="";',
    "try{tz=Intl.DateTimeFormat().resolvedOptions().timeZone}catch(e){}",
    "self.postMessage({",
    "userAgent:navigator.userAgent,",
    "hardwareConcurrency:navigator.hardwareConcurrency,",
    "language:navigator.language,",
    "languages:navigator.languages,",
    "platform:navigator.platform,",
    "timeZone:tz",
    "})",
    "}catch(e){self.postMessage({error:e.message})}",
    "}",
  ];
  return new Blob(code, { type: "application/javascript" });
}

/* ------------------------------------------------------------------ */
/*  Value comparison helpers                                          */
/* ------------------------------------------------------------------ */
function arraysEqual(a: readonly string[], b: readonly string[]): boolean {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) {
    if (a[i] !== b[i]) return false;
  }
  return true;
}

interface ComparisonResult<T> {
  passed: boolean;
  value: { main: T; worker: T };
  detail?: string;
}

function compareScalar<T extends string | number>(
  mainVal: T,
  workerVal: T,
): ComparisonResult<T> {
  const passed = mainVal === workerVal;
  return {
    passed,
    value: { main: mainVal, worker: workerVal },
    detail: passed
      ? undefined
      : `Mismatch – main: "${String(mainVal)}", worker: "${String(workerVal)}"`,
  };
}

function compareLanguages(
  mainVal: readonly string[],
  workerVal: readonly string[],
): ComparisonResult<readonly string[]> {
  const passed = arraysEqual(mainVal, workerVal);
  return {
    passed,
    value: { main: mainVal, worker: workerVal },
    detail: passed
      ? undefined
      : `Language list mismatch – main: [${mainVal.join(", ")}], worker: [${workerVal.join(", ")}]`,
  };
}

/* ------------------------------------------------------------------ */
/*  Severity map – higher means more suspicious                       */
/* ------------------------------------------------------------------ */
const SEVERITY: Record<string, number> = {
  userAgent: 9,
  platform: 8,
  hardwareConcurrency: 7,
  language: 6,
  languages: 6,
  timeZone: 5,
};

/* ------------------------------------------------------------------ */
/*  Main entry point                                                  */
/* ------------------------------------------------------------------ */
export async function execute(): Promise<{
  probes: ProbeResult[];
  anomalies: LieReport[];
}> {
  const probes: ProbeResult[] = [];
  const anomalies: LieReport[] = [];
  const overallStart = performance.now();

  /* ---- 1. Launch worker & collect telemetry ---- */
  let worker: Worker | null = null;
  let telemetry: WorkerTelemetry | null = null;
  let workerError: string | null = null;

  try {
    const blob = buildWorkerBlob();
    const url = URL.createObjectURL(blob);
    worker = new Worker(url);
    URL.revokeObjectURL(url);

    telemetry = await new Promise<WorkerTelemetry>((resolve, reject) => {
      const timer = setTimeout(() => {
        worker?.terminate();
        reject(new Error("Worker execution timed out"));
      }, WORKER_TIMEOUT_MS);

      worker!.onmessage = (e: MessageEvent) => {
        clearTimeout(timer);
        resolve(e.data as WorkerTelemetry);
      };
      worker!.onerror = (e: ErrorEvent) => {
        clearTimeout(timer);
        reject(new Error(e.message ?? "Unknown worker error"));
      };
      worker!.postMessage("start");
    });
  } catch (err) {
    workerError = err instanceof Error ? err.message : String(err);
  } finally {
    worker?.terminate();
  }

  /* ---- 2. Probe: worker availability ---- */
  const elapsed = Math.round(performance.now() - overallStart);

  if (workerError !== null || telemetry === null) {
    probes.push({
      id: "worker:availability",
      label: "Web Worker execution & telemetry collection",
      status: "blocked",
      value: null,
      message: workerError ?? "No telemetry returned",
      durationMs: elapsed,
    });
    return { probes, anomalies };
  }

  probes.push({
    id: "worker:availability",
    label: "Web Worker execution & telemetry collection",
    status: "success",
    value: "available",
    durationMs: elapsed,
  });

  if (telemetry.error) {
    probes.push({
      id: "worker:internalError",
      label: "Worker internal execution",
      status: "error",
      value: null,
      message: telemetry.error,
    });
    return { probes, anomalies };
  }

  /* ---- 3. Cross-check each field ---- */
  const checks: Array<{
    id: string;
    label: string;
    run: () => { passed: boolean; value: unknown; detail?: string };
  }> = [
    {
      id: "worker:userAgent",
      label: "navigator.userAgent matches worker",
      run: () => compareScalar(navigator.userAgent, telemetry!.userAgent),
    },
    {
      id: "worker:hardwareConcurrency",
      label: "navigator.hardwareConcurrency matches worker",
      run: () => compareScalar(navigator.hardwareConcurrency, telemetry!.hardwareConcurrency),
    },
    {
      id: "worker:language",
      label: "navigator.language matches worker",
      run: () => compareScalar(navigator.language, telemetry!.language),
    },
    {
      id: "worker:languages",
      label: "navigator.languages matches worker",
      run: () => compareLanguages(navigator.languages, telemetry!.languages),
    },
    {
      id: "worker:platform",
      label: "navigator.platform matches worker",
      run: () => compareScalar(navigator.platform, telemetry!.platform),
    },
    {
      id: "worker:timeZone",
      label: "Intl.DateTimeFormat timeZone matches worker",
      run: () => {
        const mainTz = Intl.DateTimeFormat().resolvedOptions().timeZone;
        return compareScalar(mainTz, telemetry!.timeZone);
      },
    },
  ];

  for (const check of checks) {
    const start = performance.now();
    try {
      const result = check.run();
      probes.push({
        id: check.id,
        label: check.label,
        status: result.passed ? "success" : "error",
        value: result.value,
        durationMs: Math.round(performance.now() - start),
      });

      if (!result.passed) {
        anomalies.push({
          code: check.id,
          title: "Execution Context Lie",
          detail: result.detail ?? "Cross-context property mismatch detected",
          severity: SEVERITY[check.id.split(":")[1] ?? ""] ?? 5,
          source: MODULE,
        });
      }
    } catch (err) {
      probes.push({
        id: check.id,
        label: check.label,
        status: "error",
        value: null,
        message: err instanceof Error ? err.message : String(err),
        durationMs: Math.round(performance.now() - start),
      });
    }
  }

  return { probes, anomalies };
}
