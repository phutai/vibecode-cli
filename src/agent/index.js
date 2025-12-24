// ═══════════════════════════════════════════════════════════════════════════════
// VIBECODE AGENT - Main Entry Point
// Autonomous multi-module builder with self-healing
// ═══════════════════════════════════════════════════════════════════════════════

import chalk from 'chalk';
import ora from 'ora';
import path from 'path';
import fs from 'fs-extra';

import { DecompositionEngine, createDecompositionEngine } from './decomposition.js';
import { MemoryEngine, createMemoryEngine } from './memory.js';
import { SelfHealingEngine, createSelfHealingEngine } from './self-healing.js';
import {
  Orchestrator,
  createOrchestrator,
  ORCHESTRATOR_STATES,
  loadProgress,
  loadDecomposition
} from './orchestrator.js';

/**
 * Vibecode Agent Class
 * Main interface for autonomous project building
 */
export class VibecodeAgent {
  constructor(options = {}) {
    this.projectPath = options.projectPath || process.cwd();
    this.verbose = options.verbose || false;

    // Engine instances
    this.decomposition = null;
    this.memory = null;
    this.selfHealing = null;
    this.orchestrator = null;

    // Agent state
    this.initialized = false;
    this.buildResult = null;
  }

  /**
   * Initialize the agent and all engines
   */
  async initialize() {
    if (this.initialized) return this;

    const spinner = ora('Initializing Vibecode Agent...').start();

    try {
      // Create engine instances
      this.decomposition = createDecompositionEngine();
      this.memory = await createMemoryEngine(this.projectPath);
      this.selfHealing = createSelfHealingEngine(this.memory);

      this.orchestrator = createOrchestrator({
        projectPath: this.projectPath,
        decompositionEngine: this.decomposition,
        memoryEngine: this.memory,
        selfHealingEngine: this.selfHealing
      });

      await this.orchestrator.initialize(this.projectPath);

      // Setup event handlers
      this.setupEventHandlers();

      this.initialized = true;
      spinner.succeed('Vibecode Agent ready');

      return this;
    } catch (error) {
      spinner.fail(`Agent initialization failed: ${error.message}`);
      throw error;
    }
  }

  /**
   * Setup event handlers for progress reporting
   */
  setupEventHandlers() {
    if (!this.verbose) return;

    this.orchestrator.on('state_change', ({ from, to }) => {
      console.log(chalk.gray(`  State: ${from} → ${to}`));
    });

    this.orchestrator.on('module_start', ({ moduleId, module }) => {
      console.log(chalk.cyan(`\n  Starting: ${module.name}`));
    });

    this.orchestrator.on('module_complete', ({ moduleId }) => {
      console.log(chalk.green(`  ✓ ${moduleId} complete`));
    });

    this.orchestrator.on('module_fail', ({ moduleId, error, attempts }) => {
      console.log(chalk.red(`  ✗ ${moduleId} failed after ${attempts} attempts`));
    });

    this.orchestrator.on('healing_start', ({ moduleId }) => {
      console.log(chalk.yellow(`  Self-healing ${moduleId}...`));
    });
  }

  /**
   * Build a project from description
   */
  async build(description, options = {}) {
    if (!this.initialized) {
      await this.initialize();
    }

    this.showHeader(description);

    try {
      this.buildResult = await this.orchestrator.build(description, options);
      this.showResults(this.buildResult);
      return this.buildResult;
    } catch (error) {
      console.error(chalk.red(`\nAgent build failed: ${error.message}`));
      throw error;
    }
  }

  /**
   * Show agent header
   */
  showHeader(description) {
    console.log();
    console.log(chalk.magenta('╭' + '─'.repeat(68) + '╮'));
    console.log(chalk.magenta('│') + ' '.repeat(68) + chalk.magenta('│'));
    console.log(chalk.magenta('│') + chalk.bold.white('   🤖 VIBECODE AGENT') + ' '.repeat(48) + chalk.magenta('│'));
    console.log(chalk.magenta('│') + chalk.gray('   Autonomous Multi-Module Builder') + ' '.repeat(32) + chalk.magenta('│'));
    console.log(chalk.magenta('│') + ' '.repeat(68) + chalk.magenta('│'));

    const truncDesc = description.length > 60
      ? description.substring(0, 57) + '...'
      : description;
    console.log(chalk.magenta('│') + chalk.gray(`   "${truncDesc}"`) + ' '.repeat(Math.max(0, 65 - truncDesc.length)) + chalk.magenta('│'));
    console.log(chalk.magenta('│') + ' '.repeat(68) + chalk.magenta('│'));
    console.log(chalk.magenta('╰' + '─'.repeat(68) + '╯'));
    console.log();
  }

  /**
   * Show build results
   */
  showResults(result) {
    console.log();

    if (result.success) {
      console.log(chalk.green('╭' + '─'.repeat(68) + '╮'));
      console.log(chalk.green('│') + ' '.repeat(68) + chalk.green('│'));
      console.log(chalk.green('│') + chalk.bold.white('   ✓ AGENT BUILD COMPLETE') + ' '.repeat(42) + chalk.green('│'));
    } else {
      console.log(chalk.yellow('╭' + '─'.repeat(68) + '╮'));
      console.log(chalk.yellow('│') + ' '.repeat(68) + chalk.yellow('│'));
      console.log(chalk.yellow('│') + chalk.bold.white('   ⚠ AGENT BUILD INCOMPLETE') + ' '.repeat(40) + chalk.yellow('│'));
    }

    const color = result.success ? chalk.green : chalk.yellow;

    console.log(color('│') + ' '.repeat(68) + color('│'));
    console.log(color('│') + chalk.white(`   📦 Type:       ${result.projectType}`) + ' '.repeat(Math.max(0, 49 - result.projectType.length)) + color('│'));
    console.log(color('│') + chalk.white(`   📊 Complexity: ${result.complexity}`) + ' '.repeat(Math.max(0, 49 - result.complexity.length)) + color('│'));
    console.log(color('│') + chalk.white(`   ⏱️  Duration:   ${result.duration}`) + ' '.repeat(Math.max(0, 48 - result.duration.length)) + color('│'));
    console.log(color('│') + ' '.repeat(68) + color('│'));

    // Module stats
    const modStats = `${result.modules.completed}/${result.modules.total} modules`;
    console.log(color('│') + chalk.white(`   📁 Modules:    ${modStats}`) + ' '.repeat(Math.max(0, 49 - modStats.length)) + color('│'));

    if (result.modules.failed > 0) {
      console.log(color('│') + chalk.red(`   ❌ Failed:     ${result.modules.failed}`) + ' '.repeat(49) + color('│'));
    }
    if (result.modules.skipped > 0) {
      console.log(color('│') + chalk.yellow(`   ⏭️  Skipped:    ${result.modules.skipped}`) + ' '.repeat(48) + color('│'));
    }

    // Retries
    if (result.retries.total > 0) {
      console.log(color('│') + chalk.gray(`   🔄 Retries:    ${result.retries.total}`) + ' '.repeat(49) + color('│'));
    }

    console.log(color('│') + ' '.repeat(68) + color('│'));

    // Completed modules list
    if (result.completedModules.length > 0) {
      console.log(color('│') + chalk.white('   Completed:') + ' '.repeat(54) + color('│'));
      for (const mod of result.completedModules) {
        console.log(color('│') + chalk.green(`     ✓ ${mod}`) + ' '.repeat(Math.max(0, 59 - mod.length)) + color('│'));
      }
    }

    // Failed modules list
    if (result.failedModules.length > 0) {
      console.log(color('│') + ' '.repeat(68) + color('│'));
      console.log(color('│') + chalk.white('   Failed:') + ' '.repeat(57) + color('│'));
      for (const mod of result.failedModules) {
        console.log(color('│') + chalk.red(`     ✗ ${mod}`) + ' '.repeat(Math.max(0, 59 - mod.length)) + color('│'));
      }
    }

    console.log(color('│') + ' '.repeat(68) + color('│'));
    console.log(color('╰' + '─'.repeat(68) + '╯'));
    console.log();

    // Next steps
    if (result.success) {
      console.log(chalk.gray('  Next steps:'));
      console.log(chalk.gray('    cd ' + path.basename(this.projectPath)));
      console.log(chalk.gray('    npm install'));
      console.log(chalk.gray('    npm start'));
    } else {
      console.log(chalk.gray('  To investigate:'));
      console.log(chalk.gray('    Check .vibecode/agent/orchestrator.log'));
      console.log(chalk.gray('    Check .vibecode/agent/evidence/*.log'));
    }
    console.log();
  }

  /**
   * Resume a previously interrupted build
   */
  async resume(options = {}) {
    if (!this.initialized) {
      await this.initialize();
    }

    // Load progress to show header
    const progress = await loadProgress(this.projectPath);
    if (!progress) {
      console.log(chalk.yellow('\n📭 No previous session found.\n'));
      console.log(chalk.gray('   Start new build: vibecode agent "description" --new\n'));
      return null;
    }

    this.showResumeHeader(progress, options);

    try {
      this.buildResult = await this.orchestrator.resumeBuild(options);
      this.showResults(this.buildResult);
      return this.buildResult;
    } catch (error) {
      console.error(chalk.red(`\nAgent resume failed: ${error.message}`));
      throw error;
    }
  }

  /**
   * Show resume header
   */
  showResumeHeader(progress, options) {
    const fromModule = options.fromModule !== undefined
      ? options.fromModule + 1
      : progress.currentModule + 1;
    const totalModules = progress.totalModules;
    const completed = progress.completedModules?.length || progress.currentModule || 0;

    console.log();
    console.log(chalk.cyan('╭' + '─'.repeat(68) + '╮'));
    console.log(chalk.cyan('│') + ' '.repeat(68) + chalk.cyan('│'));
    console.log(chalk.cyan('│') + chalk.bold.white('   🔄 RESUMING AGENT') + ' '.repeat(48) + chalk.cyan('│'));
    console.log(chalk.cyan('│') + ' '.repeat(68) + chalk.cyan('│'));

    const projectLine = `   Project: ${progress.projectName}`;
    console.log(chalk.cyan('│') + chalk.white(projectLine) + ' '.repeat(Math.max(0, 66 - projectLine.length)) + chalk.cyan('│'));

    const progressLine = `   Progress: ${completed}/${totalModules} modules completed`;
    console.log(chalk.cyan('│') + chalk.white(progressLine) + ' '.repeat(Math.max(0, 66 - progressLine.length)) + chalk.cyan('│'));

    const resumeLine = `   Resuming from module ${fromModule}`;
    console.log(chalk.cyan('│') + chalk.yellow(resumeLine) + ' '.repeat(Math.max(0, 66 - resumeLine.length)) + chalk.cyan('│'));

    console.log(chalk.cyan('│') + ' '.repeat(68) + chalk.cyan('│'));
    console.log(chalk.cyan('╰' + '─'.repeat(68) + '╯'));
    console.log();
  }

  /**
   * Quick build helper
   */
  static async quickBuild(description, options = {}) {
    const agent = new VibecodeAgent(options);
    await agent.initialize();
    return agent.build(description, options);
  }

  /**
   * Analyze project without building
   */
  async analyze(description) {
    if (!this.initialized) {
      await this.initialize();
    }

    const decomposition = await this.decomposition.decompose(description);

    console.log();
    console.log(chalk.cyan('╭' + '─'.repeat(68) + '╮'));
    console.log(chalk.cyan('│') + chalk.bold.white('   📋 PROJECT ANALYSIS') + ' '.repeat(46) + chalk.cyan('│'));
    console.log(chalk.cyan('│') + ' '.repeat(68) + chalk.cyan('│'));
    console.log(chalk.cyan('│') + chalk.white(`   Type:       ${decomposition.projectType}`) + ' '.repeat(Math.max(0, 52 - decomposition.projectType.length)) + chalk.cyan('│'));
    console.log(chalk.cyan('│') + chalk.white(`   Complexity: ${decomposition.estimatedComplexity}`) + ' '.repeat(Math.max(0, 52 - decomposition.estimatedComplexity.length)) + chalk.cyan('│'));
    console.log(chalk.cyan('│') + chalk.white(`   Modules:    ${decomposition.totalModules}`) + ' '.repeat(51) + chalk.cyan('│'));
    console.log(chalk.cyan('│') + ' '.repeat(68) + chalk.cyan('│'));
    console.log(chalk.cyan('│') + chalk.white('   Build Order:') + ' '.repeat(52) + chalk.cyan('│'));

    for (let i = 0; i < decomposition.buildOrder.length; i++) {
      const moduleId = decomposition.buildOrder[i];
      const module = decomposition.modules.find(m => m.id === moduleId);
      const line = `     ${i + 1}. ${module?.name || moduleId} (${module?.estimatedSize || 'unknown'})`;
      console.log(chalk.cyan('│') + chalk.gray(line) + ' '.repeat(Math.max(0, 66 - line.length)) + chalk.cyan('│'));
    }

    console.log(chalk.cyan('│') + ' '.repeat(68) + chalk.cyan('│'));
    console.log(chalk.cyan('╰' + '─'.repeat(68) + '╯'));
    console.log();

    return decomposition;
  }

  /**
   * Get agent status
   */
  getStatus() {
    return {
      initialized: this.initialized,
      projectPath: this.projectPath,
      orchestratorState: this.orchestrator?.getState(),
      memoryStats: this.memory?.getStats(),
      healingStats: this.selfHealing?.getStats()
    };
  }

  /**
   * Export memory report
   */
  async exportReport() {
    if (!this.memory) {
      throw new Error('Agent not initialized');
    }

    const report = this.memory.exportToMarkdown();
    const reportPath = path.join(this.projectPath, '.vibecode', 'agent', 'report.md');

    await fs.writeFile(reportPath, report);
    console.log(chalk.green(`Report exported to: ${reportPath}`));

    return report;
  }

  /**
   * Clear agent memory
   */
  async clearMemory() {
    if (this.memory) {
      await this.memory.clear();
      console.log(chalk.yellow('Agent memory cleared'));
    }
  }
}

/**
 * Create agent instance
 */
export function createAgent(options = {}) {
  return new VibecodeAgent(options);
}

/**
 * Quick build function
 */
export async function agentBuild(description, options = {}) {
  return VibecodeAgent.quickBuild(description, options);
}

// Re-export engines for direct use
export {
  DecompositionEngine,
  createDecompositionEngine,
  MemoryEngine,
  createMemoryEngine,
  SelfHealingEngine,
  createSelfHealingEngine,
  Orchestrator,
  createOrchestrator,
  ORCHESTRATOR_STATES,
  loadProgress,
  loadDecomposition
};
