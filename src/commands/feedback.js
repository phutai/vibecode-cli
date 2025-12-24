// ═══════════════════════════════════════════════════════════════════════════════
// VIBECODE CLI - Feedback Command
// Interactive feedback mode for incremental changes
// ═══════════════════════════════════════════════════════════════════════════════

import { spawn } from 'child_process';
import fs from 'fs/promises';
import path from 'path';
import chalk from 'chalk';
import readline from 'readline';
import net from 'net';
import { BackupManager } from '../core/backup.js';
import { spawnClaudeCode, buildPromptWithContext } from '../providers/index.js';

/**
 * Feedback command entry point
 */
export async function feedbackCommand(options = {}) {
  const cwd = process.cwd();

  // Check if valid project
  const isValid = await isValidProject(cwd);
  if (!isValid) {
    console.log(chalk.red(`
╭────────────────────────────────────────────────────────────────────╮
│  ❌ NOT A VALID PROJECT                                            │
│                                                                    │
│  Run this command inside a project with package.json, or use:     │
│  vibecode go "description" --feedback                              │
│                                                                    │
╰────────────────────────────────────────────────────────────────────╯
    `));
    return;
  }

  // Initialize
  const projectName = path.basename(cwd);
  const backup = new BackupManager(cwd);
  const changeHistory = [];
  let devProcess = null;
  let changeCount = 0;
  const port = parseInt(options.port) || 3000;

  console.log(chalk.cyan(`
╭────────────────────────────────────────────────────────────────────╮
│  💬 VIBECODE FEEDBACK MODE                                         │
│                                                                    │
│  Project: ${projectName.padEnd(52)}│
│                                                                    │
│  Commands:                                                         │
│    • Type your changes in natural language                         │
│    • 'undo' - Revert last change                                   │
│    • 'history' - Show change history                               │
│    • 'preview' - Open/refresh preview                              │
│    • 'status' - Show current status                                │
│    • 'files' - List recently changed files                         │
│    • 'done' or 'exit' - End session                                │
│                                                                    │
╰────────────────────────────────────────────────────────────────────╯
  `));

  // Start dev server if preview mode
  if (options.preview) {
    console.log(chalk.yellow('  🚀 Starting preview server...\n'));
    devProcess = await startDevServer(cwd, port);
    const serverReady = await waitForServer(port);

    if (serverReady) {
      await openBrowser(`http://localhost:${port}`);
      console.log(chalk.green(`  ✅ Preview ready at http://localhost:${port}\n`));
    } else {
      console.log(chalk.yellow(`  ⚠️ Server may still be starting...\n`));
    }
  }

  // Create readline interface
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
    prompt: chalk.green('feedback> ')
  });

  rl.prompt();

  rl.on('line', async (line) => {
    const input = line.trim();
    const inputLower = input.toLowerCase();

    // Exit commands
    if (inputLower === 'done' || inputLower === 'exit' || inputLower === 'quit' || inputLower === 'q') {
      await endSession(devProcess, changeCount, rl);
      return;
    }

    // Undo command
    if (inputLower === 'undo') {
      if (changeHistory.length === 0) {
        console.log(chalk.yellow('  No changes to undo.\n'));
      } else {
        const lastChange = changeHistory.pop();
        try {
          await backup.restoreBackup(lastChange.backupId);
          changeCount--;
          console.log(chalk.green(`  ↩️  Reverted: "${lastChange.description}"\n`));

          if (options.preview) {
            console.log(chalk.gray('  🔄 Preview will refresh automatically.\n'));
          }
        } catch (error) {
          console.log(chalk.red(`  ❌ Undo failed: ${error.message}\n`));
        }
      }
      rl.prompt();
      return;
    }

    // History command
    if (inputLower === 'history') {
      if (changeHistory.length === 0) {
        console.log(chalk.gray('  No changes yet.\n'));
      } else {
        console.log(chalk.cyan('\n  📜 Change History:\n'));
        changeHistory.forEach((change, i) => {
          const time = new Date(change.timestamp).toLocaleTimeString();
          console.log(chalk.gray(`  ${i + 1}. [${time}] ${change.description}`));
        });
        console.log('');
      }
      rl.prompt();
      return;
    }

    // Preview command
    if (inputLower === 'preview') {
      if (!devProcess) {
        console.log(chalk.yellow('  🚀 Starting preview server...\n'));
        devProcess = await startDevServer(cwd, port);
        await waitForServer(port);
      }
      await openBrowser(`http://localhost:${port}`);
      console.log(chalk.green(`  ✅ Preview opened at http://localhost:${port}\n`));
      rl.prompt();
      return;
    }

    // Status command
    if (inputLower === 'status') {
      console.log(chalk.cyan(`\n  📊 Session Status:`));
      console.log(chalk.gray(`  ─────────────────────────────────────`));
      console.log(chalk.white(`  Project:  ${projectName}`));
      console.log(chalk.white(`  Changes:  ${changeCount}`));
      console.log(chalk.white(`  Preview:  ${devProcess ? chalk.green('Running') : chalk.gray('Not running')}`));
      console.log(chalk.white(`  Undoable: ${changeHistory.length}`));
      console.log('');
      rl.prompt();
      return;
    }

    // Files command
    if (inputLower === 'files') {
      await showRecentFiles(cwd);
      rl.prompt();
      return;
    }

    // Help command
    if (inputLower === 'help' || inputLower === '?') {
      showHelp();
      rl.prompt();
      return;
    }

    // Clear command
    if (inputLower === 'clear') {
      console.clear();
      console.log(chalk.cyan(`  💬 Feedback Mode - ${changeCount} changes applied\n`));
      rl.prompt();
      return;
    }

    // Empty or too short input
    if (!input || input.length < 3) {
      rl.prompt();
      return;
    }

    // Process change request
    console.log(chalk.yellow('\n  🔄 Processing change...\n'));

    try {
      // Create backup before change
      const backupId = await backup.createBackup(`feedback-${changeCount + 1}`);

      // Build prompt for Claude
      const prompt = buildChangePrompt(cwd, input);

      // Build full prompt with context
      const fullPrompt = await buildPromptWithContext(prompt, cwd);

      // Execute change with Claude
      const result = await spawnClaudeCode(fullPrompt, { cwd });

      // Record change
      const description = input.substring(0, 50) + (input.length > 50 ? '...' : '');
      changeHistory.push({
        description,
        backupId,
        timestamp: new Date().toISOString(),
        files: result.filesChanged || []
      });
      changeCount++;

      console.log(chalk.green(`\n  ✅ Change #${changeCount} applied: "${description}"`));

      if (options.preview) {
        console.log(chalk.gray('  🔄 Preview refreshing...\n'));
      } else {
        console.log('');
      }

    } catch (error) {
      console.log(chalk.red(`\n  ❌ Error: ${error.message}`));
      console.log(chalk.gray('  Try rephrasing your request or be more specific.\n'));
    }

    rl.prompt();
  });

  rl.on('close', () => {
    if (devProcess) {
      devProcess.kill();
    }
    process.exit(0);
  });

  // Handle Ctrl+C
  process.on('SIGINT', async () => {
    await endSession(devProcess, changeCount, rl);
  });
}

/**
 * End feedback session
 */
async function endSession(devProcess, changeCount, rl) {
  console.log(chalk.cyan(`\n
╭────────────────────────────────────────────────────────────────────╮
│  👋 FEEDBACK SESSION ENDED                                         │
│                                                                    │
│  Total changes applied: ${String(changeCount).padEnd(38)}│
│                                                                    │
│  Your changes have been saved. Use 'vibecode undo' to rollback.   │
│                                                                    │
╰────────────────────────────────────────────────────────────────────╯
  `));

  if (devProcess) {
    devProcess.kill();
  }
  rl.close();
  process.exit(0);
}

/**
 * Build change prompt for Claude
 */
function buildChangePrompt(cwd, request) {
  return `
# Incremental Change Request

## Project: ${path.basename(cwd)}

## User Request:
${request}

## Instructions:
1. Make ONLY the requested change - nothing more, nothing less
2. Preserve ALL existing functionality and code
3. Keep changes minimal and surgically precise
4. Update any related files if absolutely necessary
5. Do NOT remove, modify, or refactor unrelated code
6. Do NOT add comments explaining changes
7. Do NOT create backup files

## Critical Rules:
- This is an INCREMENTAL change, not a rebuild
- Make the smallest possible change to fulfill the request
- Maintain exact code style and formatting of existing code
- If the request is unclear, make a reasonable interpretation
- Do NOT add extra features or "improvements"

## Apply the change now.
`;
}

/**
 * Check if directory is a valid project
 */
async function isValidProject(cwd) {
  try {
    await fs.access(path.join(cwd, 'package.json'));
    return true;
  } catch {
    return false;
  }
}

/**
 * Start development server
 */
async function startDevServer(cwd, port = 3000) {
  // Detect project type and appropriate dev command
  let devCmd = 'npm run dev';

  try {
    const pkgPath = path.join(cwd, 'package.json');
    const pkg = JSON.parse(await fs.readFile(pkgPath, 'utf-8'));
    const scripts = pkg.scripts || {};

    if (scripts.dev) {
      devCmd = 'npm run dev';
    } else if (scripts.start) {
      devCmd = 'npm run start';
    }
  } catch {}

  return new Promise((resolve) => {
    const child = spawn('sh', ['-c', devCmd], {
      cwd,
      stdio: ['ignore', 'pipe', 'pipe'],
      env: { ...process.env, PORT: String(port) },
      detached: false
    });

    child.stdout.on('data', () => {});
    child.stderr.on('data', () => {});

    // Give it time to start
    setTimeout(() => resolve(child), 2000);
  });
}

/**
 * Wait for server to be ready
 */
async function waitForServer(port, maxAttempts = 30) {
  for (let i = 0; i < maxAttempts; i++) {
    const isReady = await checkPort(port);
    if (isReady) return true;
    await sleep(500);
  }
  return false;
}

/**
 * Check if port is in use (server running)
 */
function checkPort(port) {
  return new Promise((resolve) => {
    const socket = new net.Socket();
    socket.setTimeout(500);
    socket.on('connect', () => { socket.destroy(); resolve(true); });
    socket.on('timeout', () => { socket.destroy(); resolve(false); });
    socket.on('error', () => { socket.destroy(); resolve(false); });
    socket.connect(port, '127.0.0.1');
  });
}

/**
 * Open URL in browser
 */
async function openBrowser(url) {
  try {
    const open = (await import('open')).default;
    await open(url);
  } catch {
    // Fallback
    const { exec } = await import('child_process');
    const { promisify } = await import('util');
    const execAsync = promisify(exec);

    const platform = process.platform;
    const commands = {
      darwin: `open "${url}"`,
      win32: `start "" "${url}"`,
      linux: `xdg-open "${url}"`
    };

    if (commands[platform]) {
      try {
        await execAsync(commands[platform]);
      } catch {}
    }
  }
}

/**
 * Show recently changed files
 */
async function showRecentFiles(cwd) {
  console.log(chalk.cyan('\n  📁 Recent Files:\n'));

  try {
    const { exec } = await import('child_process');
    const { promisify } = await import('util');
    const execAsync = promisify(exec);

    // Get recently modified files (last 5 minutes)
    const { stdout } = await execAsync(
      `find . -type f -mmin -5 -not -path "*/node_modules/*" -not -path "*/.git/*" -not -path "*/.next/*" -not -path "*/dist/*" 2>/dev/null | head -20`,
      { cwd }
    );

    const files = stdout.trim().split('\n').filter(f => f);

    if (files.length === 0) {
      console.log(chalk.gray('  No recently modified files.\n'));
    } else {
      files.forEach(file => {
        console.log(chalk.gray(`  ${file}`));
      });
      console.log('');
    }
  } catch {
    console.log(chalk.gray('  Could not list files.\n'));
  }
}

/**
 * Show help
 */
function showHelp() {
  console.log(chalk.cyan(`
  📖 Feedback Mode Commands:
  ─────────────────────────────────────────────────────────────────

  ${chalk.white('Natural language')}   Describe the change you want
  ${chalk.green('undo')}                Revert the last change
  ${chalk.green('history')}             Show all changes made this session
  ${chalk.green('preview')}             Open preview in browser
  ${chalk.green('status')}              Show session status
  ${chalk.green('files')}               Show recently modified files
  ${chalk.green('clear')}               Clear the screen
  ${chalk.green('done')} / ${chalk.green('exit')}        End the session

  ${chalk.gray('Examples:')}
  ${chalk.gray('> Change the header color to blue')}
  ${chalk.gray('> Add a contact form section')}
  ${chalk.gray('> Remove the pricing table')}
  ${chalk.gray('> Make the logo bigger')}
  `));
}

/**
 * Sleep helper
 */
function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Start feedback mode for use in go.js
 */
export async function startFeedbackMode(projectPath, options = {}) {
  const originalCwd = process.cwd();

  try {
    process.chdir(projectPath);
    await feedbackCommand(options);
  } finally {
    process.chdir(originalCwd);
  }
}
