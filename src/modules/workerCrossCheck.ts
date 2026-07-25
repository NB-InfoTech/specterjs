const WORKER_CODE = `
self.onmessage = async function(e) {
  const { type, payload } = e.data;
  
  if (type === 'collect') {
    try {
      const results = {
        navigator: {
          userAgent: navigator.userAgent,
          appVersion: navigator.appVersion,
          platform: navigator.platform,
          vendor: navigator.vendor,
          language: navigator.language,
          languages: navigator.languages,
          hardwareConcurrency: navigator.hardwareConcurrency,
          deviceMemory: (navigator as any).deviceMemory,
          maxTouchPoints: navigator.maxTouchPoints,
          cookieEnabled: navigator.cookieEnabled,
          onLine: navigator.onLine,
          doNotTrack: navigator.doNotTrack,
          connection: navigator.connection ? {
            effectiveType: (navigator.connection as any).effectiveType,
            downlink: (navigator.connection as any).downlink,
            rtt: (navigator.connection as any).rtt,
            type: (navigator.connection as any).type
          } : null,
          userActivation: navigator.userActivation ? {
            isActive: navigator.userActivation.isActive,
            hasBeenActive: navigator.userActivation.hasBeenActive
          } : null,
          scheduling: navigator.scheduling ? {
            isInputPending: navigator.scheduling.isInputPending.bind(navigator.scheduling)
          } : null
        },
        screen: {
          width: screen.width,
          height: screen.height,
          availWidth: screen.availWidth,
          availHeight: screen.availHeight,
          colorDepth: screen.colorDepth,
          pixelDepth: screen.pixelDepth,
          orientation: screen.orientation ? {
            type: screen.orientation.type,
            angle: screen.orientation.angle
          } : null,
          deviceXDPI: (screen as any).deviceXDPI,
          deviceYDPI: (screen as any).deviceYDPI,
          logicalXDPI: (screen as any).logicalXDPI,
          logicalYDPI: (screen as any).logicalYDPI
        },
        timezone: {
          offset: new Date().getTimezoneOffset(),
          timezone: Intl.DateTimeFormat().resolvedOptions().timeZone
        },
        performance: {
          now: performance.now(),
          timing: performance.timing ? {
            navigationStart: performance.timing.navigationStart,
            loadEventEnd: performance.timing.loadEventEnd
          } : null,
          memory: (performance as any).memory ? {
            usedJSHeapSize: (performance as any).memory.usedJSHeapSize,
            totalJSHeapSize: (performance as any).memory.totalJSHeapSize,
            jsHeapSizeLimit: (performance as any).memory.jsHeapSizeLimit
          } : null
        },
        crypto: {
          getRandomValues: typeof crypto.getRandomValues === 'function',
          subtle: typeof crypto.subtle === 'object'
        },
        webgl: (() => {
          try {
            const canvas = new OffscreenCanvas(1, 1);
            const gl = canvas.getContext('webgl') || canvas.getContext('experimental-webgl');
            if (!gl) return null;
            
            const debugInfo = gl.getExtension('WEBGL_debug_renderer_info');
            return {
              vendor: gl.getParameter(gl.VENDOR),
              renderer: gl.getParameter(gl.RENDERER),
              version: gl.getParameter(gl.VERSION),
              shadingLanguageVersion: gl.getParameter(gl.SHADING_LANGUAGE_VERSION),
              unmaskedVendor: debugInfo ? gl.getParameter(debugInfo.UNMASKED_VENDOR_WEBGL) : null,
              unmaskedRenderer: debugInfo ? gl.getParameter(debugInfo.UNMASKED_RENDERER_WEBGL) : null,
              extensions: gl.getSupportedExtensions(),
              parameters: {
                maxTextureSize: gl.getParameter(gl.MAX_TEXTURE_SIZE),
                maxViewportDims: gl.getParameter(gl.MAX_VIEWPORT_DIMS),
                maxVertexAttribs: gl.getParameter(gl.MAX_VERTEX_ATTRIBS),
                maxVertexUniformVectors: gl.getParameter(gl.MAX_VERTEX_UNIFORM_VECTORS),
                maxFragmentUniformVectors: gl.getParameter(gl.MAX_FRAGMENT_UNIFORM_VECTORS),
                maxVaryingVectors: gl.getParameter(gl.MAX_VARYING_VECTORS),
                maxCombinedTextureImageUnits: gl.getParameter(gl.MAX_COMBINED_TEXTURE_IMAGE_UNITS),
                maxTextureImageUnits: gl.getParameter(gl.MAX_TEXTURE_IMAGE_UNITS),
                maxVertexTextureImageUnits: gl.getParameter(gl.MAX_VERTEX_TEXTURE_IMAGE_UNITS),
                maxCubeMapTextureSize: gl.getParameter(gl.MAX_CUBE_MAP_TEXTURE_SIZE),
                maxRenderbufferSize: gl.getParameter(gl.MAX_RENDERBUFFER_SIZE),
                aliasedLineWidthRange: gl.getParameter(gl.ALIASED_LINE_WIDTH_RANGE),
                aliasedPointSizeRange: gl.getParameter(gl.ALIASED_POINT_SIZE_RANGE),
                depthBits: gl.getParameter(gl.DEPTH_BITS),
                stencilBits: gl.getParameter(gl.STENCIL_BITS),
                redBits: gl.getParameter(gl.RED_BITS),
                greenBits: gl.getParameter(gl.GREEN_BITS),
                blueBits: gl.getParameter(gl.BLUE_BITS),
                alphaBits: gl.getParameter(gl.ALPHA_BITS)
              }
            };
          } catch (err) {
            return { error: String(err) };
          }
        })(),
        audio: (() => {
          try {
            const ctx = new OfflineAudioContext(1, 44100, 44100);
            const oscillator = ctx.createOscillator();
            const compressor = ctx.createDynamicsCompressor();
            
            oscillator.type = 'triangle';
            oscillator.frequency.value = 10000;
            
            compressor.threshold.value = -50;
            compressor.knee.value = 40;
            compressor.ratio.value = 12;
            compressor.attack.value = 0;
            compressor.release.value = 0.25;
            
            oscillator.connect(compressor);
            compressor.connect(ctx.destination);
            
            oscillator.start(0);
            oscillator.stop(0.1);
            
            const startTime = performance.now();
            const buffer = await ctx.startRendering();
            const renderTime = performance.now() - startTime;
            
            const channelData = buffer.getChannelData(0);
            let hash = 0;
            for (let i = 0; i < channelData.length; i += 100) {
              hash = ((hash << 5) - hash) + Math.abs(channelData[i] * 1000000) | 0;
            }
            
            return {
              fingerprint: hash.toString(16),
              sampleRate: buffer.sampleRate,
              length: buffer.length,
              duration: buffer.duration,
              numberOfChannels: buffer.numberOfChannels,
              renderTime,
              latency: ctx.baseLatency,
              oscillatorType: oscillator.type,
              compressorSettings: {
                threshold: compressor.threshold.value,
                knee: compressor.knee.value,
                ratio: compressor.ratio.value,
                attack: compressor.attack.value,
                release: compressor.release.value
              }
            };
          } catch (err) {
            return { error: String(err) };
          }
        })(),
        timing: {
          precision: (() => {
            const times: number[] = [];
            for (let i = 0; i < 100; i++) {
              times.push(performance.now());
            }
            const diffs = times.slice(1).map((t, i) => t - times[i]);
            const avg = diffs.reduce((a, b) => a + b, 0) / diffs.length;
            const variance = diffs.reduce((a, b) => a + Math.pow(b - avg, 2), 0) / diffs.length;
            return { average: avg, variance, min: Math.min(...diffs), max: Math.max(...diffs) };
          })()
        }
      };
      
      self.postMessage({ type: 'result', payload: results });
    } catch (err) {
      self.postMessage({ type: 'error', payload: String(err) });
    }
  }
  
  if (type === 'timing') {
    const iterations = payload.iterations || 1000;
    const start = performance.now();
    for (let i = 0; i < iterations; i++) {
      performance.now();
    }
    const end = performance.now();
    self.postMessage({ type: 'timing-result', payload: { totalTime: end - start, iterations } });
  }
};
`;

function createWorkerBlob(): Blob {
  return new Blob([WORKER_CODE], { type: 'application/javascript' });
}

function createWorker(): Worker {
  const blob = createWorkerBlob();
  const url = URL.createObjectURL(blob);
  const worker = new Worker(url);
  URL.revokeObjectURL(url);
  return worker;
}

interface WorkerMessage {
  type: 'collect' | 'timing' | 'result' | 'error' | 'timing-result';
  payload: unknown;
}

function sendWorkerMessage(worker: Worker, message: WorkerMessage): Promise<WorkerMessage> {
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      reject(new Error('Worker timeout'));
    }, 10000);
    
    const handler = (event: MessageEvent) => {
      if (event.data && typeof event.data === 'object' && 'type' in event.data) {
        clearTimeout(timeout);
        worker.removeEventListener('message', handler);
        resolve(event.data as WorkerMessage);
      }
    };
    
    worker.addEventListener('message', handler);
    worker.postMessage(message);
  });
}

async function collectWindowData(): Promise<Record<string, unknown>> {
  return {
    navigator: {
      userAgent: navigator.userAgent,
      appVersion: navigator.appVersion,
      platform: navigator.platform,
      vendor: navigator.vendor,
      language: navigator.language,
      languages: navigator.languages,
      hardwareConcurrency: navigator.hardwareConcurrency,
      deviceMemory: (navigator as any).deviceMemory,
      maxTouchPoints: navigator.maxTouchPoints,
      cookieEnabled: navigator.cookieEnabled,
      onLine: navigator.onLine,
      doNotTrack: navigator.doNotTrack,
      connection: navigator.connection ? {
        effectiveType: (navigator.connection as any).effectiveType,
        downlink: (navigator.connection as any).downlink,
        rtt: (navigator.connection as any).rtt,
        type: (navigator.connection as any).type
      } : null,
      userActivation: navigator.userActivation ? {
        isActive: navigator.userActivation.isActive,
        hasBeenActive: navigator.userActivation.hasBeenActive
      } : null,
      scheduling: navigator.scheduling ? {} : null
    },
    screen: {
      width: screen.width,
      height: screen.height,
      availWidth: screen.availWidth,
      availHeight: screen.availHeight,
      colorDepth: screen.colorDepth,
      pixelDepth: screen.pixelDepth,
      orientation: screen.orientation ? {
        type: screen.orientation.type,
        angle: screen.orientation.angle
      } : null,
      deviceXDPI: (screen as any).deviceXDPI,
      deviceYDPI: (screen as any).deviceYDPI,
      logicalXDPI: (screen as any).logicalXDPI,
      logicalYDPI: (screen as any).logicalYDPI
    },
    timezone: {
      offset: new Date().getTimezoneOffset(),
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone
    },
    performance: {
      now: performance.now(),
      timing: performance.timing ? {
        navigationStart: performance.timing.navigationStart,
        loadEventEnd: performance.timing.loadEventEnd
      } : null,
      memory: (performance as any).memory ? {
        usedJSHeapSize: (performance as any).memory.usedJSHeapSize,
        totalJSHeapSize: (performance as any).memory.totalJSHeapSize,
        jsHeapSizeLimit: (performance as any).memory.jsHeapSizeLimit
      } : null
    },
    crypto: {
      getRandomValues: typeof crypto.getRandomValues === 'function',
      subtle: typeof crypto.subtle === 'object'
    }
  };
}

function compareValues(path: string, windowValue: unknown, workerValue: unknown): { match: boolean; discrepancy?: string } {
  if (windowValue === workerValue) return { match: true };
  
  if (windowValue === null && workerValue === null) return { match: true };
  if (windowValue === undefined && workerValue === undefined) return { match: true };
  
  if (typeof windowValue !== typeof workerValue) {
    return { 
      match: false, 
      discrepancy: `Type mismatch: window=${typeof windowValue}, worker=${typeof workerValue}` 
    };
  }
  
  if (typeof windowValue === 'object' && windowValue !== null && workerValue !== null) {
    const wKeys = Object.keys(windowValue as object).sort();
    const wkKeys = Object.keys(workerValue as object).sort();
    
    if (wKeys.length !== wkKeys.length) {
      return { match: false, discrepancy: `Key count mismatch: window=${wKeys.length}, worker=${wkKeys.length}` };
    }
    
    for (const key of wKeys) {
      const subResult = compareValues(`${path}.${key}`, (windowValue as Record<string, unknown>)[key], (workerValue as Record<string, unknown>)[key]);
      if (!subResult.match) return subResult;
    }
    
    return { match: true };
  }
  
  if (Array.isArray(windowValue) && Array.isArray(workerValue)) {
    if (windowValue.length !== workerValue.length) {
      return { match: false, discrepancy: `Array length mismatch: window=${windowValue.length}, worker=${workerValue.length}` };
    }
    for (let i = 0; i < windowValue.length; i++) {
      const subResult = compareValues(`${path}[${i}]`, windowValue[i], workerValue[i]);
      if (!subResult.match) return subResult;
    }
    return { match: true };
  }
  
  return { match: false, discrepancy: `Value mismatch: window=${JSON.stringify(windowValue)}, worker=${JSON.stringify(workerValue)}` };
}

function compareTiming(windowTiming: number, workerTiming: number): { delta: number; anomaly: boolean } {
  const delta = Math.abs(windowTiming - workerTiming);
  const anomaly = delta > 50; // 50ms threshold for timing anomaly
  return { delta, anomaly };
}

import type {
  AuditResult,
  Anomaly,
  WorkerCrossCheckResult,
  WorkerComparisonResult,
  WorkerTimingResult,
  WorkerAnomaly,
  SpecterConfig,
  ModuleRunner
} from '../core/types.js';

export async function runWorkerCrossCheck(config: SpecterConfig): Promise<AuditResult<WorkerCrossCheckResult>> {
  const startTime = performance.now();
  const anomalies: Anomaly[] = [];
  
  if (typeof Worker === 'undefined') {
    return {
      module: 'workerCrossCheck',
      timestamp: Date.now(),
      duration: performance.now() - startTime,
      success: false,
      data: {} as WorkerCrossCheckResult,
      anomalies: [{
        id: `worker-unsupported-${Date.now()}`,
        module: 'workerCrossCheck',
        severity: 'low',
        category: 'execution_context_lie',
        description: 'Web Workers not supported in this environment',
        expected: 'Web Worker support',
        actual: 'Not supported',
        evidence: {},
        confidence: 1,
        timestamp: Date.now()
      }],
      error: 'Web Workers not supported'
    };
  }
  
  try {
    const worker = createWorker();
    
    const windowData = await collectWindowData();
    
    const collectPromise = sendWorkerMessage(worker, { type: 'collect', payload: {} });
    const timeoutPromise = new Promise<never>((_, reject) => 
      setTimeout(() => reject(new Error('Worker collection timeout')), config.workerTimeout)
    );
    
    const workerResponse = await Promise.race([collectPromise, timeoutPromise]);
    worker.terminate();
    
    if (workerResponse.type === 'error') {
      throw new Error(workerResponse.payload as string);
    }
    
    const workerData = workerResponse.payload as Record<string, unknown>;
    
    const navigatorComparison = compareValues('navigator', windowData.navigator, workerData.navigator);
    const screenComparison = compareValues('screen', windowData.screen, workerData.screen);
    const hardwareConcurrencyComparison = compareValues('hardwareConcurrency', windowData.navigator.hardwareConcurrency, workerData.navigator.hardwareConcurrency);
    const languageComparison = compareValues('language', windowData.navigator.language, workerData.navigator.language);
    const timezoneComparison = compareValues('timezone', windowData.timezone, workerData.timezone);
    
    const windowTimingStart = performance.now();
    for (let i = 0; i < 1000; i++) performance.now();
    const windowTiming = performance.now() - windowTimingStart;
    
    const worker2 = createWorker();
    const timingResponse = await sendWorkerMessage(worker2, { type: 'timing', payload: { iterations: 1000 } });
    worker2.terminate();
    
    const workerTiming = timingResponse.type === 'timing-result' 
      ? (timingResponse.payload as { totalTime: number }).totalTime 
      : 0;
    
    const timingResult = compareTiming(windowTiming, workerTiming);
    
    const workerAnomalies: WorkerAnomaly[] = [];
    
    const checks = [
      { name: 'navigator', window: windowData.navigator, worker: workerData.navigator, comparison: navigatorComparison },
      { name: 'screen', window: windowData.screen, worker: workerData.screen, comparison: screenComparison },
      { name: 'hardwareConcurrency', window: windowData.navigator.hardwareConcurrency, worker: workerData.navigator.hardwareConcurrency, comparison: hardwareConcurrencyComparison },
      { name: 'language', window: windowData.navigator.language, worker: workerData.navigator.language, comparison: languageComparison },
      { name: 'timezone', window: windowData.timezone, worker: workerData.timezone, comparison: timezoneComparison }
    ];
    
    for (const check of checks) {
      if (!check.comparison.match) {
        const anomaly: WorkerAnomaly = {
          type: 'execution_context_lie',
          property: check.name,
          windowValue: check.window,
          workerValue: check.worker,
          severity: check.name === 'navigator' || check.name === 'screen' ? 'critical' : 'high',
          description: `Execution context lie detected in ${check.name}: ${check.comparison.discrepancy}`
        };
        workerAnomalies.push(anomaly);
        
        anomalies.push({
          id: `worker-lie-${check.name}-${Date.now()}`,
          module: 'workerCrossCheck',
          severity: anomaly.severity,
          category: 'execution_context_lie',
          description: anomaly.description,
          expected: check.window,
          actual: check.worker,
          evidence: { discrepancy: check.comparison.discrepancy },
          confidence: 0.9,
          timestamp: Date.now()
        });
      }
    }
    
    if (timingResult.anomaly) {
      const anomaly: WorkerAnomaly = {
        type: 'execution_context_lie',
        property: 'timing',
        windowValue: windowTiming,
        workerValue: workerTiming,
        severity: 'medium',
        description: `Timing discrepancy between window and worker: ${timingResult.delta}ms`
      };
      workerAnomalies.push(anomaly);
      
      anomalies.push({
        id: `worker-timing-${Date.now()}`,
        module: 'workerCrossCheck',
        severity: 'medium',
        category: 'timing_anomaly',
        description: anomaly.description,
        expected: windowTiming,
        actual: workerTiming,
        evidence: { delta: timingResult.delta },
        confidence: 0.75,
        timestamp: Date.now()
      });
    }
    
    const result: WorkerCrossCheckResult = {
      navigator: {
        windowValue: windowData.navigator,
        workerValue: workerData.navigator,
        match: navigatorComparison.match,
        discrepancy: navigatorComparison.discrepancy
      },
      screen: {
        windowValue: windowData.screen,
        workerValue: workerData.screen,
        match: screenComparison.match,
        discrepancy: screenComparison.discrepancy
      },
      hardwareConcurrency: {
        windowValue: windowData.navigator.hardwareConcurrency,
        workerValue: workerData.navigator.hardwareConcurrency,
        match: hardwareConcurrencyComparison.match,
        discrepancy: hardwareConcurrencyComparison.discrepancy
      },
      language: {
        windowValue: windowData.navigator.language,
        workerValue: workerData.navigator.language,
        match: languageComparison.match,
        discrepancy: languageComparison.discrepancy
      },
      timezone: {
        windowValue: windowData.timezone,
        workerValue: workerData.timezone,
        match: timezoneComparison.match,
        discrepancy: timezoneComparison.discrepancy
      },
      timing: {
        windowTiming,
        workerTiming,
        delta: timingResult.delta,
        anomaly: timingResult.anomaly
      },
      anomalies: workerAnomalies
    };
    
    return {
      module: 'workerCrossCheck',
      timestamp: Date.now(),
      duration: performance.now() - startTime,
      success: true,
      data: result,
      anomalies
    };
  } catch (error) {
    return {
      module: 'workerCrossCheck',
      timestamp: Date.now(),
      duration: performance.now() - startTime,
      success: false,
      data: {} as WorkerCrossCheckResult,
      anomalies: [{
        id: `worker-error-${Date.now()}`,
        module: 'workerCrossCheck',
        severity: 'high',
        category: 'execution_context_lie',
        description: `Worker cross-check failed: ${error instanceof Error ? error.message : String(error)}`,
        expected: 'Successful cross-check',
        actual: 'Error',
        evidence: { error: String(error) },
        confidence: 0.8,
        timestamp: Date.now()
      }],
      error: String(error)
    };
  }
}

export const workerCrossCheckRunner: ModuleRunner<WorkerCrossCheckResult> = {
  name: 'workerCrossCheck',
  run: runWorkerCrossCheck,
  validate: (data) => {
    const anomalies: Anomaly[] = [];
    // Additional validation if needed
    return anomalies;
  }
};