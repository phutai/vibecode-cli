/**
 * File Watcher for Vibecode CLI
 * Real-time monitoring with auto-test, lint, build on file changes
 */

import chokidar from 'chokidar';
import chalk from 'chalk';
import { exec } from 'child_process';
import { promisify } from 'util';
import path from 'path';
import fs from 'fs/promises';
import readline from 'readline';
import { notify as sendNotification, notifyError, notifySuccess } from '../utils/notifications.js';

const execAsync = promisify(exec);

/**
 * Main watch command handler
 */
export async function watchCommand(options) {
  const cwd = process.cwd();
  const watchDirs = options.dir
    ? [options.dir]
    : await getDefaultWatchDirs(cwd);

  // Determine what to run
  const checks = {
    test: options.test || options.all,
    lint: options.lint || options.all,
    build: options.build,
    typecheck: options.typecheck || options.all
  };

  // If no specific checks, default to test
  if (!checks.test && !checks.lint && !checks.build && !checks.typecheck) {
    checks.test = true;
  }

  const state = {
    events: 0,
    lastRun: null,
    running: false,
    results: {
      test: null,
      lint: null,
      build: null,
      typecheck: null
    },
    errors: [],
    lastEvent: null
  };

  // Setup console UI
  console.clear();
  renderUI(state, watchDirs, checks);

  // Setup watcher
  const ignored = [
    '**/node_modules/**',
    '**/.git/**',
    '**/.next/**',
    '**/dist/**',
    '**/build/**',
    '**/.vibecode/**',
    '**/coverage/**',
    '**/*.log',
    '**/.DS_Store'
  ];

  const watcher = chokidar.watch(watchDirs, {
    ignored,
    persistent: true,
    ignoreInitial: true,
    awaitWriteFinish: {
      stabilityThreshold: 300,
      pollInterval: 100
    }
  });

  // Debounce function
  let debounceTimer = null;
  const debounce = (fn, delay = 500) => {
    return (...args) => {
      if (debounceTimer) clearTimeout(debounceTimer);
      debounceTimer = setTimeout(() => fn(...args), delay);
    };
  };

  // Run checks
  const runChecks = debounce(async (filePath, eventType) => {
    if (state.running) return;

    state.running = true;
    state.events++;
    state.lastRun = new Date();
    state.errors = [];

    const fileName = path.relative(cwd, filePath);
    state.lastEvent = `[${formatTime()}] ${eventType}: ${fileName}`;

    // Update UI
    renderUI(state, watchDirs, checks);

    // Run enabled checks
    if (checks.typecheck) {
      state.results.typecheck = await runTypecheck(cwd, state);
      renderUI(state, watchDirs, checks);
    }

    if (checks.lint) {
      state.results.lint = await runLint(cwd, state);
      renderUI(state, watchDirs, checks);
    }

    if (checks.test) {
      state.results.test = await runTest(cwd, state);
      renderUI(state, watchDirs, checks);
    }

    if (checks.build) {
      state.results.build = await runBuild(cwd, state);
      renderUI(state, watchDirs, checks);
    }

    // Notify if enabled
    if (options.notify && state.errors.length > 0) {
      notifyError(`${state.errors.length} errors found`, 'Watch Mode');
    } else if (options.notify && state.errors.length === 0) {
      notifySuccess('All checks passed!', 'Watch Mode');
    }

    state.running = false;
    renderUI(state, watchDirs, checks);
  }, 500);

  // Watch events
  watcher
    .on('change', (filePath) => runChecks(filePath, 'changed'))
    .on('add', (filePath) => runChecks(filePath, 'added'))
    .on('unlink', (filePath) => runChecks(filePath, 'deleted'));

  // Keyboard shortcuts
  setupKeyboardShortcuts(state, checks, cwd, watchDirs, watcher, runChecks);

  // Initial run
  if (options.immediate) {
    setTimeout(() => runChecks(watchDirs[0], 'initial'), 100);
  }
}

/**
 * Get default directories to watch
 */
async function getDefaultWatchDirs(cwd) {
  const dirs = [];
  const candidates = ['src', 'lib', 'app', 'pages', 'components', 'test', 'tests', '__tests__'];

  for (const dir of candidates) {
    try {
      const stat = await fs.stat(path.join(cwd, dir));
      if (stat.isDirectory()) {
        dirs.push(dir);
      }
    } catch {
      // Directory doesn't exist
    }
  }

  // If no common dirs found, watch current directory
  if (dirs.length === 0) {
    dirs.push('.');
  }

  return dirs;
}

/**
 * Run tests
 */
async function runTest(cwd, state) {
  try {
    const pkgPath = path.join(cwd, 'package.json');
    let pkg;
    try {
      pkg = JSON.parse(await fs.readFile(pkgPath, 'utf-8'));
    } catch {
      return { status: 'skip', message: 'No package.json' };
    }

    if (!pkg.scripts?.test) {
      return { status: 'skip', message: 'No test script' };
    }

    const { stdout, stderr } = await execAsync('npm test 2>&1', { cwd, timeout: 120000 });
    const output = stdout + stderr;

    // Parse test results - try different patterns
    let passed = output.match(/(\d+)\s*(?:passing|passed|pass)/i);
    let failed = output.match(/(\d+)\s*(?:failing|failed|fail)/i);

    // Jest pattern
    if (!passed) {
      const jestMatch = output.match(/Tests:\s*(\d+)\s*passed/i);
      if (jestMatch) passed = jestMatch;
    }
    if (!failed) {
      const jestFail = output.match(/Tests:\s*(\d+)\s*failed/i);
      if (jestFail) failed = jestFail;
    }

    if (failed && parseInt(failed[1]) > 0) {
      state.errors.push({ type: 'test', message: `${failed[1]} tests failed` });
      return { status: 'fail', passed: passed?.[1] || 0, failed: failed[1] };
    }

    return { status: 'pass', passed: passed?.[1] || '?', failed: 0 };
  } catch (error) {
    const output = error.stdout || error.message;
    const failed = output.match(/(\d+)\s*(?:failing|failed|fail)/i);

    if (failed) {
      state.errors.push({ type: 'test', message: `${failed[1]} tests failed` });
      return { status: 'fail', passed: 0, failed: failed[1] };
    }

    state.errors.push({ type: 'test', message: 'Tests failed' });
    return { status: 'error', message: 'Tests failed' };
  }
}

/**
 * Run lint
 */
async function runLint(cwd, state) {
  try {
    const pkgPath = path.join(cwd, 'package.json');
    let pkg;
    try {
      pkg = JSON.parse(await fs.readFile(pkgPath, 'utf-8'));
    } catch {
      return { status: 'skip', message: 'No package.json' };
    }

    if (!pkg.scripts?.lint) {
      return { status: 'skip', message: 'No lint script' };
    }

    await execAsync('npm run lint 2>&1', { cwd, timeout: 60000 });
    return { status: 'pass' };
  } catch (error) {
    const output = error.stdout || error.message || '';
    const warnings = (output.match(/warning/gi) || []).length;
    const errors = (output.match(/error(?!\s*TS)/gi) || []).length;

    if (errors > 0) {
      state.errors.push({ type: 'lint', message: `${errors} lint errors` });
      return { status: 'fail', errors, warnings };
    }

    if (warnings > 0) {
      return { status: 'warn', warnings };
    }

    state.errors.push({ type: 'lint', message: 'Lint failed' });
    return { status: 'fail', message: 'Lint failed' };
  }
}

/**
 * Run build
 */
async function runBuild(cwd, state) {
  try {
    const pkgPath = path.join(cwd, 'package.json');
    let pkg;
    try {
      pkg = JSON.parse(await fs.readFile(pkgPath, 'utf-8'));
    } catch {
      return { status: 'skip', message: 'No package.json' };
    }

    if (!pkg.scripts?.build) {
      return { status: 'skip', message: 'No build script' };
    }

    await execAsync('npm run build 2>&1', { cwd, timeout: 180000 });
    return { status: 'pass' };
  } catch (error) {
    state.errors.push({ type: 'build', message: 'Build failed' });
    return { status: 'fail', message: 'Build failed' };
  }
}

/**
 * Run TypeScript type checking
 */
async function runTypecheck(cwd, state) {
  try {
    // Check if TypeScript project
    try {
      await fs.stat(path.join(cwd, 'tsconfig.json'));
    } catch {
      return { status: 'skip', message: 'No tsconfig.json' };
    }

    await execAsync('npx tsc --noEmit 2>&1', { cwd, timeout: 120000 });
    return { status: 'pass' };
  } catch (error) {
    const output = error.stdout || error.message || '';
    const errorCount = (output.match(/error TS/gi) || []).length;

    if (errorCount > 0) {
      state.errors.push({ type: 'typecheck', message: `${errorCount} type errors` });
      return { status: 'fail', errors: errorCount };
    }

    state.errors.push({ type: 'typecheck', message: 'Type check failed' });
    return { status: 'fail', message: 'Type check failed' };
  }
}

/**
 * Render the watch UI
 */
function renderUI(state, watchDirs, checks) {
  // Move cursor to top
  readline.cursorTo(process.stdout, 0, 0);
  readline.clearScreenDown(process.stdout);

  const lines = [];
  const width = 70;

  // Header
  lines.push(chalk.cyan('+' + '-'.repeat(width) + '+'));
  lines.push(chalk.cyan('|') + '  ' + chalk.bold('VIBECODE WATCH') + ' '.repeat(width - 18) + chalk.cyan('|'));
  lines.push(chalk.cyan('|') + ' '.repeat(width) + chalk.cyan('|'));

  // Status info
  const watchInfo = `Watching: ${watchDirs.join(', ')}`.substring(0, width - 4);
  lines.push(chalk.cyan('|') + `  ${chalk.white(watchInfo)}`.padEnd(width + 9) + chalk.cyan('|'));

  const eventsInfo = `Events: ${state.events}`;
  lines.push(chalk.cyan('|') + `  ${chalk.yellow(eventsInfo)}`.padEnd(width + 9) + chalk.cyan('|'));

  const statusText = state.running ? chalk.yellow('Running...') : chalk.green('Watching');
  lines.push(chalk.cyan('|') + `  Status: ${statusText}`.padEnd(width + 9) + chalk.cyan('|'));

  lines.push(chalk.cyan('|') + ' '.repeat(width) + chalk.cyan('|'));

  // Separator
  lines.push(chalk.cyan('|') + '  ' + chalk.gray('-'.repeat(width - 4)) + '  ' + chalk.cyan('|'));

  // Results
  if (checks.typecheck) {
    const result = formatResult('TypeScript', state.results.typecheck);
    lines.push(chalk.cyan('|') + `  ${result}`.padEnd(width + 9) + chalk.cyan('|'));
  }
  if (checks.lint) {
    const result = formatResult('Lint', state.results.lint);
    lines.push(chalk.cyan('|') + `  ${result}`.padEnd(width + 9) + chalk.cyan('|'));
  }
  if (checks.test) {
    const result = formatResult('Tests', state.results.test);
    lines.push(chalk.cyan('|') + `  ${result}`.padEnd(width + 9) + chalk.cyan('|'));
  }
  if (checks.build) {
    const result = formatResult('Build', state.results.build);
    lines.push(chalk.cyan('|') + `  ${result}`.padEnd(width + 9) + chalk.cyan('|'));
  }

  lines.push(chalk.cyan('|') + ' '.repeat(width) + chalk.cyan('|'));

  // Last event
  if (state.lastEvent) {
    lines.push(chalk.cyan('|') + '  ' + chalk.gray('-'.repeat(width - 4)) + '  ' + chalk.cyan('|'));
    const eventText = state.lastEvent.substring(0, width - 4);
    lines.push(chalk.cyan('|') + `  ${chalk.gray(eventText)}`.padEnd(width + 9) + chalk.cyan('|'));
    lines.push(chalk.cyan('|') + ' '.repeat(width) + chalk.cyan('|'));
  }

  // Errors
  if (state.errors.length > 0) {
    lines.push(chalk.cyan('|') + '  ' + chalk.red('Errors:') + ' '.repeat(width - 11) + chalk.cyan('|'));
    for (const error of state.errors.slice(0, 3)) {
      const errorText = `  ${error.message}`.substring(0, width - 2);
      lines.push(chalk.cyan('|') + `  ${chalk.red('*')} ${errorText}`.padEnd(width + 9) + chalk.cyan('|'));
    }
    if (state.errors.length > 3) {
      lines.push(chalk.cyan('|') + `  ${chalk.gray(`... and ${state.errors.length - 3} more`)}`.padEnd(width + 9) + chalk.cyan('|'));
    }
    lines.push(chalk.cyan('|') + ' '.repeat(width) + chalk.cyan('|'));
  }

  // Keyboard shortcuts
  lines.push(chalk.cyan('|') + '  ' + chalk.gray('-'.repeat(width - 4)) + '  ' + chalk.cyan('|'));
  lines.push(chalk.cyan('|') + `  ${chalk.gray('[q] Quit  [t] Test  [l] Lint  [b] Build  [a] All  [r] Reset')}`.padEnd(width + 9) + chalk.cyan('|'));
  lines.push(chalk.cyan('|') + ' '.repeat(width) + chalk.cyan('|'));
  lines.push(chalk.cyan('+' + '-'.repeat(width) + '+'));

  console.log(lines.join('\n'));
}

/**
 * Format result for display
 */
function formatResult(name, result) {
  const label = name.padEnd(12);

  if (!result) {
    return `${label} ${chalk.gray('--')}`;
  }

  switch (result.status) {
    case 'pass':
      if (result.passed !== undefined) {
        return `${label} ${chalk.green('PASS')} ${chalk.gray(`(${result.passed} passed)`)}`;
      }
      return `${label} ${chalk.green('PASS')}`;

    case 'fail':
      if (result.failed !== undefined) {
        return `${label} ${chalk.red('FAIL')} ${chalk.gray(`(${result.failed} failed)`)}`;
      }
      if (result.errors !== undefined) {
        return `${label} ${chalk.red('FAIL')} ${chalk.gray(`(${result.errors} errors)`)}`;
      }
      return `${label} ${chalk.red('FAIL')}`;

    case 'warn':
      return `${label} ${chalk.yellow('WARN')} ${chalk.gray(`(${result.warnings || 0} warnings)`)}`;

    case 'skip':
      return `${label} ${chalk.gray('SKIP')} ${chalk.gray(`(${result.message || 'skipped'})`)}`;

    case 'error':
      return `${label} ${chalk.red('ERROR')}`;

    default:
      return `${label} ${chalk.gray('--')}`;
  }
}

/**
 * Format current time
 */
function formatTime() {
  return new Date().toLocaleTimeString('en-US', { hour12: false });
}

/**
 * Setup keyboard shortcuts
 */
function setupKeyboardShortcuts(state, checks, cwd, watchDirs, watcher, runChecks) {
  readline.emitKeypressEvents(process.stdin);
  if (process.stdin.isTTY) {
    process.stdin.setRawMode(true);
  }

  process.stdin.on('keypress', async (str, key) => {
    if (!key) return;

    // Quit
    if (key.name === 'q' || (key.ctrl && key.name === 'c')) {
      console.clear();
      console.log(chalk.cyan('\n  Watch stopped.\n'));
      await watcher.close();
      process.exit(0);
    }

    // Run tests
    if (key.name === 't' && !state.running) {
      state.running = true;
      state.lastEvent = `[${formatTime()}] Manual: Running tests...`;
      renderUI(state, watchDirs, checks);
      state.results.test = await runTest(cwd, state);
      state.running = false;
      renderUI(state, watchDirs, checks);
    }

    // Run lint
    if (key.name === 'l' && !state.running) {
      state.running = true;
      state.lastEvent = `[${formatTime()}] Manual: Running lint...`;
      renderUI(state, watchDirs, checks);
      state.results.lint = await runLint(cwd, state);
      state.running = false;
      renderUI(state, watchDirs, checks);
    }

    // Run build
    if (key.name === 'b' && !state.running) {
      state.running = true;
      state.lastEvent = `[${formatTime()}] Manual: Running build...`;
      renderUI(state, watchDirs, checks);
      state.results.build = await runBuild(cwd, state);
      state.running = false;
      renderUI(state, watchDirs, checks);
    }

    // Run all checks
    if (key.name === 'a' && !state.running) {
      state.running = true;
      state.errors = [];
      state.lastEvent = `[${formatTime()}] Manual: Running all checks...`;
      renderUI(state, watchDirs, checks);

      if (checks.typecheck || true) {
        state.results.typecheck = await runTypecheck(cwd, state);
        renderUI(state, watchDirs, checks);
      }
      if (checks.lint || true) {
        state.results.lint = await runLint(cwd, state);
        renderUI(state, watchDirs, checks);
      }
      if (checks.test || true) {
        state.results.test = await runTest(cwd, state);
        renderUI(state, watchDirs, checks);
      }
      if (checks.build) {
        state.results.build = await runBuild(cwd, state);
        renderUI(state, watchDirs, checks);
      }

      state.running = false;
      renderUI(state, watchDirs, checks);
    }

    // Reset
    if (key.name === 'r') {
      state.events = 0;
      state.results = { test: null, lint: null, build: null, typecheck: null };
      state.errors = [];
      state.lastEvent = `[${formatTime()}] Reset`;
      renderUI(state, watchDirs, checks);
    }
  });
}

export default watchCommand;
