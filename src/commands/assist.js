// ═══════════════════════════════════════════════════════════════════════════════
// VIBECODE CLI - Assist Command
// AI Expert Mode - Direct Claude Code Access with Full Project Context
// "User NEVER bế tắc" - The Ultimate Escape Hatch
// ═══════════════════════════════════════════════════════════════════════════════

import { spawn } from 'child_process';
import readline from 'readline';
import chalk from 'chalk';
import path from 'path';
import fs from 'fs-extra';
import os from 'os';

/**
 * Assist Command - AI Expert Mode
 *
 * Usage:
 *   vibecode assist                    - Interactive mode
 *   vibecode assist "fix the error"   - One-shot with prompt
 *   vibecode expert "help me debug"   - Alias
 */
export async function assistCommand(initialPrompt = [], options = {}) {
  const projectPath = process.cwd();

  // Render welcome header
  console.log(renderHeader());

  // Gather all context
  const context = await gatherContext(projectPath);
  console.log(renderContextSummary(context));

  // If initial prompt provided, run once
  if (initialPrompt && initialPrompt.length > 0) {
    const prompt = initialPrompt.join(' ');
    await runClaudeCode(prompt, context, projectPath, options);
    return;
  }

  // Interactive mode
  await interactiveAssist(context, projectPath, options);
}

/**
 * Gather all available project context
 */
async function gatherContext(projectPath) {
  const context = {
    project: path.basename(projectPath),
    cwd: projectPath,
    state: null,
    memory: null,
    debugHistory: null,
    claudeMd: null,
    packageJson: null,
    files: [],
    gitBranch: null
  };

  // Load vibecode state
  try {
    const statePath = path.join(projectPath, '.vibecode', 'state.json');
    if (await fs.pathExists(statePath)) {
      context.state = await fs.readJson(statePath);
    }
  } catch {}

  // Load agent memory
  try {
    const memoryPath = path.join(projectPath, '.vibecode', 'agent', 'memory.json');
    if (await fs.pathExists(memoryPath)) {
      context.memory = await fs.readJson(memoryPath);
    }
  } catch {}

  // Load debug history
  try {
    const fixesPath = path.join(projectPath, '.vibecode', 'debug', 'fixes.md');
    if (await fs.pathExists(fixesPath)) {
      context.debugHistory = await fs.readFile(fixesPath, 'utf-8');
    }
  } catch {}

  // Load CLAUDE.md
  try {
    const claudeMdPath = path.join(projectPath, 'CLAUDE.md');
    if (await fs.pathExists(claudeMdPath)) {
      context.claudeMd = await fs.readFile(claudeMdPath, 'utf-8');
    }
  } catch {}

  // Load package.json
  try {
    const pkgPath = path.join(projectPath, 'package.json');
    if (await fs.pathExists(pkgPath)) {
      context.packageJson = await fs.readJson(pkgPath);
    }
  } catch {}

  // List project files
  try {
    const files = await fs.readdir(projectPath);
    context.files = files.filter(f =>
      !f.startsWith('.') &&
      f !== 'node_modules' &&
      f !== 'dist' &&
      f !== 'build'
    ).slice(0, 25);
  } catch {}

  // Get git branch
  try {
    const { execSync } = await import('child_process');
    context.gitBranch = execSync('git branch --show-current', {
      cwd: projectPath,
      encoding: 'utf-8'
    }).trim();
  } catch {}

  return context;
}

/**
 * Build context prompt for Claude Code
 */
function buildContextPrompt(context) {
  const parts = [];

  parts.push(`# VIBECODE PROJECT CONTEXT`);
  parts.push('');
  parts.push(`## Project: ${context.project}`);
  parts.push(`## Path: ${context.cwd}`);
  if (context.gitBranch) {
    parts.push(`## Branch: ${context.gitBranch}`);
  }
  parts.push('');

  // CLAUDE.md rules
  if (context.claudeMd) {
    parts.push('## Project Rules (CLAUDE.md)');
    parts.push(context.claudeMd.substring(0, 2000));
    parts.push('');
  }

  // Vibecode state
  if (context.state) {
    parts.push('## Vibecode State');
    parts.push(`- Current State: ${context.state.current_state || 'unknown'}`);
    parts.push(`- Session: ${context.state.session_id || 'none'}`);
    if (context.state.build_started) {
      parts.push(`- Build Started: ${context.state.build_started}`);
    }
    parts.push('');
  }

  // Agent memory
  if (context.memory) {
    parts.push('## Agent Memory');
    if (context.memory.decisions?.length) {
      parts.push(`### Decisions (${context.memory.decisions.length})`);
      context.memory.decisions.slice(-5).forEach(d => {
        parts.push(`- ${d.decision}: ${d.rationale?.substring(0, 100) || ''}`);
      });
    }
    if (context.memory.learnings?.length) {
      parts.push(`### Learnings (${context.memory.learnings.length})`);
      context.memory.learnings.slice(-5).forEach(l => {
        parts.push(`- ${l.description?.substring(0, 100) || l}`);
      });
    }
    if (context.memory.moduleStates) {
      const completed = Object.entries(context.memory.moduleStates)
        .filter(([_, v]) => v.status === 'completed')
        .map(([k, _]) => k);
      const failed = Object.entries(context.memory.moduleStates)
        .filter(([_, v]) => v.status === 'failed')
        .map(([k, _]) => k);
      if (completed.length) parts.push(`### Completed Modules: ${completed.join(', ')}`);
      if (failed.length) parts.push(`### Failed Modules: ${failed.join(', ')}`);
    }
    parts.push('');
  }

  // Debug history (condensed)
  if (context.debugHistory) {
    parts.push('## Recent Debug Attempts');
    // Take last 1000 chars of debug history
    const condensed = context.debugHistory.slice(-1000);
    parts.push(condensed);
    parts.push('');
  }

  // Package info
  if (context.packageJson) {
    parts.push('## Package');
    parts.push(`- Name: ${context.packageJson.name || 'unknown'}`);
    if (context.packageJson.scripts) {
      parts.push(`- Scripts: ${Object.keys(context.packageJson.scripts).join(', ')}`);
    }
    parts.push('');
  }

  // Project files
  if (context.files.length > 0) {
    parts.push('## Project Files');
    parts.push(context.files.join(', '));
    parts.push('');
  }

  parts.push('---');
  parts.push('');
  parts.push('You have full access to this project. Help the user with whatever they need.');
  parts.push('Use --dangerously-skip-permissions mode - you can modify files directly.');
  parts.push('');

  return parts.join('\n');
}

/**
 * Run Claude Code with prompt
 */
async function runClaudeCode(prompt, context, projectPath, options) {
  // Build full prompt with context
  let fullPrompt;
  if (options.noContext) {
    fullPrompt = prompt;
  } else {
    const contextPrompt = buildContextPrompt(context);
    fullPrompt = `${contextPrompt}\n## USER REQUEST:\n${prompt}`;
  }

  // Write to temp file
  const tempFile = path.join(os.tmpdir(), `vibecode-summon-${Date.now()}.md`);
  await fs.writeFile(tempFile, fullPrompt);

  // Also save to project for reference
  const summonDir = path.join(projectPath, '.vibecode', 'summon');
  await fs.ensureDir(summonDir);
  await fs.writeFile(path.join(summonDir, 'last-prompt.md'), fullPrompt);

  return new Promise((resolve, reject) => {
    console.log(chalk.blue('\n🤝 AI Assist responding...\n'));
    console.log(chalk.gray('─'.repeat(60)));
    console.log();

    const claude = spawn('claude', [
      '--dangerously-skip-permissions',
      '--print',
      '-p', tempFile
    ], {
      cwd: projectPath,
      stdio: ['inherit', 'inherit', 'inherit']
    });

    claude.on('close', async (code) => {
      console.log();
      console.log(chalk.gray('─'.repeat(60)));
      console.log(chalk.green('\n✓ Claude Code finished\n'));

      // Cleanup temp file
      await fs.remove(tempFile).catch(() => {});

      resolve(code);
    });

    claude.on('error', async (err) => {
      console.log(chalk.red(`\nError: ${err.message}`));
      await fs.remove(tempFile).catch(() => {});
      reject(err);
    });
  });
}

/**
 * Interactive assist REPL
 */
async function interactiveAssist(context, projectPath, options) {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
    prompt: chalk.blue('assist> ')
  });

  console.log(chalk.cyan(`
  Commands:
  • Type any request → Claude Code responds
  • /context  - Show injected context
  • /refresh  - Reload project context
  • /back     - Return to vibecode
  • /quit     - Exit
  `));

  rl.prompt();

  rl.on('line', async (line) => {
    const input = line.trim();

    if (!input) {
      rl.prompt();
      return;
    }

    // Handle commands
    if (input === '/back' || input === '/quit' || input === '/exit' || input === '/q') {
      console.log(chalk.blue('\n👋 AI Assist session ended.\n'));
      rl.close();
      return;
    }

    if (input === '/context') {
      console.log(chalk.gray('\n' + buildContextPrompt(context) + '\n'));
      rl.prompt();
      return;
    }

    if (input === '/refresh') {
      context = await gatherContext(projectPath);
      console.log(chalk.green('\n✓ Context refreshed\n'));
      console.log(renderContextSummary(context));
      rl.prompt();
      return;
    }

    if (input === '/help') {
      console.log(chalk.cyan(`
  🤝 VIBECODE ASSIST - Help

  AI Expert Mode with full project context.
  Everything you type will be sent to Claude Code.

  Commands:
    /context   Show the context being injected
    /refresh   Reload project context (state, memory, etc.)
    /back      Return to normal vibecode
    /quit      Exit assist mode
    /help      Show this help

  Tips:
    • Be specific: "Fix the type error in prisma/seed.ts line 54"
    • Reference files: "Look at src/app/api/auth and fix the session issue"
    • Ask questions: "Why is this component not rendering?"
      `));
      rl.prompt();
      return;
    }

    // Run Claude Code with the input
    try {
      await runClaudeCode(input, context, projectPath, options);
    } catch (error) {
      console.log(chalk.red(`Error: ${error.message}`));
    }

    rl.prompt();
  });

  rl.on('close', () => {
    process.exit(0);
  });
}

/**
 * Render welcome header
 */
function renderHeader() {
  return chalk.blue(`
╭────────────────────────────────────────────────────────────────────╮
│                                                                    │
│   🤝 VIBECODE ASSIST                                               │
│   AI Expert Mode - Direct Claude Code Access                       │
│                                                                    │
│   Full project context injected automatically.                     │
│   Claude Code has permission to modify files.                      │
│                                                                    │
╰────────────────────────────────────────────────────────────────────╯
  `);
}

/**
 * Render context summary
 */
function renderContextSummary(context) {
  const items = [];
  items.push(`  Project: ${context.project}`);

  if (context.state) {
    items.push(`  State: ${context.state.current_state || 'unknown'}`);
  }

  if (context.memory) {
    const decisions = context.memory.decisions?.length || 0;
    const learnings = context.memory.learnings?.length || 0;
    items.push(`  Memory: ${decisions} decisions, ${learnings} learnings`);
  }

  if (context.debugHistory) {
    items.push(`  Debug history: available`);
  }

  if (context.claudeMd) {
    items.push(`  CLAUDE.md: loaded`);
  }

  items.push(`  Files: ${context.files.length} visible`);

  if (context.gitBranch) {
    items.push(`  Branch: ${context.gitBranch}`);
  }

  return chalk.gray(`
  Context loaded:
${items.join('\n')}
  `);
}
