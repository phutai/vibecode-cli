// ═══════════════════════════════════════════════════════════════════════════════
// VIBECODE CLI - Progress Dashboard
// Phase H2: Real-time Visual Progress with ETA
// ═══════════════════════════════════════════════════════════════════════════════

import chalk from 'chalk';
import readline from 'readline';

/**
 * ProgressDashboard - Full-screen progress display for multi-module builds
 *
 * Usage:
 *   const dashboard = new ProgressDashboard({
 *     title: 'VIBECODE AGENT',
 *     projectName: 'my-app',
 *     mode: 'Agent (8 modules)'
 *   });
 *   dashboard.setModules(['core', 'auth', 'dashboard']);
 *   dashboard.start();
 *   dashboard.startModule('core');
 *   dashboard.completeModule('core');
 *   dashboard.stop();
 */
export class ProgressDashboard {
  constructor(options = {}) {
    this.title = options.title || 'VIBECODE';
    this.projectName = options.projectName || 'project';
    this.mode = options.mode || 'build';
    this.modules = [];
    this.startTime = Date.now();
    this.currentModule = null;
    this.completedModules = [];
    this.moduleTimes = {};
    this.isRendering = false;
    this.renderInterval = null;
    this.logs = [];
    this.maxLogs = options.maxLogs || 3;
  }

  /**
   * Start the dashboard rendering
   */
  start() {
    this.isRendering = true;
    this.startTime = Date.now();

    // Hide cursor
    process.stdout.write('\x1B[?25l');

    // Clear screen and render
    this.render();

    // Update every 500ms for elapsed time
    this.renderInterval = setInterval(() => {
      if (this.isRendering) {
        this.render();
      }
    }, 500);
  }

  /**
   * Stop the dashboard rendering
   */
  stop() {
    this.isRendering = false;

    if (this.renderInterval) {
      clearInterval(this.renderInterval);
      this.renderInterval = null;
    }

    // Show cursor
    process.stdout.write('\x1B[?25h');

    // Final render
    this.render();
    console.log('\n');
  }

  /**
   * Set modules to track
   */
  setModules(modules) {
    this.modules = modules.map(m => ({
      name: typeof m === 'string' ? m : m.name,
      status: 'pending',
      time: null,
      startTime: null
    }));
  }

  /**
   * Mark module as started
   */
  startModule(moduleName) {
    this.currentModule = moduleName;
    const module = this.modules.find(m => m.name === moduleName);
    if (module) {
      module.status = 'building';
      module.startTime = Date.now();
    }
    this.addLog(`Building: ${moduleName}`);
    this.render();
  }

  /**
   * Mark module as completed
   */
  completeModule(moduleName, success = true) {
    const module = this.modules.find(m => m.name === moduleName);
    if (module) {
      module.status = success ? 'done' : 'failed';
      module.time = Date.now() - (module.startTime || this.startTime);
      this.completedModules.push(moduleName);
      this.addLog(success ? `✓ ${moduleName} complete` : `✗ ${moduleName} failed`);
    }
    this.currentModule = null;
    this.render();
  }

  /**
   * Mark module as failed
   */
  failModule(moduleName) {
    this.completeModule(moduleName, false);
  }

  /**
   * Add a log message
   */
  addLog(message) {
    this.logs.push({
      time: Date.now(),
      message
    });
    // Keep only last N logs
    if (this.logs.length > this.maxLogs) {
      this.logs.shift();
    }
  }

  /**
   * Get progress percentage
   */
  getProgress() {
    const total = this.modules.length;
    const done = this.completedModules.length;
    return total > 0 ? Math.round((done / total) * 100) : 0;
  }

  /**
   * Calculate ETA based on average module time
   */
  getETA() {
    const done = this.completedModules.length;
    const remaining = this.modules.length - done;

    if (done === 0 || remaining === 0) return null;

    const elapsed = Date.now() - this.startTime;
    const avgPerModule = elapsed / done;
    const etaMs = avgPerModule * remaining;

    return this.formatTime(etaMs);
  }

  /**
   * Format milliseconds to human readable time
   */
  formatTime(ms) {
    const seconds = Math.floor(ms / 1000);
    const minutes = Math.floor(seconds / 60);
    const secs = seconds % 60;

    if (minutes > 0) {
      return `${minutes}m ${secs}s`;
    }
    return `${secs}s`;
  }

  /**
   * Format elapsed time
   */
  formatElapsed() {
    return this.formatTime(Date.now() - this.startTime);
  }

  /**
   * Render progress bar
   */
  renderProgressBar(percent, width = 40) {
    const filled = Math.round(width * percent / 100);
    const empty = width - filled;
    return chalk.green('█'.repeat(filled)) + chalk.gray('░'.repeat(empty));
  }

  /**
   * Render module status line
   */
  renderModuleStatus(module) {
    const icons = {
      pending: chalk.gray('○'),
      building: chalk.yellow('◐'),
      done: chalk.green('✓'),
      failed: chalk.red('✗')
    };

    const icon = icons[module.status] || icons.pending;
    const name = module.status === 'building'
      ? chalk.yellow(module.name)
      : module.status === 'done'
        ? chalk.green(module.name)
        : module.status === 'failed'
          ? chalk.red(module.name)
          : chalk.gray(module.name);

    let timeStr = '';
    if (module.time) {
      timeStr = chalk.gray(this.formatTime(module.time));
    } else if (module.status === 'building') {
      timeStr = chalk.yellow('building...');
    }

    // Pad name to 16 chars, time to 12 chars
    const paddedName = name + ' '.repeat(Math.max(0, 16 - module.name.length));
    return `  ${icon} ${paddedName} ${timeStr}`;
  }

  /**
   * Main render function
   */
  render() {
    if (!this.isRendering && this.completedModules.length === 0) return;

    // Move cursor to top-left
    readline.cursorTo(process.stdout, 0, 0);
    readline.clearScreenDown(process.stdout);

    const progress = this.getProgress();
    const eta = this.getETA();
    const elapsed = this.formatElapsed();

    // Build output
    const lines = [];

    // Header
    lines.push(chalk.cyan('╭────────────────────────────────────────────────────────────────────╮'));
    lines.push(chalk.cyan('│') + `  🏗️  ${chalk.bold(this.title)}`.padEnd(76) + chalk.cyan('│'));
    lines.push(chalk.cyan('│') + ''.padEnd(68) + chalk.cyan('│'));

    // Project info
    lines.push(chalk.cyan('│') + `  Project: ${chalk.white(this.projectName)}`.padEnd(76) + chalk.cyan('│'));
    lines.push(chalk.cyan('│') + `  Mode: ${chalk.white(this.mode)}`.padEnd(76) + chalk.cyan('│'));
    lines.push(chalk.cyan('│') + ''.padEnd(68) + chalk.cyan('│'));

    // Progress bar
    const progressBar = `  [${this.renderProgressBar(progress)}] ${String(progress).padStart(3)}%`;
    lines.push(chalk.cyan('│') + progressBar.padEnd(76) + chalk.cyan('│'));
    lines.push(chalk.cyan('│') + ''.padEnd(68) + chalk.cyan('│'));

    // Module list (max 10 visible)
    const visibleModules = this.modules.slice(0, 10);
    for (const module of visibleModules) {
      const statusLine = this.renderModuleStatus(module);
      lines.push(chalk.cyan('│') + statusLine.padEnd(76) + chalk.cyan('│'));
    }

    if (this.modules.length > 10) {
      lines.push(chalk.cyan('│') + chalk.gray(`  ... and ${this.modules.length - 10} more`).padEnd(76) + chalk.cyan('│'));
    }

    lines.push(chalk.cyan('│') + ''.padEnd(68) + chalk.cyan('│'));

    // Time info
    const etaText = eta ? `~${eta} remaining` : 'calculating...';
    const timeInfo = `  Elapsed: ${chalk.white(elapsed.padEnd(10))} │  ETA: ${chalk.white(etaText)}`;
    lines.push(chalk.cyan('│') + timeInfo.padEnd(76) + chalk.cyan('│'));
    lines.push(chalk.cyan('│') + ''.padEnd(68) + chalk.cyan('│'));

    // Footer
    lines.push(chalk.cyan('╰────────────────────────────────────────────────────────────────────╯'));

    // Recent logs
    if (this.logs.length > 0) {
      lines.push('');
      lines.push(chalk.gray('  Recent:'));
      for (const log of this.logs) {
        lines.push(chalk.gray(`    ${log.message}`));
      }
    }

    process.stdout.write(lines.join('\n'));
  }
}

/**
 * Simpler inline progress bar for non-dashboard use
 */
export function renderInlineProgress(current, total, label = '') {
  const percent = Math.round((current / total) * 100);
  const width = 30;
  const filled = Math.round(width * percent / 100);
  const empty = width - filled;
  const bar = chalk.green('█'.repeat(filled)) + chalk.gray('░'.repeat(empty));

  return `[${bar}] ${percent}% ${label}`;
}

/**
 * Quick progress update (single line, overwrites previous)
 */
export function updateProgress(current, total, label = '') {
  readline.clearLine(process.stdout, 0);
  readline.cursorTo(process.stdout, 0);
  process.stdout.write(renderInlineProgress(current, total, label));
}

/**
 * Complete progress and move to next line
 */
export function completeProgress(label = 'Done') {
  readline.clearLine(process.stdout, 0);
  readline.cursorTo(process.stdout, 0);
  console.log(chalk.green(`✓ ${label}`));
}

/**
 * Simple step-by-step progress tracker
 */
export class StepProgress {
  constructor(steps, options = {}) {
    this.steps = steps;
    this.currentStep = 0;
    this.startTime = Date.now();
    this.showTime = options.showTime !== false;
  }

  next(label) {
    this.currentStep++;
    const progress = renderInlineProgress(this.currentStep, this.steps.length, label || this.steps[this.currentStep - 1]);

    readline.clearLine(process.stdout, 0);
    readline.cursorTo(process.stdout, 0);
    process.stdout.write(progress);
  }

  complete(label = 'Complete') {
    const elapsed = Date.now() - this.startTime;
    readline.clearLine(process.stdout, 0);
    readline.cursorTo(process.stdout, 0);

    if (this.showTime) {
      console.log(chalk.green(`✓ ${label} (${Math.round(elapsed / 1000)}s)`));
    } else {
      console.log(chalk.green(`✓ ${label}`));
    }
  }

  fail(label = 'Failed') {
    readline.clearLine(process.stdout, 0);
    readline.cursorTo(process.stdout, 0);
    console.log(chalk.red(`✗ ${label}`));
  }
}
