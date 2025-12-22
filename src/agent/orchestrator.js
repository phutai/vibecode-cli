// ═══════════════════════════════════════════════════════════════════════════════
// VIBECODE AGENT - Orchestrator
// Coordinates module builds in dependency order with Claude Code
// ═══════════════════════════════════════════════════════════════════════════════

import chalk from 'chalk';
import ora from 'ora';
import path from 'path';
import fs from 'fs-extra';

import { spawnClaudeCode, isClaudeCodeAvailable } from '../providers/index.js';
import { runTests } from '../core/test-runner.js';
import { ensureDir, appendToFile } from '../utils/files.js';
import { ProgressDashboard } from '../ui/dashboard.js';
import { translateError, showError, inlineError } from '../ui/error-translator.js';
import { BackupManager } from '../core/backup.js';

/**
 * Orchestrator states
 */
const ORCHESTRATOR_STATES = {
  IDLE: 'idle',
  INITIALIZING: 'initializing',
  DECOMPOSING: 'decomposing',
  BUILDING: 'building',
  HEALING: 'healing',
  TESTING: 'testing',
  COMPLETED: 'completed',
  FAILED: 'failed',
  PAUSED: 'paused'
};

/**
 * Event types for callbacks
 */
const EVENTS = {
  STATE_CHANGE: 'state_change',
  MODULE_START: 'module_start',
  MODULE_COMPLETE: 'module_complete',
  MODULE_FAIL: 'module_fail',
  BUILD_OUTPUT: 'build_output',
  HEALING_START: 'healing_start',
  HEALING_COMPLETE: 'healing_complete',
  PROGRESS: 'progress'
};

/**
 * Orchestrator Class
 * Main coordinator for multi-module builds
 */
export class Orchestrator {
  constructor(options = {}) {
    this.decompositionEngine = options.decompositionEngine;
    this.memoryEngine = options.memoryEngine;
    this.selfHealingEngine = options.selfHealingEngine;

    this.state = ORCHESTRATOR_STATES.IDLE;
    this.projectPath = options.projectPath || process.cwd();
    this.logPath = null;
    this.eventHandlers = {};

    // Build configuration
    this.config = {
      maxModuleRetries: options.maxModuleRetries || 3,
      maxTotalRetries: options.maxTotalRetries || 10,
      testAfterEachModule: options.testAfterEachModule ?? true,
      continueOnFailure: options.continueOnFailure ?? false,
      parallelBuilds: options.parallelBuilds ?? false, // Future feature
      timeout: options.timeout || 30 * 60 * 1000, // 30 minutes per module
      useDashboard: options.useDashboard ?? true, // Use visual dashboard
      verbose: options.verbose ?? false
    };

    // Dashboard instance
    this.dashboard = null;

    // Build state
    this.buildState = {
      startTime: null,
      currentModule: null,
      completedModules: [],
      failedModules: [],
      skippedModules: [],
      totalRetries: 0,
      errors: []
    };
  }

  /**
   * Register event handler
   */
  on(event, handler) {
    if (!this.eventHandlers[event]) {
      this.eventHandlers[event] = [];
    }
    this.eventHandlers[event].push(handler);
    return this;
  }

  /**
   * Emit event
   */
  emit(event, data) {
    if (this.eventHandlers[event]) {
      for (const handler of this.eventHandlers[event]) {
        try {
          handler(data);
        } catch (e) {
          console.error(`Event handler error: ${e.message}`);
        }
      }
    }
  }

  /**
   * Set state and emit event
   */
  setState(newState) {
    const oldState = this.state;
    this.state = newState;
    this.emit(EVENTS.STATE_CHANGE, { from: oldState, to: newState });
  }

  /**
   * Initialize orchestrator
   */
  async initialize(projectPath) {
    this.setState(ORCHESTRATOR_STATES.INITIALIZING);
    this.projectPath = projectPath;

    // Setup log directory
    const agentDir = path.join(projectPath, '.vibecode', 'agent');
    await ensureDir(agentDir);
    this.logPath = path.join(agentDir, 'orchestrator.log');

    // Check Claude Code availability
    const claudeAvailable = await isClaudeCodeAvailable();
    if (!claudeAvailable) {
      throw new Error('Claude Code CLI not available. Install with: npm install -g @anthropic-ai/claude-code');
    }

    // Initialize memory if provided
    if (this.memoryEngine) {
      await this.memoryEngine.initialize();
    }

    // Link self-healing to memory
    if (this.selfHealingEngine && this.memoryEngine) {
      this.selfHealingEngine.setMemoryEngine(this.memoryEngine);
    }

    await this.log('Orchestrator initialized');
    return this;
  }

  /**
   * Log message to file
   */
  async log(message, level = 'info') {
    const timestamp = new Date().toISOString();
    const line = `[${timestamp}] [${level.toUpperCase()}] ${message}\n`;

    if (this.logPath) {
      await appendToFile(this.logPath, line);
    }

    if (level === 'error') {
      console.error(chalk.red(message));
    }
  }

  /**
   * Main build entry point
   */
  async build(description, options = {}) {
    this.buildState.startTime = Date.now();

    // Create backup before agent build
    const backup = new BackupManager(this.projectPath);
    await backup.createBackup('agent-build');

    try {
      // Step 1: Decompose project
      this.setState(ORCHESTRATOR_STATES.DECOMPOSING);
      await this.log(`Decomposing: "${description}"`);

      const decomposition = await this.decompositionEngine.decompose(description, options);

      // Store in memory
      if (this.memoryEngine) {
        await this.memoryEngine.setProjectContext({
          description,
          type: decomposition.projectType,
          complexity: decomposition.estimatedComplexity,
          totalModules: decomposition.totalModules
        });
      }

      await this.log(`Decomposed into ${decomposition.totalModules} modules: ${decomposition.buildOrder.join(', ')}`);

      // Step 2: Build modules in order
      this.setState(ORCHESTRATOR_STATES.BUILDING);

      const results = await this.buildModules(decomposition);

      // Step 3: Final summary
      if (results.success) {
        this.setState(ORCHESTRATOR_STATES.COMPLETED);
      } else {
        this.setState(ORCHESTRATOR_STATES.FAILED);
      }

      return this.generateBuildReport(decomposition, results);

    } catch (error) {
      this.setState(ORCHESTRATOR_STATES.FAILED);
      await this.log(`Build failed: ${error.message}`, 'error');
      throw error;
    }
  }

  /**
   * Build all modules in dependency order
   */
  async buildModules(decomposition) {
    const results = {
      success: true,
      modules: {},
      totalTime: 0
    };

    // Create and start dashboard if enabled
    if (this.config.useDashboard) {
      this.dashboard = new ProgressDashboard({
        title: 'VIBECODE AGENT',
        projectName: path.basename(this.projectPath),
        mode: `Agent (${decomposition.totalModules} modules)`
      });

      // Set modules for dashboard
      this.dashboard.setModules(decomposition.buildOrder.map(id => {
        const mod = this.decompositionEngine.getModule(id);
        return { name: mod?.name || id };
      }));

      this.dashboard.start();
    }

    try {
      for (const moduleId of decomposition.buildOrder) {
        // Check if we should stop
        if (this.state === ORCHESTRATOR_STATES.PAUSED) {
          await this.log('Build paused');
          break;
        }

        // Check if module can be built (dependencies satisfied)
        if (!this.decompositionEngine.canBuildModule(moduleId)) {
          const depStatus = decomposition.dependencyGraph[moduleId];
          const failedDeps = depStatus?.dependsOn.filter(d =>
            this.buildState.failedModules.includes(d)
          );

          if (failedDeps?.length > 0) {
            await this.log(`Skipping ${moduleId}: dependencies failed (${failedDeps.join(', ')})`, 'warn');
            this.buildState.skippedModules.push(moduleId);
            results.modules[moduleId] = { status: 'skipped', reason: 'dependencies_failed' };

            // Update dashboard
            if (this.dashboard) {
              const mod = this.decompositionEngine.getModule(moduleId);
              this.dashboard.failModule(mod?.name || moduleId);
            }
            continue;
          }
        }

        // Update dashboard - start module
        if (this.dashboard) {
          const mod = this.decompositionEngine.getModule(moduleId);
          this.dashboard.startModule(mod?.name || moduleId);
        }

        // Build the module
        const moduleResult = await this.buildModule(moduleId, decomposition);
        results.modules[moduleId] = moduleResult;

        // Update dashboard - complete/fail module
        if (this.dashboard) {
          const mod = this.decompositionEngine.getModule(moduleId);
          if (moduleResult.success) {
            this.dashboard.completeModule(mod?.name || moduleId, true);
          } else {
            this.dashboard.failModule(mod?.name || moduleId);
          }
        }

        if (!moduleResult.success) {
          results.success = false;

          if (!this.config.continueOnFailure) {
            await this.log(`Stopping build due to module failure: ${moduleId}`, 'error');
            break;
          }
        }
      }
    } finally {
      // Stop dashboard
      if (this.dashboard) {
        this.dashboard.stop();
      }
    }

    results.totalTime = Date.now() - this.buildState.startTime;
    return results;
  }

  /**
   * Build a single module
   */
  async buildModule(moduleId, decomposition) {
    const module = this.decompositionEngine.getModule(moduleId);
    if (!module) {
      return { success: false, error: 'Module not found' };
    }

    this.buildState.currentModule = moduleId;
    this.emit(EVENTS.MODULE_START, { moduleId, module });

    // Only use spinner if dashboard is not enabled
    const spinner = !this.config.useDashboard ? ora({
      text: chalk.cyan(`Building module: ${module.name}`),
      prefixText: this.getProgressPrefix()
    }).start() : null;

    // Record in memory
    if (this.memoryEngine) {
      await this.memoryEngine.startModule(moduleId, {
        name: module.name,
        description: module.description
      });
    }

    let attempts = 0;
    let lastError = null;
    let healingPrompt = null; // Store fix prompt from self-healing

    while (attempts < this.config.maxModuleRetries) {
      attempts++;
      module.buildAttempts = attempts;

      try {
        await this.log(`Building ${moduleId} (attempt ${attempts}/${this.config.maxModuleRetries})`);

        // Use healing prompt if available (from previous retry), otherwise generate fresh
        let prompt;
        if (healingPrompt) {
          prompt = healingPrompt;
          healingPrompt = null; // Clear after use
        } else {
          prompt = this.generateBuildPrompt(module, decomposition);
        }

        // Run Claude Code
        const buildResult = await this.runClaudeBuild(prompt, moduleId);

        if (buildResult.success) {
          // Run tests if configured
          if (this.config.testAfterEachModule) {
            if (spinner) spinner.text = chalk.cyan(`Testing module: ${module.name}`);
            if (this.dashboard) this.dashboard.addLog(`Testing: ${module.name}`);
            this.setState(ORCHESTRATOR_STATES.TESTING);

            const testResult = await runTests(this.projectPath);

            if (!testResult.passed) {
              throw new Error(`Tests failed: ${testResult.summary.failed} failures`);
            }
          }

          // Success!
          if (spinner) spinner.succeed(chalk.green(`Module complete: ${module.name}`));

          this.decompositionEngine.updateModuleStatus(moduleId, 'completed', {
            files: buildResult.files || []
          });
          this.buildState.completedModules.push(moduleId);

          // Record in memory
          if (this.memoryEngine) {
            await this.memoryEngine.completeModule(moduleId, {
              files: buildResult.files,
              attempts
            });
          }

          this.emit(EVENTS.MODULE_COMPLETE, { moduleId, result: buildResult });

          return {
            success: true,
            attempts,
            files: buildResult.files
          };
        }

        throw new Error(buildResult.error || 'Build failed');

      } catch (error) {
        lastError = error;
        const translated = translateError(error);
        await this.log(`Module ${moduleId} attempt ${attempts} failed: ${translated.title} - ${error.message}`, 'error');

        // Show translated error if not using dashboard
        if (!this.config.useDashboard) {
          console.log(inlineError(error));
        } else if (this.dashboard) {
          this.dashboard.addLog(`Error: ${translated.title}`);
        }

        // Try self-healing
        if (this.selfHealingEngine && attempts < this.config.maxModuleRetries) {
          if (spinner) spinner.text = chalk.yellow(`Healing module: ${module.name}`);
          if (this.dashboard) this.dashboard.addLog(`Healing: ${module.name}`);
          this.setState(ORCHESTRATOR_STATES.HEALING);
          this.emit(EVENTS.HEALING_START, { moduleId, error });

          const healing = await this.selfHealingEngine.heal(error.message, moduleId, {
            attempt: attempts,
            completedModules: this.buildState.completedModules
          });

          if (healing.shouldRetry) {
            const errorCategory = healing.analysis?.category || 'UNKNOWN';
            await this.log(`Self-healing: ${errorCategory} error, retrying...`);
            this.buildState.totalRetries++;

            // Store healing prompt for next iteration
            healingPrompt = healing.prompt;

            // Record healing attempt
            if (this.memoryEngine) {
              await this.memoryEngine.recordError({
                message: error.message,
                type: errorCategory,
                moduleId,
                healingAttempt: attempts
              });
            }

            continue;
          }
        }

        break; // Exit retry loop if can't heal
      }
    }

    // Module failed
    if (spinner) spinner.fail(chalk.red(`Module failed: ${module.name}`));

    this.decompositionEngine.updateModuleStatus(moduleId, 'failed', {
      error: lastError?.message
    });
    this.buildState.failedModules.push(moduleId);
    this.buildState.errors.push({ moduleId, error: lastError?.message });

    if (this.memoryEngine) {
      await this.memoryEngine.failModule(moduleId, lastError);
    }

    this.emit(EVENTS.MODULE_FAIL, { moduleId, error: lastError, attempts });

    return {
      success: false,
      attempts,
      error: lastError?.message
    };
  }

  /**
   * Generate build prompt for a module
   */
  generateBuildPrompt(module, decomposition) {
    let prompt = `# Build Module: ${module.name}\n\n`;

    // Module description
    prompt += `## Description\n${module.description}\n\n`;

    // Dependencies context
    if (module.dependencies.length > 0) {
      prompt += `## Dependencies (already built)\n`;
      for (const depId of module.dependencies) {
        const dep = this.decompositionEngine.getModule(depId);
        if (dep) {
          prompt += `- **${dep.name}**: ${dep.description}\n`;
          if (dep.files?.length > 0) {
            prompt += `  Files: ${dep.files.join(', ')}\n`;
          }
        }
      }
      prompt += '\n';
    }

    // Memory context
    if (this.memoryEngine) {
      const contextSummary = this.memoryEngine.generateContextSummary();
      prompt += contextSummary;
    }

    // Project context
    const projectContext = this.memoryEngine?.getProjectContext();
    if (projectContext?.description) {
      prompt += `## Project Goal\n${projectContext.description}\n\n`;
    }

    // Build instructions
    prompt += `## Instructions\n`;
    prompt += `1. Create all necessary files for the ${module.name} module\n`;
    prompt += `2. Follow patterns established in completed modules\n`;
    prompt += `3. Ensure compatibility with dependencies\n`;
    prompt += `4. Add appropriate error handling\n`;
    prompt += `5. Export any functions/components needed by dependent modules\n\n`;

    // Specific instructions based on module type
    const moduleInstructions = this.getModuleSpecificInstructions(module.id);
    if (moduleInstructions) {
      prompt += `## ${module.name} Specific Requirements\n${moduleInstructions}\n`;
    }

    return prompt;
  }

  /**
   * Get module-specific build instructions
   */
  getModuleSpecificInstructions(moduleId) {
    const instructions = {
      core: `- Setup project structure (src/, public/, etc.)
- Create configuration files (package.json, tsconfig.json if needed)
- Setup base utilities and helpers`,

      auth: `- Implement login/signup forms or endpoints
- Setup session/token management
- Add password hashing if applicable
- Create auth middleware/guards`,

      database: `- Define data models/schemas
- Setup database connection
- Create migration scripts if needed
- Add seed data for development`,

      api: `- Create REST/GraphQL endpoints
- Add request validation
- Implement error handling middleware
- Add API documentation`,

      ui: `- Create reusable components
- Setup styling (CSS/Tailwind/etc.)
- Ensure responsive design
- Add accessibility attributes`,

      pages: `- Create page components/routes
- Connect to API endpoints
- Add loading and error states
- Implement navigation`,

      tests: `- Write unit tests for core functions
- Add integration tests for API
- Create component tests for UI
- Setup test utilities and mocks`
    };

    return instructions[moduleId] || null;
  }

  /**
   * Run Claude Code build
   */
  async runClaudeBuild(prompt, moduleId) {
    const evidencePath = path.join(this.projectPath, '.vibecode', 'agent', 'evidence');
    await ensureDir(evidencePath);
    const logPath = path.join(evidencePath, `${moduleId}.log`);

    try {
      const result = await spawnClaudeCode(prompt, {
        cwd: this.projectPath,
        logPath,
        timeout: this.config.timeout
      });

      // Try to detect created files
      const files = await this.detectCreatedFiles();

      return {
        success: result.code === 0,
        code: result.code,
        output: result.output,
        files,
        error: result.code !== 0 ? result.error : null
      };
    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Detect files created during build
   */
  async detectCreatedFiles() {
    // This is a simplified version - in real implementation,
    // we would track git status or file system changes
    try {
      const srcPath = path.join(this.projectPath, 'src');
      if (await fs.pathExists(srcPath)) {
        const files = await fs.readdir(srcPath, { recursive: true });
        return files.filter(f => !f.startsWith('.')).slice(0, 20);
      }
    } catch (e) {
      // Ignore
    }
    return [];
  }

  /**
   * Get progress prefix for spinner
   */
  getProgressPrefix() {
    const completed = this.buildState.completedModules.length;
    const total = this.decompositionEngine?.modules?.length || 0;
    const percent = total > 0 ? Math.round((completed / total) * 100) : 0;
    return chalk.gray(`[${completed}/${total}] ${percent}%`);
  }

  /**
   * Generate final build report
   */
  generateBuildReport(decomposition, results) {
    const duration = ((Date.now() - this.buildState.startTime) / 1000 / 60).toFixed(1);

    return {
      success: results.success,
      projectType: decomposition.projectType,
      complexity: decomposition.estimatedComplexity,
      duration: `${duration} minutes`,

      modules: {
        total: decomposition.totalModules,
        completed: this.buildState.completedModules.length,
        failed: this.buildState.failedModules.length,
        skipped: this.buildState.skippedModules.length
      },

      buildOrder: decomposition.buildOrder,
      completedModules: this.buildState.completedModules,
      failedModules: this.buildState.failedModules,
      skippedModules: this.buildState.skippedModules,

      retries: {
        total: this.buildState.totalRetries,
        max: this.config.maxTotalRetries
      },

      errors: this.buildState.errors,
      moduleResults: results.modules,

      healingStats: this.selfHealingEngine?.getStats() || null,
      memoryStats: this.memoryEngine?.getStats() || null
    };
  }

  /**
   * Pause the build
   */
  pause() {
    if (this.state === ORCHESTRATOR_STATES.BUILDING) {
      this.setState(ORCHESTRATOR_STATES.PAUSED);
    }
  }

  /**
   * Resume paused build
   */
  resume() {
    if (this.state === ORCHESTRATOR_STATES.PAUSED) {
      this.setState(ORCHESTRATOR_STATES.BUILDING);
    }
  }

  /**
   * Get current build state
   */
  getState() {
    return {
      state: this.state,
      currentModule: this.buildState.currentModule,
      completedModules: this.buildState.completedModules,
      failedModules: this.buildState.failedModules,
      progress: this.getProgressPrefix()
    };
  }
}

/**
 * Create orchestrator instance
 */
export function createOrchestrator(options = {}) {
  return new Orchestrator(options);
}

export { ORCHESTRATOR_STATES, EVENTS };
