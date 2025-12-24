// ═══════════════════════════════════════════════════════════════════════════════
// VIBECODE CLI - Agent Command
// Autonomous multi-module builder
// ═══════════════════════════════════════════════════════════════════════════════

import chalk from 'chalk';
import path from 'path';
import fs from 'fs-extra';

import { createAgent, loadProgress } from '../agent/index.js';
import { printError, printSuccess } from '../ui/output.js';
import { isClaudeCodeAvailable } from '../providers/index.js';

/**
 * Agent command entry point
 * vibecode agent "description" [options]
 */
export async function agentCommand(description, options = {}) {
  // Handle description as array (from commander variadic)
  const desc = Array.isArray(description) ? description.join(' ') : description;

  // Handle sub-commands that don't need Claude Code check first
  if (options.status) {
    return showAgentStatus(options);
  }

  // Check for Claude Code
  const claudeAvailable = await isClaudeCodeAvailable();
  if (!claudeAvailable) {
    printError('Claude Code CLI not found.');
    console.log(chalk.gray('Install with: npm install -g @anthropic-ai/claude-code'));
    process.exit(1);
  }

  // Handle resume
  if (options.resume) {
    return resumeCommand(options);
  }

  // Validate description for non-resume commands
  if (!desc || desc.trim().length < 5) {
    // Check if there's a session to resume
    const progress = await loadProgress(process.cwd());
    if (progress) {
      console.log(chalk.cyan('\n📦 Found existing session:'));
      console.log(chalk.white(`   Project: ${progress.projectName}`));
      console.log(chalk.white(`   Progress: ${progress.completedModules?.length || progress.currentModule}/${progress.totalModules} modules\n`));
      console.log(chalk.gray('   Resume: vibecode agent --resume'));
      console.log(chalk.gray('   Status: vibecode agent --status\n'));
      return;
    }

    printError('Description too short. Please provide more details.');
    console.log(chalk.gray('Example: vibecode agent "SaaS dashboard with auth, billing, and analytics"'));
    process.exit(1);
  }

  // Handle sub-commands
  if (options.analyze) {
    return analyzeCommand(desc, options);
  }

  if (options.report) {
    return reportCommand(options);
  }

  if (options.clear) {
    return clearCommand(options);
  }

  // Main build flow
  return buildCommand(desc, options);
}

/**
 * Main agent build command
 */
async function buildCommand(description, options) {
  // Determine project path
  let projectPath = process.cwd();

  // If --new flag, create new directory
  if (options.new) {
    const projectName = generateProjectName(description);
    projectPath = path.join(process.cwd(), projectName);

    if (await fs.pathExists(projectPath)) {
      printError(`Directory already exists: ${projectName}`);
      console.log(chalk.gray('Choose a different name or delete the existing directory.'));
      process.exit(1);
    }

    await fs.ensureDir(projectPath);
    await fs.ensureDir(path.join(projectPath, '.vibecode'));
    process.chdir(projectPath);

    console.log(chalk.gray(`Created project: ${projectName}`));
  }

  // Create and initialize agent
  const agent = createAgent({
    projectPath,
    verbose: options.verbose || false
  });

  try {
    await agent.initialize();

    // Build with options
    const buildOptions = {
      maxModuleRetries: options.maxRetries || 3,
      testAfterEachModule: !options.skipTests,
      continueOnFailure: options.continue || false
    };

    const result = await agent.build(description, buildOptions);

    // Exit with appropriate code
    if (!result.success) {
      process.exit(1);
    }

  } catch (error) {
    printError(`Agent failed: ${error.message}`);
    console.log(chalk.gray('Check .vibecode/agent/orchestrator.log for details.'));
    process.exit(1);
  }
}

/**
 * Analyze project without building
 */
async function analyzeCommand(description, options) {
  const agent = createAgent({
    projectPath: process.cwd(),
    verbose: options.verbose || false
  });

  try {
    await agent.initialize();
    const analysis = await agent.analyze(description);

    // Output JSON if requested
    if (options.json) {
      console.log(JSON.stringify(analysis, null, 2));
    }

    return analysis;

  } catch (error) {
    printError(`Analysis failed: ${error.message}`);
    process.exit(1);
  }
}

/**
 * Show agent status with resume info
 */
async function showAgentStatus(options) {
  const cwd = process.cwd();
  const progress = await loadProgress(cwd);

  if (!progress) {
    console.log(chalk.yellow('\n📭 No active agent session.\n'));
    console.log(chalk.gray('   Start new: vibecode agent "description" --new\n'));
    return;
  }

  console.log();
  console.log(chalk.cyan('╭' + '─'.repeat(68) + '╮'));
  console.log(chalk.cyan('│') + chalk.bold.white('   🤖 AGENT STATUS') + ' '.repeat(50) + chalk.cyan('│'));
  console.log(chalk.cyan('│') + ' '.repeat(68) + chalk.cyan('│'));

  const projectLine = `   Project: ${progress.projectName}`;
  console.log(chalk.cyan('│') + chalk.white(projectLine) + ' '.repeat(Math.max(0, 66 - projectLine.length)) + chalk.cyan('│'));

  const completed = progress.completedModules?.length || progress.currentModule || 0;
  const progressLine = `   Progress: ${completed}/${progress.totalModules} modules`;
  console.log(chalk.cyan('│') + chalk.white(progressLine) + ' '.repeat(Math.max(0, 66 - progressLine.length)) + chalk.cyan('│'));

  console.log(chalk.cyan('│') + ' '.repeat(68) + chalk.cyan('│'));

  // Show modules with status
  for (const mod of progress.modules || []) {
    let icon, color;
    switch (mod.status) {
      case 'done':
        icon = chalk.green('✓');
        color = chalk.green;
        break;
      case 'building':
        icon = chalk.yellow('◐');
        color = chalk.yellow;
        break;
      case 'failed':
        icon = chalk.red('✗');
        color = chalk.red;
        break;
      default:
        icon = chalk.gray('○');
        color = chalk.gray;
    }
    const modLine = `   ${icon} ${color(mod.name)}`;
    // Approximate length without ANSI codes
    const approxLen = 5 + mod.name.length;
    console.log(chalk.cyan('│') + modLine + ' '.repeat(Math.max(0, 66 - approxLen)) + chalk.cyan('│'));
  }

  if (progress.error) {
    console.log(chalk.cyan('│') + ' '.repeat(68) + chalk.cyan('│'));
    const errorLine = `   Error: ${progress.error.substring(0, 55)}`;
    console.log(chalk.cyan('│') + chalk.red(errorLine) + ' '.repeat(Math.max(0, 66 - errorLine.length)) + chalk.cyan('│'));
  }

  console.log(chalk.cyan('│') + ' '.repeat(68) + chalk.cyan('│'));

  const timeLine = `   Last updated: ${new Date(progress.lastUpdated).toLocaleString()}`;
  console.log(chalk.cyan('│') + chalk.gray(timeLine) + ' '.repeat(Math.max(0, 66 - timeLine.length)) + chalk.cyan('│'));

  console.log(chalk.cyan('│') + ' '.repeat(68) + chalk.cyan('│'));
  console.log(chalk.cyan('│') + chalk.yellow('   💡 Resume: vibecode agent --resume') + ' '.repeat(29) + chalk.cyan('│'));
  console.log(chalk.cyan('│') + ' '.repeat(68) + chalk.cyan('│'));
  console.log(chalk.cyan('╰' + '─'.repeat(68) + '╯'));
  console.log();

  // Output JSON if requested
  if (options.json) {
    console.log(JSON.stringify(progress, null, 2));
  }
}

/**
 * Resume agent from last stopped module
 */
async function resumeCommand(options) {
  const cwd = process.cwd();

  // Check for progress
  const progress = await loadProgress(cwd);
  if (!progress) {
    console.log(chalk.yellow('\n📭 No session to resume.\n'));
    console.log(chalk.gray('   Start new: vibecode agent "description" --new\n'));
    return;
  }

  // Create agent and resume
  const agent = createAgent({
    projectPath: cwd,
    verbose: options.verbose || false
  });

  try {
    // Determine from module
    const fromModule = options.from ? parseInt(options.from) - 1 : undefined;

    const resumeOptions = {
      maxModuleRetries: options.maxRetries || 3,
      testAfterEachModule: !options.skipTests,
      continueOnFailure: options.continue || false,
      fromModule
    };

    const result = await agent.resume(resumeOptions);

    // Exit with appropriate code
    if (result && !result.success) {
      process.exit(1);
    }

  } catch (error) {
    printError(`Resume failed: ${error.message}`);
    console.log(chalk.gray('Check .vibecode/agent/orchestrator.log for details.'));
    process.exit(1);
  }
}

/**
 * Legacy status command (for compatibility)
 */
async function statusCommand(options) {
  return showAgentStatus(options);
}

/**
 * Export memory report
 */
async function reportCommand(options) {
  const agent = createAgent({
    projectPath: process.cwd()
  });

  try {
    await agent.initialize();
    const report = await agent.exportReport();

    if (options.stdout) {
      console.log(report);
    }

  } catch (error) {
    printError(`Report failed: ${error.message}`);
    process.exit(1);
  }
}

/**
 * Clear agent memory
 */
async function clearCommand(options) {
  if (!options.force) {
    console.log(chalk.yellow('This will clear all agent memory.'));
    console.log(chalk.gray('Use --force to confirm.'));
    return;
  }

  const agent = createAgent({
    projectPath: process.cwd()
  });

  try {
    await agent.initialize();
    await agent.clearMemory();
    printSuccess('Agent memory cleared');

  } catch (error) {
    printError(`Clear failed: ${error.message}`);
    process.exit(1);
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
    return `vibecode-agent-${Date.now().toString(36)}`;
  }

  return words.join('-') + '-agent';
}
