import type {
  AuditResult,
  Anomaly,
  AuditSummary,
  ModuleProgress,
  TrustScore,
  SpecterConfig,
  ModuleRunner,
  SpecterAuditReport,
  PrototypeIntegrityResult,
  WorkerCrossCheckResult,
  CanvasWebGLResult,
  WebAudioResult,
  NetworkProbingResult
} from './types.js';
import { computeTrustScore, DEFAULT_CONFIG as DEFAULT_CONFIG_IMPORT } from './TrustScore.js';

export class SpecterEngine {
  private config: SpecterConfig;
  private results: Map<string, AuditResult<any>> = new Map();
  private progressCallbacks: Set<(progress: ModuleProgress) => void> = new Set();
  private running = false;
  private moduleRunners: Map<string, ModuleRunner<any>> = new Map();
  
  prototypeIntegrityRunner!: ModuleRunner<PrototypeIntegrityResult>;
  workerCrossCheckRunner!: ModuleRunner<WorkerCrossCheckResult>;
  canvasWebGLRunner!: ModuleRunner<CanvasWebGLResult>;
  webAudioRunner!: ModuleRunner<WebAudioResult>;
  networkProbingRunner!: ModuleRunner<NetworkProbingResult>;
  
  constructor(config: Partial<SpecterConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG_IMPORT, ...config };
    this.registerDefaultRunners();
  }
  
  private registerDefaultRunners(): void {
    const runners = [
      this.prototypeIntegrityRunner,
      this.workerCrossCheckRunner,
      this.canvasWebGLRunner,
      this.webAudioRunner,
      this.networkProbingRunner
    ].filter(Boolean);

    for (const runner of runners) {
      this.moduleRunners.set(runner.name, runner);
    }
  }
  
  registerRunner(name: string, runner: ModuleRunner<any>): void {
    this.moduleRunners.set(name, runner);
  }
  
  onProgress(callback: (progress: ModuleProgress) => void): () => void {
    this.progressCallbacks.add(callback);
    return () => this.progressCallbacks.delete(callback);
  }
  
  private emitProgress(progress: ModuleProgress): void {
    for (const callback of this.progressCallbacks) {
      try {
        callback(progress);
      } catch {
      }
    }
  }
  
  async runAudit(enabledModules?: string[]): Promise<SpecterAuditReport> {
    if (this.running) {
      throw new Error('Audit already in progress');
    }
    
    this.running = true;
    this.results.clear();
    
    const modulesToRun = enabledModules || Object.keys(this.config.modules).filter(
      key => this.config.modules[key as keyof SpecterConfig['modules']]
    );
    
    const startTime = Date.now();
    let completed = 0;
    
    for (const moduleName of modulesToRun) {
      const runner = this.moduleRunners.get(moduleName);
      if (!runner) {
        console.warn(`[SpecterJS] No runner found for module: ${moduleName}`);
        continue;
      }
      
      this.emitProgress({
        module: moduleName,
        status: 'running',
        progress: completed / modulesToRun.length,
        timestamp: Date.now()
      });
      
      try {
        const result = await runner.run(this.config);
        this.results.set(moduleName, result);
        
        this.emitProgress({
          module: moduleName,
          status: result.success ? 'completed' : 'failed',
          progress: (completed + 1) / modulesToRun.length,
          timestamp: Date.now(),
          result
        });
      } catch (error) {
        const errorResult: AuditResult<any> = {
          module: moduleName,
          timestamp: Date.now(),
          duration: 0,
          success: false,
          data: {},
          anomalies: [{
            id: `${moduleName}-runner-error-${Date.now()}`,
            module: moduleName,
            severity: 'critical',
            category: 'prototype_tampering',
            description: `Runner threw error: ${error instanceof Error ? error.message : String(error)}`,
            expected: 'Successful execution',
            actual: 'Error thrown',
            evidence: { error: String(error) },
            confidence: 0.9,
            timestamp: Date.now()
          }],
          error: String(error)
        };
        
        this.results.set(moduleName, errorResult);
        
        this.emitProgress({
          module: moduleName,
          status: 'failed',
          progress: (completed + 1) / modulesToRun.length,
          timestamp: Date.now(),
          result: errorResult
        });
      }
      
      completed++;
    }
    
    this.running = false;
    
    const trustScore = computeTrustScore(this.config, this.results);
    const totalDuration = Date.now() - startTime;
    
    const report: SpecterAuditReport = {
      timestamp: Date.now(),
      duration: totalDuration,
      config: this.config,
      results: Object.fromEntries(this.results),
      trustScore,
      summary: this.generateSummary()
    };
    
    this.emitProgress({
      module: 'complete',
      status: 'completed',
      progress: 1,
      timestamp: Date.now()
    });
    
    return report;
  }
  
  private generateSummary(): AuditSummary {
    const results = Array.from(this.results.values());
    const anomalies = results.flatMap(r => r.anomalies || []);
    
    return {
      modulesRun: results.length,
      modulesSuccessful: results.filter(r => r.success).length,
      modulesFailed: results.filter(r => !r.success).length,
      totalAnomalies: anomalies.length,
      criticalAnomalies: anomalies.filter(a => a.severity === 'critical').length,
      highAnomalies: anomalies.filter(a => a.severity === 'high').length,
      trustScore: 0
    };
  }
  
  getResults(): Map<string, AuditResult<any>> {
    return new Map(this.results);
  }
  
  getConfig(): SpecterConfig {
    return { ...this.config };
  }
  
  updateConfig(config: Partial<SpecterConfig>): void {
    this.config = {
      ...this.config,
      ...config,
      modules: {
        ...this.config.modules,
        ...config.modules
      },
      thresholds: {
        ...this.config.thresholds,
        ...config.thresholds
      }
    };
  }
  
  isRunning(): boolean {
    return this.running;
  }
}

export function createEngine(config: Partial<SpecterConfig> = {}): SpecterEngine {
  return new SpecterEngine(config);
}

export { DEFAULT_CONFIG_IMPORT as DEFAULT_CONFIG };
export type { SpecterConfig, ModuleRunner, ModuleProgress, SpecterAuditReport, AuditSummary };
