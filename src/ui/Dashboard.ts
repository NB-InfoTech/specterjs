import type { TrustScore, AuditResult, SpecterConfig, SpecterAuditReport, AuditSummary } from '../core/types.js';
import { AnomalyVisualizer } from './AnomalyVisualizer.js';

export class Dashboard {
  private container: HTMLElement;
  private engine: any;
  private anomalyVisualizer: AnomalyVisualizer;
  private isRunning = false;
  private currentReport: SpecterAuditReport | null = null;
  private selectedModule: string | null = null;
  
  constructor(container: HTMLElement, engine: any) {
    this.container = container;
    this.engine = engine;
    
    this.render();
    this.anomalyVisualizer = new AnomalyVisualizer(
      this.container.querySelector('.anomaly-visualizer-container') as HTMLElement
    );
    
    this.attachEventListeners();
    this.startAutoRefresh();
  }
  
  private render(): void {
    this.container.innerHTML = `
      <div class="specter-dashboard">
        <header class="dashboard-header">
          <div class="header-left">
            <h1 class="dashboard-title">👻 SpecterJS</h1>
            <span class="dashboard-subtitle">Browser Environment Audit & Fingerprinting Framework</span>
          </div>
          <div class="header-right">
            <div class="trust-score-display" id="trust-score-display">
              <div class="score-circle" id="score-circle">
                <span class="score-value" id="score-value">--</span>
                <span class="score-label">Trust</span>
              </div>
              <div class="score-verdict" id="score-verdict">--</div>
            </div>
            <button class="btn btn-primary" id="run-audit-btn">Run Audit</button>
          </div>
        </header>
        
        <div class="dashboard-progress" id="dashboard-progress" style="display: none;">
          <div class="progress-bar-container">
            <div class="progress-bar" id="progress-bar"></div>
          </div>
          <div class="progress-status" id="progress-status">Initializing...</div>
          <div class="module-progress" id="module-progress"></div>
        </div>
        
        <div class="dashboard-content">
          <div class="dashboard-sidebar">
            <div class="module-cards" id="module-cards"></div>
            
            <div class="config-panel">
              <h3>Configuration</h3>
              <div class="config-toggles" id="config-toggles"></div>
            </div>
          </div>
          
          <div class="dashboard-main">
            <div class="metrics-grid" id="metrics-grid"></div>
            
            <div class="anomaly-visualizer-container" id="anomaly-visualizer-container"></div>
          </div>
        </div>
        
        <footer class="dashboard-footer">
          <div class="footer-left">
            <span class="version">SpecterJS v1.0.0</span>
            <span class="timestamp" id="report-timestamp">No audit run</span>
          </div>
          <div class="footer-right">
            <button class="btn btn-secondary" id="export-report-btn">Export Report</button>
            <button class="btn btn-secondary" id="clear-report-btn">Clear</button>
          </div>
        </footer>
      </div>
    `;
  }
  
  private attachEventListeners(): void {
    const runBtn = this.container.querySelector('#run-audit-btn') as HTMLButtonElement;
    runBtn?.addEventListener('click', () => this.runAudit());
    
    const exportBtn = this.container.querySelector('#export-report-btn') as HTMLButtonElement;
    exportBtn?.addEventListener('click', () => this.exportReport());
    
    const clearBtn = this.container.querySelector('#clear-report-btn') as HTMLButtonElement;
    clearBtn?.addEventListener('click', () => this.clearReport());
  }
  
  async runAudit(): Promise<void> {
    if (this.isRunning) return;
    
    this.startTime = Date.now();
    this.isRunning = true;
    this.showProgress(true);
    this.updateRunButton(true);
    
    const moduleProgressEl = this.container.querySelector('#module-progress') as HTMLElement;
    const progressBar = this.container.querySelector('#progress-bar') as HTMLElement;
    const progressStatus = this.container.querySelector('#progress-status') as HTMLElement;
    
    try {
      const config = this.engine.getConfig();
      const modules = Object.entries(config.modules)
        .filter(([, enabled]) => enabled)
        .map(([name]) => name);
      
      let completed = 0;
      const results: Record<string, AuditResult<any>> = {};
      const allAnomalies: any[] = [];
      
      for (const moduleName of modules) {
        this.updateModuleProgress(moduleProgressEl, moduleName, 'running', completed / modules.length);
        progressStatus.textContent = `Running ${moduleName}...`;
        progressBar.style.width = `${(completed / modules.length) * 100}%`;
        
        const runner = this.getModuleRunner(moduleName);
        if (runner) {
          const result = await runner.run(config);
          results[moduleName] = result;
          allAnomalies.push(...result.anomalies);
        }
        
        completed++;
        this.updateModuleProgress(moduleProgressEl, moduleName, 'completed', completed / modules.length);
      }
      
      progressBar.style.width = '100%';
      progressStatus.textContent = 'Calculating trust score...';
      
      const trustScore = this.calculateTrustScore(results, allAnomalies);
      
      const report: SpecterAuditReport = {
        timestamp: Date.now(),
        duration: Date.now() - this.startTime,
        config,
        results,
        trustScore,
        summary: this.generateSummary(results, allAnomalies, trustScore.overall)
      };
      
      this.currentReport = report;
      this.renderReport(report);
      
    } catch (error) {
      console.error('Audit failed:', error);
      progressStatus.textContent = `Error: ${error instanceof Error ? error.message : String(error)}`;
      progressStatus.classList.add('error');
    } finally {
      this.isRunning = false;
      this.showProgress(false);
      this.updateRunButton(false);
    }
  }
  
  private startTime = Date.now();
  
  private getModuleRunner(moduleName: string): any {
    const runners: Record<string, any> = {
      prototypeIntegrity: this.engine.prototypeIntegrityRunner,
      workerCrossCheck: this.engine.workerCrossCheckRunner,
      canvasWebGL: this.engine.canvasWebGLRunner,
      webAudio: this.engine.webAudioRunner,
      networkProbing: this.engine.networkProbingRunner
    };
    return runners[moduleName];
  }
  
  private showProgress(show: boolean): void {
    const progressEl = this.container.querySelector('#dashboard-progress') as HTMLElement;
    if (progressEl) {
      progressEl.style.display = show ? 'block' : 'none';
    }
  }
  
  private updateRunButton(running: boolean): void {
    const btn = this.container.querySelector('#run-audit-btn') as HTMLButtonElement;
    if (btn) {
      btn.disabled = running;
      btn.textContent = running ? 'Running...' : 'Run Audit';
    }
  }
  
  private updateModuleProgress(container: HTMLElement, moduleName: string, status: 'pending' | 'running' | 'completed' | 'failed', progress: number): void {
    let el = container.querySelector(`[data-module="${moduleName}"]`);
    if (!el) {
      el = document.createElement('div');
      el.className = 'module-progress-item';
      el.setAttribute('data-module', moduleName);
      container.appendChild(el);
    }
    
    const statusIcons: Record<string, string> = {
      pending: '⏳',
      running: '🔄',
      completed: '✅',
      failed: '❌'
    };
    
    el.innerHTML = `
      <span class="module-status-icon">${statusIcons[status]}</span>
      <span class="module-name">${moduleName}</span>
      <div class="module-mini-progress">
        <div class="module-mini-bar" style="width: ${progress * 100}%"></div>
      </div>
    `;
  }
  
  private calculateTrustScore(results: Record<string, AuditResult<any>>, allAnomalies: any[]): TrustScore {
    const breakdown = {
      prototypeIntegrity: 1,
      executionContext: 1,
      hardwareEntropy: 1,
      networkIntegrity: 1,
      timingIntegrity: 1
    };
    
    for (const [module, result] of Object.entries(results)) {
      if (!result.success) continue;
      
      const anomalies = result.anomalies;
      let penalty = 0;
      
      for (const anomaly of anomalies) {
        switch (anomaly.severity) {
          case 'critical': penalty += 0.3; break;
          case 'high': penalty += 0.2; break;
          case 'medium': penalty += 0.1; break;
          case 'low': penalty += 0.05; break;
          case 'info': penalty += 0.01; break;
        }
      }
      
      const score = Math.max(0, 1 - penalty);
      
      switch (module) {
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
      breakdown.prototypeIntegrity * 0.25 +
      breakdown.executionContext * 0.2 +
      breakdown.hardwareEntropy * 0.25 +
      breakdown.networkIntegrity * 0.15 +
      breakdown.timingIntegrity * 0.15
    ) * 100);
    
    let verdict: TrustScore['verdict'] = 'trusted';
    if (overall < 40) verdict = 'compromised';
    else if (overall < 70) verdict = 'suspicious';
    else if (overall < 90) verdict = 'trusted';
    else verdict = 'trusted';
    
    return {
      overall,
      breakdown,
      verdict,
      anomalies: allAnomalies,
      timestamp: Date.now()
    };
  }
  
  private generateSummary(results: Record<string, AuditResult<any>>, anomalies: any[], trustScore: number): AuditSummary {
    const modulesRun = Object.keys(results).length;
    const modulesSuccessful = Object.values(results).filter(r => r.success).length;
    const modulesFailed = modulesRun - modulesSuccessful;
    const totalAnomalies = anomalies.length;
    const criticalAnomalies = anomalies.filter(a => a.severity === 'critical').length;
    const highAnomalies = anomalies.filter(a => a.severity === 'high').length;
    
    return {
      modulesRun,
      modulesSuccessful,
      modulesFailed,
      totalAnomalies,
      criticalAnomalies,
      highAnomalies,
      trustScore
    };
  }
  
  private renderReport(report: SpecterAuditReport): void {
    this.renderTrustScore(report.trustScore);
    this.renderModuleCards(report.results);
    this.renderMetricsGrid(report.summary);
    const anomaliesToShow = this.selectedModule && report.trustScore
      ? report.trustScore.anomalies.filter(a => a.module === this.selectedModule)
      : report.trustScore.anomalies;
    this.anomalyVisualizer.setAnomalies(anomaliesToShow);
    this.renderConfigToggles(report.config);
    this.updateTimestamp(report.timestamp);
  }
  
  private renderTrustScore(score: TrustScore): void {
    const circle = this.container.querySelector('#score-circle') as HTMLElement;
    const valueEl = this.container.querySelector('#score-value') as HTMLElement;
    const verdictEl = this.container.querySelector('#score-verdict') as HTMLElement;
    
    if (circle && valueEl && verdictEl) {
      valueEl.textContent = `${score.overall}%`;
      verdictEl.textContent = score.verdict.toUpperCase();
      
      circle.className = 'score-circle';
      circle.classList.add(`verdict-${score.verdict}`);
      
      const circumference = 2 * Math.PI * 45;
      const offset = circumference * (1 - score.overall / 100);
      circle.style.setProperty('--progress-offset', `${offset}px`);
    }
  }
  
  private renderModuleCards(results: Record<string, AuditResult<any>>): void {
    const container = this.container.querySelector('#module-cards') as HTMLElement;
    if (!container) return;
    
    const moduleOrder = ['prototypeIntegrity', 'workerCrossCheck', 'canvasWebGL', 'webAudio', 'networkProbing'];
    const moduleLabels: Record<string, string> = {
      prototypeIntegrity: 'Prototype Integrity',
      workerCrossCheck: 'Worker Cross-Check',
      canvasWebGL: 'Canvas/WebGL Entropy',
      webAudio: 'Web Audio Fingerprint',
      networkProbing: 'Network & Timing'
    };
    
    container.innerHTML = moduleOrder
      .filter(name => name in results)
      .map(name => {
        const result = results[name];
        const anomalyCount = result.anomalies.length;
        const criticalCount = result.anomalies.filter(a => a.severity === 'critical').length;
        const highCount = result.anomalies.filter(a => a.severity === 'high').length;
        
        let statusClass = 'success';
        if (!result.success) statusClass = 'error';
        else if (criticalCount > 0) statusClass = 'critical';
        else if (highCount > 0) statusClass = 'warning';
        
        const isSelected = this.selectedModule === name;
        
        return `
          <div class="module-card ${statusClass} ${isSelected ? 'selected' : ''}" data-module="${name}" style="cursor: pointer; ${isSelected ? 'border-color: var(--accent-primary); box-shadow: 0 0 10px rgba(0, 212, 170, 0.3);' : ''}" title="Click to inspect all observations/anomalies for this module">
            <div class="module-card-header">
              <span class="module-card-name">${moduleLabels[name]} ${isSelected ? ' (Filtered)' : ''}</span>
              <span class="module-card-status">${result.success ? 'OK' : 'FAILED'}</span>
            </div>
            <div class="module-card-meta">
              <span>Duration: ${result.duration.toFixed(1)}ms</span>
              <span>Anomalies: ${anomalyCount}</span>
            </div>
            ${criticalCount > 0 ? `<div class="module-card-critical">${criticalCount} critical</div>` : ''}
            ${highCount > 0 ? `<div class="module-card-high">${highCount} high</div>` : ''}
          </div>
        `;
      }).join('');
    
    container.querySelectorAll('.module-card').forEach(card => {
      card.addEventListener('click', () => {
        const moduleName = (card as HTMLElement).dataset.module;
        if (this.selectedModule === moduleName) {
          this.selectedModule = null;
        } else {
          this.selectedModule = moduleName || null;
        }
        if (this.currentReport) {
          this.renderReport(this.currentReport);
        }
      });
    });
  }
  
  private renderMetricsGrid(summary: AuditSummary): void {
    const container = this.container.querySelector('#metrics-grid') as HTMLElement;
    if (!container) return;
    
    container.innerHTML = `
      <div class="metric-card">
        <div class="metric-value">${summary.modulesSuccessful}/${summary.modulesRun}</div>
        <div class="metric-label">Modules Passed</div>
      </div>
      <div class="metric-card">
        <div class="metric-value">${summary.totalAnomalies}</div>
        <div class="metric-label">Total Anomalies</div>
      </div>
      <div class="metric-card critical">
        <div class="metric-value">${summary.criticalAnomalies}</div>
        <div class="metric-label">Critical</div>
      </div>
      <div class="metric-card warning">
        <div class="metric-value">${summary.highAnomalies}</div>
        <div class="metric-label">High Severity</div>
      </div>
      <div class="metric-card">
        <div class="metric-value">${summary.modulesFailed}</div>
        <div class="metric-label">Modules Failed</div>
      </div>
      <div class="metric-card">
        <div class="metric-value">${(Date.now() - this.startTime).toFixed(0)}ms</div>
        <div class="metric-label">Total Duration</div>
      </div>
    `;
  }
  
  private renderConfigToggles(config: SpecterConfig): void {
    const container = this.container.querySelector('#config-toggles') as HTMLElement;
    if (!container) return;
    
    container.innerHTML = Object.entries(config.modules)
      .map(([key, enabled]) => `
        <label class="config-toggle">
          <input type="checkbox" ${enabled ? 'checked' : ''} data-module="${key}">
          <span class="toggle-slider"></span>
          <span class="toggle-label">${key}</span>
        </label>
      `).join('');
    
    container.querySelectorAll('input').forEach(input => {
      input.addEventListener('change', (e) => {
        const target = e.target as HTMLInputElement;
        this.engine.updateConfig({
          modules: { [target.dataset.module!]: target.checked }
        });
      });
    });
  }
  
  private updateTimestamp(timestamp: number): void {
    const el = this.container.querySelector('#report-timestamp') as HTMLElement;
    if (el) {
      el.textContent = `Last audit: ${new Date(timestamp).toLocaleString()}`;
    }
  }
  
  private exportReport(): void {
    if (!this.currentReport) return;
    
    const blob = new Blob([JSON.stringify(this.currentReport, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `specterjs-report-${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }
  
  private clearReport(): void {
    this.currentReport = null;
    this.selectedModule = null;
    this.renderTrustScore({
      overall: 0,
      breakdown: { prototypeIntegrity: 0, executionContext: 0, hardwareEntropy: 0, networkIntegrity: 0, timingIntegrity: 0 },
      verdict: 'unknown',
      anomalies: [],
      timestamp: Date.now()
    });
    this.anomalyVisualizer.setAnomalies([]);
    this.container.querySelector('#module-cards')!.innerHTML = '';
    this.container.querySelector('#metrics-grid')!.innerHTML = '';
    this.updateTimestamp(0);
  }
  
  private startAutoRefresh(): void {
    setInterval(() => {
      if (!this.isRunning && this.currentReport) {
        this.updateTimestamp(this.currentReport.timestamp);
      }
    }, 1000);
  }
}
