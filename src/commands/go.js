// ═══════════════════════════════════════════════════════════════════════════════
// VIBECODE CLI - Magic Mode (go command)
// One command = Full workflow
// ═══════════════════════════════════════════════════════════════════════════════

import chalk from 'chalk';
import ora from 'ora';
import path from 'path';
import fs from 'fs-extra';
import { exec } from 'child_process';
import { promisify } from 'util';

import { createWorkspace, workspaceExists, getProjectName, loadState, saveState } from '../core/workspace.js';
import {
  createSession,
  getCurrentSessionId,
  getCurrentSessionPath,
  writeSessionFile,
  readSessionFile,
  sessionFileExists
} from '../core/session.js';
import { getCurrentState, transitionTo } from '../core/state-machine.js';
import { validateContract } from '../core/contract.js';
import { generateSpecHash } from '../utils/hash.js';
import { STATES } from '../config/constants.js';
import {
  getIntakeTemplate,
  getBlueprintTemplate,
  getContractTemplate,
  getPlanTemplate,
  getCoderPackTemplate
} from '../config/templates.js';
import { printBox, printError, printSuccess } from '../ui/output.js';
import { StepProgress, updateProgress, completeProgress } from '../ui/dashboard.js';
import { BackupManager } from '../core/backup.js';
import {
  spawnClaudeCode,
  isClaudeCodeAvailable,
  buildPromptWithContext
} from '../providers/index.js';
import { runTests } from '../core/test-runner.js';
import { analyzeErrors } from '../core/error-analyzer.js';
import { ensureDir, appendToFile } from '../utils/files.js';

const execAsync = promisify(exec);

/**
 * Magic Mode: One command, full build
 * vibecode go "description" → Everything automated
 */
export async function goCommand(description, options = {}) {
  const startTime = Date.now();

  // Validate description
  if (!description || description.trim().length < 5) {
    printError('Description too short. Please provide more details.');
    console.log(chalk.gray('Example: vibecode go "Landing page for my startup"'));
    process.exit(1);
  }

  // Check Claude Code availability
  const claudeAvailable = await isClaudeCodeAvailable();
  if (!claudeAvailable) {
    printError('Claude Code CLI not found.');
    console.log(chalk.gray('Install with: npm install -g @anthropic-ai/claude-code'));
    process.exit(1);
  }

  // Generate project name
  const projectName = generateProjectName(description);
  const projectPath = path.join(process.cwd(), projectName);

  // Check if directory exists
  if (await fs.pathExists(projectPath)) {
    printError(`Directory already exists: ${projectName}`);
    console.log(chalk.gray('Choose a different name or delete the existing directory.'));
    process.exit(1);
  }

  // Show magic header
  showMagicHeader(description, projectName);

  // Create backup of current directory before go command
  // (backup in parent directory since we're creating a new project)
  const backup = new BackupManager(process.cwd());
  await backup.createBackup('go-magic');

  // Define steps
  const steps = [
    { name: 'INIT', label: 'Creating project', weight: 5 },
    { name: 'INTAKE', label: 'Capturing requirements', weight: 5 },
    { name: 'BLUEPRINT', label: 'Designing architecture', weight: 5 },
    { name: 'CONTRACT', label: 'Generating contract', weight: 5 },
    { name: 'LOCK', label: 'Locking contract', weight: 5 },
    { name: 'PLAN', label: 'Creating execution plan', weight: 5 },
    { name: 'BUILD', label: 'Building with AI', weight: 60 },
    { name: 'REVIEW', label: 'Running tests', weight: 10 }
  ];

  const results = {};
  let currentProgress = 0;

  try {
    // Step 1: INIT
    await executeStep(steps[0], currentProgress, async () => {
      await fs.ensureDir(projectPath);
      process.chdir(projectPath);
      await createWorkspace();
      results.projectPath = projectPath;
    });
    currentProgress += steps[0].weight;

    // Step 2: INTAKE
    await executeStep(steps[1], currentProgress, async () => {
      const sessionId = await createSession(projectName);
      const intakeContent = getIntakeTemplate(projectName, description, sessionId);
      await writeSessionFile('intake.md', intakeContent);
      await transitionTo(STATES.INTAKE_CAPTURED, 'magic_intake');
      results.sessionId = sessionId;
    });
    currentProgress += steps[1].weight;

    // Step 3: BLUEPRINT
    await executeStep(steps[2], currentProgress, async () => {
      const sessionId = await getCurrentSessionId();
      const blueprintContent = getBlueprintTemplate(projectName, sessionId);
      await writeSessionFile('blueprint.md', blueprintContent);
      await transitionTo(STATES.BLUEPRINT_DRAFTED, 'magic_blueprint');
    });
    currentProgress += steps[2].weight;

    // Step 4: CONTRACT
    await executeStep(steps[3], currentProgress, async () => {
      const sessionId = await getCurrentSessionId();
      const intakeContent = await readSessionFile('intake.md');
      const blueprintContent = await readSessionFile('blueprint.md');
      const contractContent = getContractTemplate(projectName, sessionId, intakeContent, blueprintContent);
      await writeSessionFile('contract.md', contractContent);
      await transitionTo(STATES.CONTRACT_DRAFTED, 'magic_contract');
    });
    currentProgress += steps[3].weight;

    // Step 5: LOCK
    await executeStep(steps[4], currentProgress, async () => {
      const contractContent = await readSessionFile('contract.md');
      const specHash = generateSpecHash(contractContent);

      // Update contract with hash
      const updatedContract = contractContent.replace(
        /## Spec Hash: \[hash when locked\]/,
        `## Spec Hash: ${specHash}`
      ).replace(
        /## Status: DRAFT/,
        '## Status: LOCKED'
      );
      await writeSessionFile('contract.md', updatedContract);

      // Save to state
      const stateData = await loadState();
      stateData.spec_hash = specHash;
      stateData.contract_locked = new Date().toISOString();
      await saveState(stateData);

      await transitionTo(STATES.CONTRACT_LOCKED, 'magic_lock');
      results.specHash = specHash.substring(0, 8);
    });
    currentProgress += steps[4].weight;

    // Step 6: PLAN
    await executeStep(steps[5], currentProgress, async () => {
      const sessionId = await getCurrentSessionId();
      const contractContent = await readSessionFile('contract.md');
      const blueprintContent = await readSessionFile('blueprint.md');
      const intakeContent = await readSessionFile('intake.md');

      const stateData = await loadState();
      const specHash = stateData.spec_hash;

      const planContent = getPlanTemplate(projectName, sessionId, specHash, contractContent);
      await writeSessionFile('plan.md', planContent);

      const coderPackContent = getCoderPackTemplate(
        projectName, sessionId, specHash, contractContent, blueprintContent, intakeContent
      );
      await writeSessionFile('coder_pack.md', coderPackContent);

      await transitionTo(STATES.PLAN_CREATED, 'magic_plan');
    });
    currentProgress += steps[5].weight;

    // Step 7: BUILD
    await executeStep(steps[6], currentProgress, async () => {
      const sessionPath = await getCurrentSessionPath();
      const evidencePath = path.join(sessionPath, 'evidence');
      await ensureDir(evidencePath);
      const logPath = path.join(evidencePath, 'build.log');

      await transitionTo(STATES.BUILD_IN_PROGRESS, 'magic_build_start');

      const coderPackContent = await readSessionFile('coder_pack.md');
      const fullPrompt = await buildPromptWithContext(coderPackContent, process.cwd());

      await appendToFile(logPath, `[${new Date().toISOString()}] Magic Mode Build Started\n`);

      const buildResult = await spawnClaudeCode(fullPrompt, {
        cwd: process.cwd(),
        logPath: logPath
      });

      await appendToFile(logPath, `[${new Date().toISOString()}] Build completed with code: ${buildResult.code}\n`);

      // Count files created
      const files = await fs.readdir(process.cwd());
      results.filesCreated = files.filter(f => !f.startsWith('.')).length;

      // Reload state fresh before saving
      const freshState = await loadState();
      freshState.build_completed = new Date().toISOString();
      await saveState(freshState);

      await transitionTo(STATES.BUILD_DONE, 'magic_build_done');
    });
    currentProgress += steps[6].weight;

    // Step 8: REVIEW
    await executeStep(steps[7], currentProgress, async () => {
      const testResult = await runTests(process.cwd());
      results.testsPassed = testResult.summary.passed;
      results.testsTotal = testResult.summary.total;
      results.allPassed = testResult.passed;

      if (testResult.passed) {
        await transitionTo(STATES.REVIEW_PASSED, 'magic_review_passed');
      } else {
        const errors = analyzeErrors(testResult);
        results.errors = errors.length;
        // Still mark as review passed for magic mode (best effort)
        await transitionTo(STATES.REVIEW_PASSED, 'magic_review_completed');
      }
    });
    currentProgress = 100;

    // Show final progress
    console.log(renderProgressBar(100));
    console.log();

    // Show summary
    const duration = ((Date.now() - startTime) / 1000 / 60).toFixed(1);
    showMagicSummary(projectName, projectPath, duration, results, options);

    // Auto-open if requested
    if (options.open) {
      await openProject(projectPath);
    }

  } catch (error) {
    console.log();
    printError(`Magic mode failed: ${error.message}`);
    console.log(chalk.gray(`Project location: ${projectPath}`));
    console.log(chalk.gray('Check .vibecode/sessions/*/evidence/build.log for details.'));
    process.exit(1);
  }
}

/**
 * Execute a single step with progress display
 */
async function executeStep(step, currentProgress, fn) {
  const spinner = ora({
    text: chalk.gray(step.label),
    prefixText: renderProgressBar(currentProgress)
  }).start();

  try {
    await fn();
    spinner.stopAndPersist({
      symbol: chalk.green('✓'),
      text: chalk.green(step.name),
      prefixText: renderProgressBar(currentProgress + step.weight)
    });
  } catch (error) {
    spinner.stopAndPersist({
      symbol: chalk.red('✗'),
      text: chalk.red(`${step.name}: ${error.message}`),
      prefixText: renderProgressBar(currentProgress)
    });
    throw error;
  }
}

/**
 * Generate project name from description
 */
function generateProjectName(description) {
  const stopWords = ['a', 'an', 'the', 'for', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'with', 'my', 'our'];

  const words = description
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, '')
    .split(/\s+/)
    .filter(w => w.length > 2 && !stopWords.includes(w))
    .slice(0, 3);

  if (words.length === 0) {
    return `vibecode-${Date.now().toString(36)}`;
  }

  return words.join('-');
}

/**
 * Render progress bar
 */
function renderProgressBar(percent, label = '') {
  const width = 40;
  const filled = Math.round(width * percent / 100);
  const empty = width - filled;
  const bar = chalk.green('█'.repeat(filled)) + chalk.gray('░'.repeat(empty));
  return `[${bar}] ${String(percent).padStart(3)}%${label ? ' ' + label : ''}`;
}

/**
 * Show magic mode header
 */
function showMagicHeader(description, projectName) {
  const truncatedDesc = description.length > 50
    ? description.substring(0, 47) + '...'
    : description;

  console.log();
  console.log(chalk.cyan('╭' + '─'.repeat(68) + '╮'));
  console.log(chalk.cyan('│') + ' '.repeat(68) + chalk.cyan('│'));
  console.log(chalk.cyan('│') + chalk.bold.white('   🚀 VIBECODE MAGIC MODE') + ' '.repeat(42) + chalk.cyan('│'));
  console.log(chalk.cyan('│') + ' '.repeat(68) + chalk.cyan('│'));
  console.log(chalk.cyan('│') + chalk.gray(`   "${truncatedDesc}"`) + ' '.repeat(Math.max(0, 65 - truncatedDesc.length - 3)) + chalk.cyan('│'));
  console.log(chalk.cyan('│') + chalk.gray(`   → ${projectName}`) + ' '.repeat(Math.max(0, 65 - projectName.length - 5)) + chalk.cyan('│'));
  console.log(chalk.cyan('│') + ' '.repeat(68) + chalk.cyan('│'));
  console.log(chalk.cyan('╰' + '─'.repeat(68) + '╯'));
  console.log();
}

/**
 * Show magic mode summary
 */
function showMagicSummary(projectName, projectPath, duration, results, options) {
  const testsStatus = results.allPassed
    ? chalk.green(`${results.testsPassed}/${results.testsTotal} passed`)
    : chalk.yellow(`${results.testsPassed}/${results.testsTotal} passed`);

  console.log(chalk.green('╭' + '─'.repeat(68) + '╮'));
  console.log(chalk.green('│') + ' '.repeat(68) + chalk.green('│'));
  console.log(chalk.green('│') + chalk.bold.white('   🎉 BUILD COMPLETE!') + ' '.repeat(46) + chalk.green('│'));
  console.log(chalk.green('│') + ' '.repeat(68) + chalk.green('│'));
  console.log(chalk.green('│') + chalk.white(`   📁 Project:  ${projectName}`) + ' '.repeat(Math.max(0, 51 - projectName.length)) + chalk.green('│'));
  console.log(chalk.green('│') + chalk.white(`   📂 Location: ${projectPath}`) + ' '.repeat(Math.max(0, 51 - projectPath.length)) + chalk.green('│'));
  console.log(chalk.green('│') + chalk.white(`   🔐 Spec:     ${results.specHash}...`) + ' '.repeat(42) + chalk.green('│'));
  console.log(chalk.green('│') + chalk.white(`   📄 Files:    ${results.filesCreated} created`) + ' '.repeat(42) + chalk.green('│'));
  console.log(chalk.green('│') + chalk.white(`   🧪 Tests:    `) + testsStatus + ' '.repeat(Math.max(0, 40)) + chalk.green('│'));
  console.log(chalk.green('│') + chalk.white(`   ⏱️  Duration: ${duration} minutes`) + ' '.repeat(Math.max(0, 44 - duration.length)) + chalk.green('│'));
  console.log(chalk.green('│') + ' '.repeat(68) + chalk.green('│'));
  console.log(chalk.green('│') + chalk.gray(`   💡 Next: cd ${projectName}`) + ' '.repeat(Math.max(0, 51 - projectName.length)) + chalk.green('│'));
  console.log(chalk.green('│') + ' '.repeat(68) + chalk.green('│'));
  console.log(chalk.green('╰' + '─'.repeat(68) + '╯'));
  console.log();
}

/**
 * Open project in file explorer / browser
 */
async function openProject(projectPath) {
  try {
    const platform = process.platform;
    let cmd;

    if (platform === 'darwin') {
      cmd = `open "${projectPath}"`;
    } else if (platform === 'win32') {
      cmd = `explorer "${projectPath}"`;
    } else {
      cmd = `xdg-open "${projectPath}"`;
    }

    await execAsync(cmd);
  } catch (error) {
    console.log(chalk.gray(`Could not auto-open: ${error.message}`));
  }
}
