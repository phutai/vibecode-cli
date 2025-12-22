// ═══════════════════════════════════════════════════════════════════════════════
// VIBECODE CLI - Agent Command
// Autonomous multi-module builder
// ═══════════════════════════════════════════════════════════════════════════════

import chalk from 'chalk';
import path from 'path';
import fs from 'fs-extra';

import { createAgent } from '../agent/index.js';
import { printError, printSuccess } from '../ui/output.js';
import { isClaudeCodeAvailable } from '../providers/index.js';

/**
 * Agent command entry point
 * vibecode agent "description" [options]
 */
export async function agentCommand(description, options = {}) {
  // Check for Claude Code
  const claudeAvailable = await isClaudeCodeAvailable();
  if (!claudeAvailable) {
    printError('Claude Code CLI not found.');
    console.log(chalk.gray('Install with: npm install -g @anthropic-ai/claude-code'));
    process.exit(1);
  }

  // Validate description
  if (!description || description.trim().length < 5) {
    printError('Description too short. Please provide more details.');
    console.log(chalk.gray('Example: vibecode agent "SaaS dashboard with auth, billing, and analytics"'));
    process.exit(1);
  }

  // Handle sub-commands
  if (options.analyze) {
    return analyzeCommand(description, options);
  }

  if (options.status) {
    return statusCommand(options);
  }

  if (options.report) {
    return reportCommand(options);
  }

  if (options.clear) {
    return clearCommand(options);
  }

  // Main build flow
  return buildCommand(description, options);
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
 * Show agent status
 */
async function statusCommand(options) {
  const agent = createAgent({
    projectPath: process.cwd()
  });

  try {
    await agent.initialize();
    const status = agent.getStatus();

    console.log();
    console.log(chalk.cyan('Agent Status'));
    console.log(chalk.gray('─'.repeat(40)));
    console.log();

    console.log(`  Initialized:  ${status.initialized ? chalk.green('Yes') : chalk.red('No')}`);
    console.log(`  Project:      ${status.projectPath}`);

    if (status.memoryStats) {
      console.log();
      console.log(chalk.cyan('Memory Stats'));
      console.log(chalk.gray('─'.repeat(40)));
      console.log(`  Modules:      ${status.memoryStats.modulesCompleted}/${status.memoryStats.modulesTotal} completed`);
      console.log(`  Decisions:    ${status.memoryStats.decisionsCount}`);
      console.log(`  Patterns:     ${status.memoryStats.patternsCount}`);
      console.log(`  Errors:       ${status.memoryStats.errorsFixed}/${status.memoryStats.errorsTotal} fixed`);
      console.log(`  Files:        ${status.memoryStats.filesCreated}`);
    }

    if (status.healingStats) {
      console.log();
      console.log(chalk.cyan('Self-Healing Stats'));
      console.log(chalk.gray('─'.repeat(40)));
      console.log(`  Attempts:     ${status.healingStats.total}`);
      console.log(`  Success:      ${status.healingStats.successful}`);
      console.log(`  Failed:       ${status.healingStats.failed}`);
      console.log(`  Rate:         ${status.healingStats.successRate}`);
    }

    console.log();

    // Output JSON if requested
    if (options.json) {
      console.log(JSON.stringify(status, null, 2));
    }

  } catch (error) {
    printError(`Status failed: ${error.message}`);
    process.exit(1);
  }
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
