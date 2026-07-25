import type { SpecterConfig } from './core/types.js';
import { SpecterEngine, createEngine, DEFAULT_CONFIG as ENGINE_DEFAULT_CONFIG } from './core/Engine.js';
import { prototypeIntegrityRunner } from './modules/prototypeIntegrity.js';
import { workerCrossCheckRunner } from './modules/workerCrossCheck.js';
import { canvasWebGLRunner } from './modules/canvasWebGL.js';
import { webAudioRunner } from './modules/webAudio.js';
import { networkProbingRunner } from './modules/networkProbing.js';
import { Dashboard } from './ui/Dashboard.js';
import './style.css';

class SpecterJSApp {
  private engine: SpecterEngine;
  private dashboard: Dashboard;
  
  constructor() {
    this.engine = createEngine(ENGINE_DEFAULT_CONFIG);
    
    this.engine.prototypeIntegrityRunner = prototypeIntegrityRunner;
    this.engine.workerCrossCheckRunner = workerCrossCheckRunner;
    this.engine.canvasWebGLRunner = canvasWebGLRunner;
    this.engine.webAudioRunner = webAudioRunner;
    this.engine.networkProbingRunner = networkProbingRunner;
    this.engine.registerRunner('prototypeIntegrity', prototypeIntegrityRunner);
    this.engine.registerRunner('workerCrossCheck', workerCrossCheckRunner);
    this.engine.registerRunner('canvasWebGL', canvasWebGLRunner);
    this.engine.registerRunner('webAudio', webAudioRunner);
    this.engine.registerRunner('networkProbing', networkProbingRunner);
    
    const appContainer = document.getElementById('app')!;
    this.dashboard = new Dashboard(appContainer, this.engine);
    
    this.registerGlobalAPI();
  }
  
  private registerGlobalAPI(): void {
    (window as any).SpecterJS = {
      engine: this.engine,
      dashboard: this.dashboard,
      runAudit: () => this.dashboard.runAudit(),
      getReport: () => this.engine.getResults(),
      config: this.engine.getConfig(),
      setConfig: (config: Partial<SpecterConfig>) => this.engine.updateConfig(config)
    };
    
    console.log('%c👻 SpecterJS loaded', 'color: #00ff88; font-size: 16px; font-weight: bold;');
    console.log('%cAccess via window.SpecterJS', 'color: #888;');
    console.log('%cModules: prototypeIntegrity, workerCrossCheck, canvasWebGL, webAudio, networkProbing', 'color: #666;');
  }
}

document.addEventListener('DOMContentLoaded', () => {
  new SpecterJSApp();
});

export { SpecterJSApp };
