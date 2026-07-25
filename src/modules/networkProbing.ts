import type {
  AuditResult,
  Anomaly,
  NetworkProbingResult,
  WebRTCResult,
  WebRTCAnomaly,
  TimingResult,
  TimingAnomaly,
  SpecterConfig,
  ModuleRunner
} from '../core/types.js';

const ICE_SERVERS = [
  { urls: 'stun:stun.l.google.com:19302' },
  { urls: 'stun:stun1.l.google.com:19302' },
  { urls: 'stun:stun2.l.google.com:19302' },
  { urls: 'stun:stun3.l.google.com:19302' },
  { urls: 'stun:stun4.l.google.com:19302' }
];

async function gatherICECandidates(pc: RTCPeerConnection, timeout: number): Promise<RTCIceCandidate[]> {
  return new Promise((resolve) => {
    const candidates: RTCIceCandidate[] = [];
    let resolved = false;
    
    const handleCandidate = (event: RTCPeerConnectionIceEvent) => {
      if (event.candidate) {
        candidates.push(event.candidate);
      }
    };
    
    pc.addEventListener('icecandidate', handleCandidate);
    
    const timeoutId = setTimeout(() => {
      if (!resolved) {
        resolved = true;
        pc.removeEventListener('icecandidate', handleCandidate);
        resolve(candidates);
      }
    }, timeout);
    
    pc.addEventListener('icegatheringstatechange', () => {
      if (pc.iceGatheringState === 'complete' && !resolved) {
        resolved = true;
        clearTimeout(timeoutId);
        pc.removeEventListener('icecandidate', handleCandidate);
        resolve(candidates);
      }
    });
  });
}

function analyzeCandidates(candidates: RTCIceCandidate[]): {
  candidateTypes: Record<string, number>;
  localIPs: string[];
  publicIPs: string[];
  anomalies: WebRTCAnomaly[];
} {
  const candidateTypes: Record<string, number> = {};
  const localIPs: Set<string> = new Set();
  const publicIPs: Set<string> = new Set();
  const anomalies: WebRTCAnomaly[] = [];
  
  for (const candidate of candidates) {
    const type = candidate.type ?? 'unknown';
    candidateTypes[type] = (candidateTypes[type] || 0) + 1;
    
    const ipMatch = candidate.candidate.match(/(\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3})/);
    if (ipMatch) {
      const ip = ipMatch[1];
      if (ip.startsWith('192.168.') || ip.startsWith('10.') || ip.startsWith('172.')) {
        localIPs.add(ip);
      } else {
        publicIPs.add(ip);
      }
    }
    
    if (type === 'host' && candidate.candidate.includes('typ host')) {
      anomalies.push({
        type: 'ice_candidate_anomaly',
        description: 'Host candidate exposes local IP',
        severity: 'medium',
        evidence: { candidate: candidate.candidate, candidateType: 'host' }
      });
    }
  }
  
  if (publicIPs.size > 0) {
    anomalies.push({
      type: 'ip_leak',
      description: `Public IP(s) exposed via WebRTC: ${Array.from(publicIPs).join(', ')}`,
      severity: 'high',
      evidence: { publicIPs: Array.from(publicIPs) }
    });
  }
  
  if (candidates.length === 0) {
    anomalies.push({
      type: 'ice_candidate_anomaly',
      description: 'No ICE candidates gathered',
      severity: 'high',
      evidence: { candidateCount: 0 }
    });
  }
  
  return {
    candidateTypes,
    localIPs: Array.from(localIPs),
    publicIPs: Array.from(publicIPs),
    anomalies
  };
}

function measureTimingPrecision(iterations: number = 1000): TimingResult {
  const times: number[] = [];
  
  for (let i = 0; i < iterations; i++) {
    const start = performance.now();
    performance.now();
    const end = performance.now();
    times.push(end - start);
  }
  
  times.sort((a, b) => a - b);
  
  const precision = times[0];
  const median = times[Math.floor(times.length / 2)];
  const p95 = times[Math.floor(times.length * 0.95)];
  const p99 = times[Math.floor(times.length * 0.99)];
  const max = times[times.length - 1];
  const avg = times.reduce((a, b) => a + b, 0) / times.length;
  
  const variance = times.reduce((sum, t) => sum + Math.pow(t - avg, 2), 0) / times.length;
  const stdDev = Math.sqrt(variance);
  
  const timingConsistency = 1 - Math.min(stdDev / avg, 1);
  
  const anomalies: TimingAnomaly[] = [];
  
  if (precision > 1) {
    anomalies.push({
      type: 'reduced_precision',
      description: `Timer precision reduced to ${precision.toFixed(2)}ms (expected < 1ms)`,
      severity: 'medium',
      evidence: { precision, expected: '< 1ms' }
    });
  }
  
  if (timingConsistency < 0.5) {
    anomalies.push({
      type: 'timing_inconsistency',
      description: `High timing variance detected (consistency: ${(timingConsistency * 100).toFixed(1)}%)`,
      severity: 'high',
      evidence: { timingConsistency, stdDev, avg }
    });
  }
  
  if (performance.timeOrigin === undefined) {
    anomalies.push({
      type: 'timing_attack_mitigation',
      description: 'performance.timeOrigin not available (possible timing attack mitigation)',
      severity: 'low',
      evidence: { timeOrigin: performance.timeOrigin }
    });
  }
  
  const navigationEntries = performance.getEntriesByType('navigation') as PerformanceNavigationTiming[];
  if (navigationEntries.length > 0) {
    const nav = navigationEntries[0];
    if (nav.transferSize === 0 && nav.encodedBodySize > 0) {
      anomalies.push({
        type: 'timing_attack_mitigation',
        description: 'Navigation timing obscured (transferSize=0 but content exists)',
        severity: 'low',
        evidence: { transferSize: nav.transferSize, encodedBodySize: nav.encodedBodySize }
      });
    }
  }
  
  return {
    highResolutionTiming: times.slice(0, 10),
    timingPrecision: precision,
    timingConsistency,
    anomalies
  };
}

function measureWorkerTiming(): Promise<number> {
  return new Promise((resolve) => {
    const workerCode = `
      self.onmessage = function(e) {
        const iterations = e.data.iterations || 1000;
        const start = performance.now();
        for (let i = 0; i < iterations; i++) {
          performance.now();
        }
        const end = performance.now();
        self.postMessage({ totalTime: end - start, iterations });
      };
    `;
    
    const blob = new Blob([workerCode], { type: 'application/javascript' });
    const url = URL.createObjectURL(blob);
    const worker = new Worker(url);
    
    worker.onmessage = (e) => {
      URL.revokeObjectURL(url);
      worker.terminate();
      resolve(e.data.totalTime);
    };
    
    worker.postMessage({ iterations: 1000 });
    
    setTimeout(() => {
      URL.revokeObjectURL(url);
      worker.terminate();
      resolve(-1);
    }, 5000);
  });
}

export async function runNetworkProbing(config: SpecterConfig): Promise<AuditResult<NetworkProbingResult>> {
  const startTime = performance.now();
  const anomalies: Anomaly[] = [];
  
  try {
    const pc = new RTCPeerConnection({ iceServers: ICE_SERVERS });
    pc.createDataChannel('test');
    
    const offer = await pc.createOffer();
    await pc.setLocalDescription(offer);
    
    const candidateStartTime = performance.now();
    const candidates = await gatherICECandidates(pc, config.webRTCTimeout);
    const candidateGenerationTime = performance.now() - candidateStartTime;
    
    pc.close();
    
    const candidateAnalysis = analyzeCandidates(candidates);
    
    const webrtcResult: WebRTCResult = {
      candidates,
      candidateGenerationTime,
      candidateTypes: candidateAnalysis.candidateTypes,
      localIPs: candidateAnalysis.localIPs,
      publicIPs: candidateAnalysis.publicIPs,
      anomalies: candidateAnalysis.anomalies
    };
    
    for (const anomaly of candidateAnalysis.anomalies) {
      anomalies.push({
        id: `webrtc-${anomaly.type}-${Date.now()}`,
        module: 'networkProbing',
        severity: anomaly.severity,
        category: anomaly.type === 'ip_leak' ? 'network_anomaly' : 'timing_anomaly',
        description: anomaly.description,
        expected: anomaly.evidence?.expected,
        actual: anomaly.evidence?.actual || anomaly.description,
        evidence: anomaly.evidence,
        confidence: anomaly.severity === 'high' ? 0.9 : 0.75,
        timestamp: Date.now()
      });
    }
    
    const timingResult = measureTimingPrecision();
    
    const windowTiming = timingResult.timingPrecision;
    const workerTiming = await measureWorkerTiming();
    
    const timingDelta = workerTiming > 0 ? Math.abs(windowTiming - workerTiming / 1000) : 0;
    
    if (timingDelta > 50) {
      anomalies.push({
        id: `timing-worker-delta-${Date.now()}`,
        module: 'networkProbing',
        severity: 'medium',
        category: 'timing_anomaly',
        description: `Timing discrepancy between window and worker: ${timingDelta.toFixed(2)}ms`,
        expected: '< 50ms delta',
        actual: `${timingDelta.toFixed(2)}ms delta`,
        evidence: { windowTiming, workerTiming: workerTiming / 1000 },
        confidence: 0.7,
        timestamp: Date.now()
      });
    }
    
    for (const anomaly of timingResult.anomalies) {
      anomalies.push({
        id: `timing-${anomaly.type}-${Date.now()}`,
        module: 'networkProbing',
        severity: anomaly.severity,
        category: 'timing_anomaly',
        description: anomaly.description,
        expected: anomaly.evidence?.expected,
        actual: anomaly.evidence?.actual || anomaly.description,
        evidence: anomaly.evidence,
        confidence: anomaly.severity === 'high' ? 0.85 : 0.7,
        timestamp: Date.now()
      });
    }
    
    const networkResult: NetworkProbingResult = {
      webrtc: webrtcResult,
      timing: timingResult,
      anomalies: []
    };
    
    const duration = performance.now() - startTime;
    
    return {
      module: 'networkProbing',
      timestamp: Date.now(),
      duration,
      success: true,
      data: networkResult,
      anomalies
    };
  } catch (error) {
    return {
      module: 'networkProbing',
      timestamp: Date.now(),
      duration: performance.now() - startTime,
      success: false,
      data: {} as NetworkProbingResult,
      anomalies: [{
        id: `network-error-${Date.now()}`,
        module: 'networkProbing',
        severity: 'high',
        category: 'network_anomaly',
        description: `Module execution failed: ${error instanceof Error ? error.message : String(error)}`,
        expected: 'Successful execution',
        actual: 'Error',
        evidence: { error: String(error) },
        confidence: 0.85,
        timestamp: Date.now()
      }],
      error: String(error)
    };
  }
}

export const networkProbingRunner: ModuleRunner<NetworkProbingResult> = {
  name: 'networkProbing',
  run: runNetworkProbing,
  validate: (data) => {
    const anomalies: Anomaly[] = [];
    
    if (!data.webrtc || data.webrtc.candidates.length === 0) {
      anomalies.push({
        id: `network-validate-${Date.now()}`,
        module: 'networkProbing',
        severity: 'high',
        category: 'network_anomaly',
        description: 'No ICE candidates gathered',
        expected: 'At least one candidate',
        actual: 'Zero candidates',
        evidence: { candidateCount: data.webrtc?.candidates?.length || 0 },
        confidence: 0.85,
        timestamp: Date.now()
      });
    }
    
    if (data.timing.timingPrecision > 2) {
      anomalies.push({
        id: `network-timing-precision-${Date.now()}`,
        module: 'networkProbing',
        severity: 'medium',
        category: 'timing_anomaly',
        description: 'Poor timer precision',
        expected: '< 1ms',
        actual: `${data.timing.timingPrecision.toFixed(2)}ms`,
        evidence: { precision: data.timing.timingPrecision },
        confidence: 0.8,
        timestamp: Date.now()
      });
    }
    
    return anomalies;
  }
};
