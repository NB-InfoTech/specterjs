import type { SpecterConfig, AuditResult, TrustScore, Anomaly } from './types.js';

interface ModuleScoreConfig {
  weight: number;
  criticalPenalty: number;
  highPenalty: number;
  mediumPenalty: number;
  lowPenalty: number;
  infoPenalty: number;
}

const MODULE_SCORES: Record<string, ModuleScoreConfig> = {
  prototypeIntegrity: { weight: 0.25, criticalPenalty: 0.35, highPenalty: 0.2, mediumPenalty: 0.1, lowPenalty: 0.05, infoPenalty: 0.01 },
  workerCrossCheck: { weight: 0.2, criticalPenalty: 0.4, highPenalty: 0.25, mediumPenalty: 0.15, lowPenalty: 0.05, infoPenalty: 0.01 },
  canvasWebGL: { weight: 0.25, criticalPenalty: 0.3, highPenalty: 0.15, mediumPenalty: 0.08, lowPenalty: 0.03, infoPenalty: 0.01 },
  webAudio: { weight: 0.15, criticalPenalty: 0.3, highPenalty: 0.15, mediumPenalty: 0.08, lowPenalty: 0.03, infoPenalty: 0.01 },
  networkProbing: { weight: 0.15, criticalPenalty: 0.25, highPenalty: 0.15, mediumPenalty: 0.1, lowPenalty: 0.05, infoPenalty: 0.01 }
};

const SEVERITY_PENALTIES = {
  critical: 1.0,
  high: 0.6,
  medium: 0.3,
  low: 0.1,
  info: 0.02
};

export function computeTrustScore(
  config: SpecterConfig,
  results: Map<string, AuditResult<any>>
): TrustScore {
  const breakdown = {
    prototypeIntegrity: 1.0,
    executionContext: 1.0,
    hardwareEntropy: 1.0,
    networkIntegrity: 1.0,
    timingIntegrity: 1.0
  };
  
  const allAnomalies: Anomaly[] = [];
  
  for (const [moduleName, result] of results.entries()) {
    if (!result.success) {
      allAnomalies.push(...result.anomalies);
      continue;
    }
    
    const anomalies = result.anomalies || [];
    allAnomalies.push(...anomalies);
    
    const moduleConfig = MODULE_SCORES[moduleName];
    if (!moduleConfig) continue;
    
    let penalty = 0;
    for (const anomaly of anomalies) {
      const severityMultiplier = SEVERITY_PENALTIES[anomaly.severity] || 0.1;
      
      switch (anomaly.severity) {
        case 'critical': penalty += moduleConfig.criticalPenalty * severityMultiplier; break;
        case 'high': penalty += moduleConfig.highPenalty * severityMultiplier; break;
        case 'medium': penalty += moduleConfig.mediumPenalty * severityMultiplier; break;
        case 'low': penalty += moduleConfig.lowPenalty * severityMultiplier; break;
        case 'info': penalty += moduleConfig.infoPenalty * severityMultiplier; break;
      }
    }
    
    const score = Math.max(0, 1 - penalty);
    
    switch (moduleName) {
      case 'prototypeIntegrity': breakdown.prototypeIntegrity = score; break;
      case 'workerCrossCheck': breakdown.executionContext = score; break;
      case 'canvasWebGL': breakdown.hardwareEntropy = score; break;
      case 'webAudio': breakdown.hardwareEntropy = Math.min(breakdown.hardwareEntropy, score); break;
      case 'networkProbing': 
        breakdown.networkIntegrity = score;
        breakdown.timingIntegrity = score;
        break;
    }
  }
  
  const overall = Math.round((
    breakdown.prototypeIntegrity * MODULE_SCORES.prototypeIntegrity.weight +
    breakdown.executionContext * MODULE_SCORES.workerCrossCheck.weight +
    breakdown.hardwareEntropy * MODULE_SCORES.canvasWebGL.weight +
    breakdown.networkIntegrity * MODULE_SCORES.networkProbing.weight +
    breakdown.timingIntegrity * MODULE_SCORES.networkProbing.weight
  ) * 100);
  
  let verdict: TrustScore['verdict'] = 'unknown';
  if (overall >= 90) verdict = 'trusted';
  else if (overall >= 70) verdict = 'suspicious';
  else if (overall >= 40) verdict = 'compromised';
  else verdict = 'compromised';
  
  return {
    overall,
    breakdown,
    verdict,
    anomalies: allAnomalies,
    timestamp: Date.now()
  };
}

export function getTrustScoreVerdict(score: number): TrustScore['verdict'] {
  if (score >= 90) return 'trusted';
  if (score >= 70) return 'suspicious';
  if (score >= 40) return 'compromised';
  return 'compromised';
}

export function getVerdictColor(verdict: TrustScore['verdict']): string {
  switch (verdict) {
    case 'trusted': return '#00ff88';
    case 'suspicious': return '#ffaa00';
    case 'compromised': return '#ff3344';
    default: return '#888888';
  }
}

export function getSeverityColor(severity: Anomaly['severity']): string {
  switch (severity) {
    case 'critical': return '#ff3344';
    case 'high': return '#ff6600';
    case 'medium': return '#ffaa00';
    case 'low': return '#00aaee';
    case 'info': return '#888888';
    default: return '#888888';
  }
}

export { DEFAULT_CONFIG } from './types.js';