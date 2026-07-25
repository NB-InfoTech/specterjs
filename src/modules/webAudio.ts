import type {
  AuditResult,
  Anomaly,
  WebAudioResult,
  WebAudioAnomaly,
  SpecterConfig,
  ModuleRunner
} from '../core/types.js';

const SAMPLE_RATE = 44100;
const DURATION = 0.1;
const OSCILLATOR_FREQ = 440;
const OSCILLATOR_TYPE = 'sine' as OscillatorType;
const COMPRESSOR_THRESHOLD = -50;
const COMPRESSOR_KNEE = 40;
const COMPRESSOR_RATIO = 12;
const COMPRESSOR_ATTACK = 0;
const COMPRESSOR_RELEASE = 0.25;

function hashBuffer(buffer: ArrayBuffer | Uint8Array): string {
  const data = buffer instanceof Uint8Array ? buffer : new Uint8Array(buffer);
  let hash = 0;
  for (let i = 0; i < data.length; i++) {
    hash = ((hash << 5) - hash) + data[i];
    hash |= 0;
  }
  return Math.abs(hash).toString(16).padStart(8, '0');
}

function hashString(str: string): string {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) - hash) + str.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash).toString(16).padStart(8, '0');
}

function hashFloat32Array(arr: Float32Array): string {
  let hash = 0;
  for (let i = 0; i < arr.length; i++) {
    const val = Math.round(arr[i] * 1000000);
    hash = ((hash << 5) - hash) + val;
    hash |= 0;
  }
  return Math.abs(hash).toString(16).padStart(8, '0');
}

function generateOscillatorFingerprint(context: OfflineAudioContext): string {
  const oscillator = context.createOscillator();
  oscillator.type = OSCILLATOR_TYPE;
  oscillator.frequency.value = OSCILLATOR_FREQ;
  
  const gain = context.createGain();
  gain.gain.value = 0.5;
  
  oscillator.connect(gain);
  gain.connect(context.destination);
  
  oscillator.start(0);
  oscillator.stop(DURATION);
  
  return 'oscillator-configured';
}

function generateCompressorFingerprint(context: OfflineAudioContext): string {
  const compressor = context.createDynamicsCompressor();
  compressor.threshold.value = COMPRESSOR_THRESHOLD;
  compressor.knee.value = COMPRESSOR_KNEE;
  compressor.ratio.value = COMPRESSOR_RATIO;
  compressor.attack.value = COMPRESSOR_ATTACK;
  compressor.release.value = COMPRESSOR_RELEASE;
  
  const oscillator = context.createOscillator();
  oscillator.type = 'square';
  oscillator.frequency.value = 220;
  
  const gain = context.createGain();
  gain.gain.value = 1.0;
  
  oscillator.connect(compressor);
  compressor.connect(gain);
  gain.connect(context.destination);
  
  oscillator.start(0);
  oscillator.stop(DURATION);
  
  return 'compressor-configured';
}

function generateComplexSignalFingerprint(context: OfflineAudioContext): string {
  const oscillator1 = context.createOscillator();
  oscillator1.type = 'sine';
  oscillator1.frequency.value = 440;
  
  const oscillator2 = context.createOscillator();
  oscillator2.type = 'triangle';
  oscillator2.frequency.value = 880;
  
  const oscillator3 = context.createOscillator();
  oscillator3.type = 'sawtooth';
  oscillator3.frequency.value = 220;
  
  const gain1 = context.createGain();
  gain1.gain.value = 0.3;
  
  const gain2 = context.createGain();
  gain2.gain.value = 0.2;
  
  const gain3 = context.createGain();
  gain3.gain.value = 0.1;
  
  const merger = context.createChannelMerger(3);
  
  oscillator1.connect(gain1).connect(merger, 0, 0);
  oscillator2.connect(gain2).connect(merger, 0, 1);
  oscillator3.connect(gain3).connect(merger, 0, 2);
  
  merger.connect(context.destination);
  
  oscillator1.start(0);
  oscillator2.start(0);
  oscillator3.start(0);
  
  oscillator1.stop(DURATION);
  oscillator2.stop(DURATION);
  oscillator3.stop(DURATION);
  
  return 'complex-signal-configured';
}

async function runAudioContextTest(
  contextFactory: () => OfflineAudioContext,
  setupFn: (ctx: OfflineAudioContext) => void,
  label: string
): Promise<{ fingerprint: string; latency: number; sampleRate: number; channelCount: number; anomalies: WebAudioAnomaly[] }> {
  const anomalies: WebAudioAnomaly[] = [];
  const startTime = performance.now();
  
  try {
    const context = contextFactory();
    const expectedSampleRate = SAMPLE_RATE;
    const expectedChannelCount = 1;
    
    if (context.sampleRate !== expectedSampleRate) {
      anomalies.push({
        type: 'sample_rate_anomaly',
        expected: expectedSampleRate,
        actual: context.sampleRate,
        severity: 'medium'
      });
    }
    
    if (context.destination.channelCount !== expectedChannelCount) {
      anomalies.push({
        type: 'audio_context_tampering',
        expected: expectedChannelCount,
        actual: context.destination.channelCount,
        severity: 'low'
      });
    }
    
    setupFn(context);
    
    const buffer = await context.startRendering();
    
    const latency = performance.now() - startTime;
    
    const channelData = buffer.getChannelData(0);
    const fingerprint = hashFloat32Array(channelData);
    
    if (latency > 5000) {
      anomalies.push({
        type: 'latency_anomaly',
        expected: '< 5000ms',
        actual: `${latency.toFixed(2)}ms`,
        severity: 'medium'
      });
    }
    
    const rms = Math.sqrt(channelData.reduce((sum, val) => sum + val * val, 0) / channelData.length);
    if (rms === 0) {
      anomalies.push({
        type: 'oscillator_anomaly',
        expected: 'non-zero signal',
        actual: 'silent output',
        severity: 'high'
      });
    }
    
    return {
      fingerprint,
      latency,
      sampleRate: context.sampleRate,
      channelCount: context.destination.channelCount,
      anomalies
    };
  } catch (error) {
    anomalies.push({
      type: 'audio_context_tampering',
      expected: 'successful render',
      actual: `error: ${error instanceof Error ? error.message : String(error)}`,
      severity: 'critical'
    });
    
    return {
      fingerprint: 'error',
      latency: performance.now() - startTime,
      sampleRate: 0,
      channelCount: 0,
      anomalies
    };
  }
}

function calculateAudioEntropy(buffer: AudioBuffer): number {
  let entropy = 0;
  for (let ch = 0; ch < buffer.numberOfChannels; ch++) {
    const data = buffer.getChannelData(ch);
    const histogram = new Map<number, number>();
    
    for (let i = 0; i < data.length; i++) {
      const quantized = Math.round(data[i] * 1000) / 1000;
      histogram.set(quantized, (histogram.get(quantized) || 0) + 1);
    }
    
    for (const count of histogram.values()) {
      const p = count / data.length;
      if (p > 0) entropy -= p * Math.log2(p);
    }
  }
  return entropy / buffer.numberOfChannels;
}

export async function runWebAudio(config: SpecterConfig): Promise<AuditResult<WebAudioResult>> {
  const startTime = performance.now();
  const anomalies: Anomaly[] = [];
  
  try {
    const contextFactory = () => new OfflineAudioContext(1, SAMPLE_RATE * DURATION, SAMPLE_RATE);
    
    const [oscillatorResult, compressorResult, complexResult] = await Promise.all([
      runAudioContextTest(contextFactory, generateOscillatorFingerprint, 'oscillator'),
      runAudioContextTest(contextFactory, generateCompressorFingerprint, 'compressor'),
      runAudioContextTest(contextFactory, generateComplexSignalFingerprint, 'complex')
    ]);
    
    const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
    const latency = audioContext.baseLatency || 0;
    audioContext.close();
    
    const result: WebAudioResult = {
      fingerprint: hashString(`${oscillatorResult.fingerprint}|${compressorResult.fingerprint}|${complexResult.fingerprint}`),
      oscillatorFingerprint: oscillatorResult.fingerprint,
      compressorFingerprint: compressorResult.fingerprint,
      latency,
      sampleRate: oscillatorResult.sampleRate,
      channelCount: oscillatorResult.channelCount,
      anomalies: [
        ...oscillatorResult.anomalies,
        ...compressorResult.anomalies,
        ...complexResult.anomalies
      ]
    };
    
    for (const anomaly of result.anomalies) {
      anomalies.push({
        id: `webaudio-${anomaly.type}-${Date.now()}`,
        module: 'webAudio',
        severity: anomaly.severity,
        category: anomaly.type.includes('tampering') ? 'hardware_spoofing' : 'entropy_anomaly',
        description: `Web Audio anomaly: ${anomaly.type}`,
        expected: anomaly.expected,
        actual: anomaly.actual,
        evidence: { ...anomaly },
        confidence: anomaly.severity === 'critical' ? 0.95 : anomaly.severity === 'high' ? 0.85 : 0.7,
        timestamp: Date.now()
      });
    }
    
    const duration = performance.now() - startTime;
    
    return {
      module: 'webAudio',
      timestamp: Date.now(),
      duration,
      success: true,
      data: result,
      anomalies
    };
  } catch (error) {
    return {
      module: 'webAudio',
      timestamp: Date.now(),
      duration: performance.now() - startTime,
      success: false,
      data: {} as WebAudioResult,
      anomalies: [{
        id: `webaudio-error-${Date.now()}`,
        module: 'webAudio',
        severity: 'critical',
        category: 'entropy_anomaly',
        description: `Module execution failed: ${error instanceof Error ? error.message : String(error)}`,
        expected: 'Successful execution',
        actual: 'Error',
        evidence: { error: String(error) },
        confidence: 0.9,
        timestamp: Date.now()
      }],
      error: String(error)
    };
  }
}

export const webAudioRunner: ModuleRunner<WebAudioResult> = {
  name: 'webAudio',
  run: runWebAudio,
  validate: (data) => {
    const anomalies: Anomaly[] = [];
    
    if (!data.fingerprint || data.fingerprint === 'error') {
      anomalies.push({
        id: `webaudio-validate-${Date.now()}`,
        module: 'webAudio',
        severity: 'high',
        category: 'entropy_anomaly',
        description: 'Audio fingerprint generation failed',
        expected: 'Valid fingerprint',
        actual: data.fingerprint,
        evidence: {},
        confidence: 0.8,
        timestamp: Date.now()
      });
    }
    
    if (data.latency > 10000) {
      anomalies.push({
        id: `webaudio-latency-${Date.now()}`,
        module: 'webAudio',
        severity: 'medium',
        category: 'timing_anomaly',
        description: 'Excessive audio rendering latency',
        expected: '< 10000ms',
        actual: `${data.latency.toFixed(2)}ms`,
        evidence: { latency: data.latency },
        confidence: 0.7,
        timestamp: Date.now()
      });
    }
    
    return anomalies;
  }
};
