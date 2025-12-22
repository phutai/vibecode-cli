// ═══════════════════════════════════════════════════════════════════════════════
// VIBECODE CLI - Build Command
// "Claude/LLM là PIPELINE, là KIẾN TRÚC SƯ"
// ═══════════════════════════════════════════════════════════════════════════════

import chalk from 'chalk';
import ora from 'ora';
import path from 'path';
import { exec } from 'child_process';
import { promisify } from 'util';
import { workspaceExists, getProjectName, loadState, saveState } from '../core/workspace.js';
import {
  getCurrentSessionId,
  getCurrentSessionPath,
  writeSessionFile,
  sessionFileExists,
  readSessionFile
} from '../core/session.js';
import { getCurrentState, transitionTo } from '../core/state-machine.js';
import { getSpecHash } from '../core/contract.js';
import { STATES } from '../config/constants.js';
import { getBuildReportTemplate } from '../config/templates.js';
import { ensureDir, pathExists, appendToFile, readMarkdown, writeJson } from '../utils/files.js';
import { printBox, printError, printSuccess, printWarning, printNextStep } from '../ui/output.js';
import { showError, inlineError } from '../ui/error-translator.js';
import { BackupManager } from '../core/backup.js';
import {
  spawnClaudeCode,
  isClaudeCodeAvailable,
  buildPromptWithContext,
  getProviderInfo
} from '../providers/index.js';
// Phase D: Iterative Build
import { runTests, formatTestResults } from '../core/test-runner.js';
import { analyzeErrors, formatErrors, createErrorSummary } from '../core/error-analyzer.js';
import { generateFixPrompt, areErrorsFixable, estimateFixComplexity } from '../core/fix-generator.js';
import {
  createIterationState,
  recordIteration,
  canContinue,
  finalizeIterationState,
  saveIterationState,
  formatIterationSummary,
  logIteration
} from '../core/iteration.js';

const execAsync = promisify(exec);

export async function buildCommand(options = {}) {
  try {
    // Check workspace
    if (!await workspaceExists()) {
      printError('No Vibecode workspace found. Run `vibecode init` first.');
      process.exit(1);
    }

    const currentState = await getCurrentState();
    const projectName = await getProjectName();
    const sessionId = await getCurrentSessionId();
    const sessionPath = await getCurrentSessionPath();
    const specHash = await getSpecHash();

    // Handle different build modes
    if (options.iterate) {
      // Phase D: Iterative Build
      await handleIterativeBuild(currentState, projectName, sessionId, sessionPath, specHash, options);
    } else if (options.auto) {
      await handleAutoBuild(currentState, projectName, sessionId, sessionPath, specHash, options);
    } else if (options.start) {
      await handleBuildStart(currentState, projectName, sessionId, sessionPath, specHash);
    } else if (options.complete) {
      await handleBuildComplete(currentState, projectName, sessionId, sessionPath, specHash);
    } else if (options.evidence) {
      await handleCaptureEvidence(currentState, sessionPath);
    } else {
      await handleBuildStatus(currentState, projectName, sessionId, sessionPath, specHash);
    }

  } catch (error) {
    showError(error, { verbose: options.verbose });
    process.exit(1);
  }
}

/**
 * Handle --auto mode: Spawn Claude Code with optimal config
 * "Contract LOCKED = License to build"
 */
async function handleAutoBuild(currentState, projectName, sessionId, sessionPath, specHash, options) {
  // Create backup before build
  const backup = new BackupManager();
  await backup.createBackup('build-auto');

  // Check state - must be PLAN_CREATED or BUILD_IN_PROGRESS or REVIEW_FAILED
  const validStates = [STATES.PLAN_CREATED, STATES.BUILD_IN_PROGRESS, STATES.REVIEW_FAILED];
  if (!validStates.includes(currentState)) {
    printError(`Cannot auto-build in state: ${currentState}`);
    console.log('Run `vibecode plan` first to create execution plan.');
    process.exit(1);
  }

  // Check if Claude Code is available
  const available = await isClaudeCodeAvailable();
  if (!available) {
    printError('Claude Code CLI not found.');
    console.log(chalk.gray('Install with: npm install -g @anthropic-ai/claude-code'));
    console.log(chalk.gray('Or use manual build: vibecode build --start'));
    process.exit(1);
  }

  // Check coder_pack.md exists
  if (!await sessionFileExists('coder_pack.md')) {
    printError('coder_pack.md not found. Run `vibecode plan` first.');
    process.exit(1);
  }

  // Setup evidence directory
  const evidencePath = path.join(sessionPath, 'evidence');
  await ensureDir(evidencePath);
  await ensureDir(path.join(evidencePath, 'screenshots'));
  const logPath = path.join(evidencePath, 'build.log');

  // Save build start time
  const stateData = await loadState();
  const startTime = new Date().toISOString();
  stateData.build_started = startTime;
  stateData.build_provider = 'claude-code';
  stateData.build_mode = 'auto';
  await saveState(stateData);

  // Transition to BUILD_IN_PROGRESS if not already
  if (currentState !== STATES.BUILD_IN_PROGRESS) {
    await transitionTo(STATES.BUILD_IN_PROGRESS, 'auto_build_started');
  }

  // Load coder pack
  const coderPackContent = await readSessionFile('coder_pack.md');

  // Build full prompt with CLAUDE.md injection if exists
  const fullPrompt = await buildPromptWithContext(coderPackContent, process.cwd());

  // Log start
  await appendToFile(logPath, `\n${'='.repeat(60)}\n`);
  await appendToFile(logPath, `AUTO BUILD STARTED: ${startTime}\n`);
  await appendToFile(logPath, `Provider: Claude Code (--dangerously-skip-permissions)\n`);
  await appendToFile(logPath, `${'='.repeat(60)}\n\n`);

  // Show starting message
  const providerInfo = getProviderInfo();

  const content = `🤖 AUTO BUILD

Project: ${projectName}
Session: ${sessionId}
Spec Hash: ${specHash}

Provider: ${providerInfo.name}
Mode: ${providerInfo.mode}

Starting AI build session...
Contract LOCKED = License to build`;

  console.log();
  printBox(content, { borderColor: 'magenta' });
  console.log();
  console.log(chalk.magenta('─'.repeat(60)));
  console.log(chalk.magenta('│ CLAUDE CODE OUTPUT'));
  console.log(chalk.magenta('─'.repeat(60)));
  console.log();

  // Spawn Claude Code
  try {
    const result = await spawnClaudeCode(fullPrompt, {
      cwd: process.cwd(),
      logPath: logPath
    });

    console.log();
    console.log(chalk.magenta('─'.repeat(60)));
    console.log();

    // Capture evidence
    await captureGitDiff(evidencePath);

    const endTime = new Date().toISOString();
    await appendToFile(logPath, `\n${'='.repeat(60)}\n`);
    await appendToFile(logPath, `AUTO BUILD COMPLETED: ${endTime}\n`);
    await appendToFile(logPath, `Exit code: ${result.code}\n`);
    await appendToFile(logPath, `${'='.repeat(60)}\n`);

    // Check evidence
    const evidence = await checkEvidence(evidencePath);

    // Generate build report
    const reportContent = getBuildReportTemplate(
      projectName,
      sessionId,
      specHash,
      startTime,
      endTime,
      evidence
    );
    await writeSessionFile('build_report.md', reportContent);

    // Update state
    stateData.build_completed = endTime;
    await saveState(stateData);

    if (result.success) {
      await transitionTo(STATES.BUILD_DONE, 'auto_build_completed');

      const duration = Math.round((new Date(endTime) - new Date(startTime)) / 1000 / 60);

      const successContent = `✅ AUTO BUILD COMPLETED

Project: ${projectName}
Duration: ${duration} minutes
Provider: Claude Code

Evidence:
${evidence.hasDiff ? '  ✅ changes.diff' : '  ⬜ changes.diff'}
${evidence.hasLog ? '  ✅ build.log' : '  ⬜ build.log'}
${evidence.screenshots > 0 ? `  ✅ ${evidence.screenshots} screenshots` : '  ⬜ No screenshots'}`;

      printBox(successContent, { borderColor: 'green' });
      printNextStep('Run `vibecode review` to validate your build');

    } else {
      printWarning(`Claude Code exited with code: ${result.code}`);
      console.log(chalk.gray('Check build.log for details.'));
      console.log(chalk.gray('Run `vibecode build --auto` to retry.'));
    }

  } catch (error) {
    await appendToFile(logPath, `\nERROR: ${error.message}\n`);
    showError(error);
    process.exit(1);
  }
}

/**
 * Handle --iterate mode: Build-Test-Fix loop
 * "Build until tests pass or max iterations reached"
 */
async function handleIterativeBuild(currentState, projectName, sessionId, sessionPath, specHash, options) {
  const maxIterations = options.max || 3;
  const strictMode = options.strict || false;

  // Create backup before iterative build
  const backup = new BackupManager();
  await backup.createBackup('build-iterate');

  // Check state - must be PLAN_CREATED or BUILD_IN_PROGRESS or REVIEW_FAILED
  const validStates = [STATES.PLAN_CREATED, STATES.BUILD_IN_PROGRESS, STATES.REVIEW_FAILED];
  if (!validStates.includes(currentState)) {
    printError(`Cannot iterate in state: ${currentState}`);
    console.log('Run `vibecode plan` first to create execution plan.');
    process.exit(1);
  }

  // Check if Claude Code is available
  const available = await isClaudeCodeAvailable();
  if (!available) {
    printError('Claude Code CLI not found.');
    console.log(chalk.gray('Install with: npm install -g @anthropic-ai/claude-code'));
    process.exit(1);
  }

  // Check coder_pack.md exists
  if (!await sessionFileExists('coder_pack.md')) {
    printError('coder_pack.md not found. Run `vibecode plan` first.');
    process.exit(1);
  }

  // Setup directories
  const evidencePath = path.join(sessionPath, 'evidence');
  await ensureDir(evidencePath);
  await ensureDir(path.join(evidencePath, 'screenshots'));
  const iterationDir = path.join(sessionPath, 'iterations');
  await ensureDir(iterationDir);
  const logPath = path.join(evidencePath, 'build.log');

  // Initialize iteration state
  let iterationState = createIterationState(sessionId, maxIterations);

  // Save initial state
  const stateData = await loadState();
  const startTime = new Date().toISOString();
  stateData.build_started = startTime;
  stateData.build_provider = 'claude-code';
  stateData.build_mode = 'iterate';
  stateData.max_iterations = maxIterations;
  await saveState(stateData);

  // Transition to BUILD_IN_PROGRESS if not already
  if (currentState !== STATES.BUILD_IN_PROGRESS) {
    await transitionTo(STATES.BUILD_IN_PROGRESS, 'iterative_build_started');
  }

  // Load coder pack
  const originalCoderPack = await readSessionFile('coder_pack.md');

  // Log start
  await appendToFile(logPath, `\n${'='.repeat(60)}\n`);
  await appendToFile(logPath, `ITERATIVE BUILD STARTED: ${startTime}\n`);
  await appendToFile(logPath, `Max Iterations: ${maxIterations}\n`);
  await appendToFile(logPath, `Strict Mode: ${strictMode}\n`);
  await appendToFile(logPath, `${'='.repeat(60)}\n\n`);

  // Show starting message
  const providerInfo = getProviderInfo();

  const content = `🔄 ITERATIVE BUILD

Project: ${projectName}
Session: ${sessionId}
Spec Hash: ${specHash}

Provider: ${providerInfo.name}
Max Iterations: ${maxIterations}
Strict Mode: ${strictMode ? 'Yes' : 'No'}

Starting build-test-fix loop...`;

  console.log();
  printBox(content, { borderColor: 'magenta' });
  console.log();

  // Build-Test-Fix Loop
  let currentPrompt = await buildPromptWithContext(originalCoderPack, process.cwd());
  let loopResult = { success: false, reason: '' };

  while (true) {
    const iteration = iterationState.currentIteration + 1;
    const iterationStart = Date.now();

    console.log(chalk.cyan(`\n${'─'.repeat(60)}`));
    console.log(chalk.cyan(`│ ITERATION ${iteration}/${maxIterations}`));
    console.log(chalk.cyan(`${'─'.repeat(60)}\n`));

    await logIteration(logPath, iteration, 'Starting iteration');

    // Step 1: Run Claude Code
    console.log(chalk.yellow('▶ Running Claude Code...'));
    console.log();

    try {
      const buildResult = await spawnClaudeCode(currentPrompt, {
        cwd: process.cwd(),
        logPath: logPath
      });

      console.log();
      await logIteration(logPath, iteration, `Claude Code exited with code: ${buildResult.code}`);

      // Capture evidence for this iteration
      await captureGitDiff(evidencePath);
      const iterEvidencePath = path.join(iterationDir, `iteration-${iteration}-diff.txt`);
      try {
        const { stdout } = await execAsync('git diff HEAD', { maxBuffer: 10 * 1024 * 1024 });
        if (stdout.trim()) {
          const fs = await import('fs-extra');
          await fs.default.writeFile(iterEvidencePath, stdout, 'utf-8');
        }
      } catch (e) { /* ignore */ }

      // Step 2: Run Tests
      console.log(chalk.yellow('▶ Running tests...'));
      const spinner = ora('Testing...').start();

      const testResult = await runTests(process.cwd());
      const iterationDuration = Date.now() - iterationStart;

      if (testResult.passed) {
        spinner.succeed('All tests passed!');

        // Record successful iteration
        iterationState = recordIteration(iterationState, {
          passed: true,
          errorCount: 0,
          errorTypes: [],
          affectedFiles: [],
          duration: iterationDuration,
          action: 'build'
        });

        // Finalize as success
        iterationState = finalizeIterationState(iterationState, 'success');
        await saveIterationState(sessionPath, iterationState);

        loopResult = { success: true, reason: 'All tests passed' };
        break;

      } else {
        spinner.fail(`Tests failed: ${testResult.summary.failed}/${testResult.summary.total}`);

        // Step 3: Analyze Errors
        const analyzedErrors = analyzeErrors(testResult);
        const summary = createErrorSummary(analyzedErrors);

        console.log();
        console.log(formatErrors(analyzedErrors));

        await logIteration(logPath, iteration, `Found ${analyzedErrors.length} errors`);

        // Save error analysis for this iteration
        await writeJson(path.join(iterationDir, `iteration-${iteration}-errors.json`), {
          iteration,
          timestamp: new Date().toISOString(),
          summary,
          errors: analyzedErrors
        });

        // Record failed iteration
        iterationState = recordIteration(iterationState, {
          passed: false,
          errorCount: analyzedErrors.length,
          errorTypes: [...new Set(analyzedErrors.map(e => e.type))],
          affectedFiles: [...new Set(analyzedErrors.filter(e => e.file).map(e => e.file))],
          duration: iterationDuration,
          action: 'build'
        });

        // Check if errors are fixable
        const fixableCheck = areErrorsFixable(analyzedErrors);
        if (!fixableCheck.fixable) {
          console.log(chalk.red(`\n⚠️  ${fixableCheck.reason}`));
          await logIteration(logPath, iteration, `Errors not fixable: ${fixableCheck.reason}`);

          iterationState = finalizeIterationState(iterationState, 'unfixable');
          await saveIterationState(sessionPath, iterationState);

          loopResult = { success: false, reason: fixableCheck.reason };
          break;
        }

        // Check if we can continue
        const continueCheck = canContinue(iterationState);
        if (!continueCheck.canContinue) {
          console.log(chalk.yellow(`\n⚠️  ${continueCheck.reason}`));
          await logIteration(logPath, iteration, continueCheck.reason);

          iterationState = finalizeIterationState(iterationState, 'max_reached');
          await saveIterationState(sessionPath, iterationState);

          loopResult = { success: false, reason: continueCheck.reason };
          break;
        }

        // Step 4: Generate Fix Prompt
        const complexity = estimateFixComplexity(analyzedErrors);
        console.log(chalk.gray(`\nFix complexity: ${complexity}`));
        console.log(chalk.yellow(`\n▶ Generating fix prompt for iteration ${iteration + 1}...`));

        currentPrompt = generateFixPrompt(analyzedErrors, originalCoderPack, iteration + 1);

        // Save fix prompt for evidence
        await writeSessionFile(`iterations/fix-prompt-${iteration + 1}.md`, currentPrompt);

        await logIteration(logPath, iteration, 'Generated fix prompt for next iteration');
      }

    } catch (error) {
      console.log('\n' + inlineError(error));
      await logIteration(logPath, iteration, `Error: ${error.message}`);

      iterationState = finalizeIterationState(iterationState, 'error');
      await saveIterationState(sessionPath, iterationState);

      loopResult = { success: false, reason: error.message };
      break;
    }
  }

  // Final Summary
  const endTime = new Date().toISOString();
  await appendToFile(logPath, `\n${'='.repeat(60)}\n`);
  await appendToFile(logPath, `ITERATIVE BUILD COMPLETED: ${endTime}\n`);
  await appendToFile(logPath, `Result: ${loopResult.success ? 'SUCCESS' : 'FAILED'}\n`);
  await appendToFile(logPath, `Iterations: ${iterationState.currentIteration}\n`);
  await appendToFile(logPath, `${'='.repeat(60)}\n`);

  // Save final iteration state
  await saveIterationState(sessionPath, iterationState);

  // Check evidence
  const evidence = await checkEvidence(evidencePath);

  // Generate build report
  const reportContent = getBuildReportTemplate(
    projectName,
    sessionId,
    specHash,
    startTime,
    endTime,
    evidence
  );
  await writeSessionFile('build_report.md', reportContent);

  // Update state - RELOAD to get current state (after BUILD_IN_PROGRESS transition)
  const finalStateData = await loadState();
  finalStateData.build_completed = endTime;
  finalStateData.iterations = iterationState.currentIteration;
  finalStateData.iteration_result = loopResult.success ? 'success' : 'failed';
  await saveState(finalStateData);

  console.log();
  console.log(chalk.cyan('─'.repeat(60)));
  console.log();

  if (loopResult.success) {
    await transitionTo(STATES.BUILD_DONE, 'iterative_build_success');

    const duration = Math.round((new Date(endTime) - new Date(startTime)) / 1000 / 60);

    const successContent = `✅ ITERATIVE BUILD SUCCESS

Project: ${projectName}
Iterations: ${iterationState.currentIteration}/${maxIterations}
Duration: ${duration} minutes
Result: All tests passed!

Evidence:
${evidence.hasDiff ? '  ✅ changes.diff' : '  ⬜ changes.diff'}
${evidence.hasLog ? '  ✅ build.log' : '  ⬜ build.log'}
  ✅ ${iterationState.currentIteration} iteration records`;

    printBox(successContent, { borderColor: 'green' });
    printNextStep('Run `vibecode review` to validate your build');

  } else {
    // Still transition to BUILD_DONE but with failure note
    await transitionTo(STATES.BUILD_DONE, 'iterative_build_completed_with_errors');

    const failContent = `⚠️  ITERATIVE BUILD INCOMPLETE

Project: ${projectName}
Iterations: ${iterationState.currentIteration}/${maxIterations}
Result: ${loopResult.reason}

Evidence saved in:
  ${iterationDir}/

Check iteration logs for details.`;

    printBox(failContent, { borderColor: 'yellow' });

    if (strictMode) {
      printError('Strict mode: Build failed with errors');
      process.exit(1);
    } else {
      console.log(chalk.gray('\nYou can:'));
      console.log(chalk.gray('  • Run `vibecode build --iterate` to try again'));
      console.log(chalk.gray('  • Run `vibecode review` to review current state'));
      console.log(chalk.gray('  • Fix errors manually and run `vibecode build --complete`'));
    }
  }
}

async function handleBuildStart(currentState, projectName, sessionId, sessionPath, specHash) {
  const spinner = ora('Starting build...').start();

  // Check state
  if (currentState !== STATES.PLAN_CREATED && currentState !== STATES.REVIEW_FAILED) {
    spinner.fail();
    printError(`Cannot start build in state: ${currentState}`);
    console.log('Run `vibecode plan` first to create execution plan.');
    process.exit(1);
  }

  // Create evidence directory
  const evidencePath = path.join(sessionPath, 'evidence');
  await ensureDir(evidencePath);
  await ensureDir(path.join(evidencePath, 'screenshots'));

  // Save build start time
  const stateData = await loadState();
  stateData.build_started = new Date().toISOString();
  await saveState(stateData);

  // Initialize build log
  const logPath = path.join(evidencePath, 'build.log');
  await appendToFile(logPath, `=== BUILD STARTED: ${stateData.build_started} ===\n`);

  // Transition state
  await transitionTo(STATES.BUILD_IN_PROGRESS, 'build_started');

  spinner.succeed('Build started!');

  const content = `🏗️ BUILD IN PROGRESS

Project: ${projectName}
Session: ${sessionId}
Spec Hash: ${specHash}
Started: ${stateData.build_started}

Evidence folder ready:
  ${evidencePath}/
  ├── build.log
  └── screenshots/`;

  console.log();
  printBox(content, { borderColor: 'yellow' });

  console.log();
  console.log(chalk.cyan('📝 While building:'));
  console.log(chalk.gray('   • Follow coder_pack.md instructions'));
  console.log(chalk.gray('   • Capture evidence with `vibecode build --evidence`'));
  console.log(chalk.gray('   • Complete with `vibecode build --complete`'));

  printNextStep('Build your deliverables and run `vibecode build --complete` when done');
}

async function handleBuildComplete(currentState, projectName, sessionId, sessionPath, specHash) {
  const spinner = ora('Completing build...').start();

  // Check state
  if (currentState !== STATES.BUILD_IN_PROGRESS) {
    spinner.fail();
    printError(`Cannot complete build in state: ${currentState}`);
    console.log('Run `vibecode build --start` first.');
    process.exit(1);
  }

  const stateData = await loadState();
  const startTime = stateData.build_started;
  const endTime = new Date().toISOString();

  // Capture final evidence
  spinner.text = 'Capturing evidence...';
  const evidencePath = path.join(sessionPath, 'evidence');
  await captureGitDiff(evidencePath);

  // Append to build log
  const logPath = path.join(evidencePath, 'build.log');
  await appendToFile(logPath, `\n=== BUILD COMPLETED: ${endTime} ===`);

  // Check evidence collected
  const evidence = await checkEvidence(evidencePath);

  // Generate build report
  spinner.text = 'Generating build report...';
  const reportContent = getBuildReportTemplate(
    projectName,
    sessionId,
    specHash,
    startTime,
    endTime,
    evidence
  );
  await writeSessionFile('build_report.md', reportContent);

  // Save end time
  stateData.build_completed = endTime;
  await saveState(stateData);

  // Transition state
  await transitionTo(STATES.BUILD_DONE, 'build_completed');

  spinner.succeed('Build completed!');

  const duration = Math.round((new Date(endTime) - new Date(startTime)) / 1000 / 60);

  const content = `✅ BUILD COMPLETED

Project: ${projectName}
Duration: ${duration} minutes
Evidence collected:
${evidence.hasDiff ? '  ✅ changes.diff' : '  ⬜ changes.diff'}
${evidence.hasLog ? '  ✅ build.log' : '  ⬜ build.log'}
${evidence.screenshots > 0 ? `  ✅ ${evidence.screenshots} screenshots` : '  ⬜ No screenshots'}`;

  console.log();
  printBox(content, { borderColor: 'green' });

  printNextStep('Run `vibecode review` to validate your build');
}

async function handleCaptureEvidence(currentState, sessionPath) {
  const spinner = ora('Capturing evidence...').start();

  if (currentState !== STATES.BUILD_IN_PROGRESS) {
    spinner.fail();
    printError('Can only capture evidence during BUILD_IN_PROGRESS state');
    process.exit(1);
  }

  const evidencePath = path.join(sessionPath, 'evidence');
  await ensureDir(evidencePath);

  // Capture git diff
  await captureGitDiff(evidencePath);

  // Append to build log
  const timestamp = new Date().toISOString();
  await appendToFile(
    path.join(evidencePath, 'build.log'),
    `\n[${timestamp}] Evidence snapshot captured\n`
  );

  spinner.succeed('Evidence captured!');

  const evidence = await checkEvidence(evidencePath);
  console.log();
  console.log(chalk.cyan('📁 Evidence collected:'));
  console.log(chalk.gray(`   ${evidence.hasDiff ? '✅' : '⬜'} changes.diff`));
  console.log(chalk.gray(`   ${evidence.hasLog ? '✅' : '⬜'} build.log`));
  console.log(chalk.gray(`   ${evidence.screenshots > 0 ? `✅ ${evidence.screenshots}` : '⬜ 0'} screenshots`));
}

async function handleBuildStatus(currentState, projectName, sessionId, sessionPath, specHash) {
  if (currentState === STATES.BUILD_IN_PROGRESS) {
    const stateData = await loadState();
    const evidencePath = path.join(sessionPath, 'evidence');
    const evidence = await checkEvidence(evidencePath);

    const elapsed = Math.round((new Date() - new Date(stateData.build_started)) / 1000 / 60);

    const content = `🏗️ BUILD IN PROGRESS

Project: ${projectName}
Session: ${sessionId}
Started: ${stateData.build_started}
Elapsed: ${elapsed} minutes

Evidence:
${evidence.hasDiff ? '  ✅ changes.diff' : '  ⬜ changes.diff'}
${evidence.hasLog ? '  ✅ build.log' : '  ⬜ build.log'}
${evidence.screenshots > 0 ? `  ✅ ${evidence.screenshots} screenshots` : '  ⬜ No screenshots'}`;

    console.log();
    printBox(content, { borderColor: 'yellow' });

    console.log();
    console.log(chalk.cyan('Commands:'));
    console.log(chalk.gray('   --evidence  Capture current git diff'));
    console.log(chalk.gray('   --complete  Mark build as done'));

  } else if (currentState === STATES.BUILD_DONE) {
    printSuccess('Build already completed!');
    printNextStep('Run `vibecode review` to validate');

  } else {
    printWarning(`Current state: ${currentState}`);
    console.log('Run `vibecode build --start` to begin building.');
  }
}

async function captureGitDiff(evidencePath) {
  try {
    const { stdout } = await execAsync('git diff HEAD', { maxBuffer: 10 * 1024 * 1024 });
    const diffPath = path.join(evidencePath, 'changes.diff');

    if (stdout.trim()) {
      const fs = await import('fs-extra');
      await fs.default.writeFile(diffPath, stdout, 'utf-8');
    } else {
      // Try staged changes
      const { stdout: stagedDiff } = await execAsync('git diff --cached', { maxBuffer: 10 * 1024 * 1024 });
      if (stagedDiff.trim()) {
        const fs = await import('fs-extra');
        await fs.default.writeFile(diffPath, stagedDiff, 'utf-8');
      }
    }
  } catch (error) {
    // Git might not be available, that's okay
  }
}

async function checkEvidence(evidencePath) {
  const result = {
    hasDiff: false,
    hasLog: false,
    screenshots: 0,
    filesChanged: 0,
    linesAdded: 0,
    linesRemoved: 0
  };

  try {
    result.hasDiff = await pathExists(path.join(evidencePath, 'changes.diff'));
    result.hasLog = await pathExists(path.join(evidencePath, 'build.log'));

    const screenshotsPath = path.join(evidencePath, 'screenshots');
    if (await pathExists(screenshotsPath)) {
      const fs = await import('fs-extra');
      const files = await fs.default.readdir(screenshotsPath);
      result.screenshots = files.filter(f => /\.(png|jpg|jpeg|gif)$/i.test(f)).length;
    }

    // Parse git diff stats
    if (result.hasDiff) {
      try {
        const { stdout } = await execAsync('git diff --stat HEAD');
        const statsLine = stdout.split('\n').pop();
        const match = statsLine?.match(/(\d+) files? changed(?:, (\d+) insertions?)?(?:, (\d+) deletions?)?/);
        if (match) {
          result.filesChanged = parseInt(match[1]) || 0;
          result.linesAdded = parseInt(match[2]) || 0;
          result.linesRemoved = parseInt(match[3]) || 0;
        }
      } catch (e) {
        // Ignore git errors
      }
    }
  } catch (error) {
    // Ignore errors
  }

  return result;
}
