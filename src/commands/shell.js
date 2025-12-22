/**
 * Shell Mode for Vibecode CLI
 * Interactive command shell with vibecode context and AI assistance
 */

import readline from 'readline';
import chalk from 'chalk';
import { exec, spawn } from 'child_process';
import { promisify } from 'util';
import path from 'path';
import fs from 'fs/promises';

const execAsync = promisify(exec);

/**
 * Main shell command handler
 */
export async function shellCommand(options) {
  const cwd = process.cwd();
  const projectInfo = await getProjectInfo(cwd);
  const history = [];
  let historyIndex = -1;

  // Render header
  console.log(renderHeader(projectInfo));

  // Setup readline with custom prompt
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
    prompt: chalk.green('vibe$ '),
    historySize: 100,
    terminal: true
  });

  // Custom completer
  rl.on('line', async (line) => {
    const input = line.trim();

    if (!input) {
      rl.prompt();
      return;
    }

    // Add to history
    history.push(input);
    historyIndex = history.length;

    try {
      const shouldContinue = await processCommand(input, cwd, projectInfo, history, rl);
      if (shouldContinue === false) {
        return; // Exit was called
      }
    } catch (error) {
      console.log(chalk.red(`\n  Error: ${error.message}\n`));
    }

    rl.prompt();
  });

  rl.on('close', () => {
    console.log(chalk.cyan('\n  Shell closed.\n'));
    process.exit(0);
  });

  // Handle SIGINT (Ctrl+C)
  rl.on('SIGINT', () => {
    console.log(chalk.gray('\n  (Use "exit" to quit)\n'));
    rl.prompt();
  });

  rl.prompt();
}

/**
 * Get project information for context
 */
async function getProjectInfo(cwd) {
  const info = {
    name: path.basename(cwd),
    type: 'Unknown',
    framework: null,
    hasGit: false,
    branch: null,
    hasVibecode: false
  };

  try {
    // Check package.json
    const pkgPath = path.join(cwd, 'package.json');
    const pkg = JSON.parse(await fs.readFile(pkgPath, 'utf-8'));

    info.name = pkg.name || info.name;

    // Detect framework/type
    const deps = { ...pkg.dependencies, ...pkg.devDependencies };

    if (deps.next) {
      info.type = 'Next.js';
      info.framework = 'next';
    } else if (deps.react) {
      info.type = 'React';
      info.framework = 'react';
    } else if (deps.vue) {
      info.type = 'Vue';
      info.framework = 'vue';
    } else if (deps.express) {
      info.type = 'Express';
      info.framework = 'express';
    } else if (deps.fastify) {
      info.type = 'Fastify';
      info.framework = 'fastify';
    } else if (deps.typescript) {
      info.type = 'TypeScript';
    } else if (pkg.main || pkg.bin) {
      info.type = 'Node.js';
    }

    // Add prisma indicator
    if (deps['@prisma/client'] || deps.prisma) {
      info.type += ' + Prisma';
    }
  } catch {
    // No package.json
  }

  try {
    // Check git
    await execAsync('git rev-parse --git-dir', { cwd });
    info.hasGit = true;

    const { stdout } = await execAsync('git branch --show-current', { cwd });
    info.branch = stdout.trim() || 'HEAD';
  } catch {
    // Not a git repo
  }

  try {
    // Check vibecode
    await fs.stat(path.join(cwd, '.vibecode'));
    info.hasVibecode = true;
  } catch {
    // No vibecode
  }

  return info;
}

/**
 * Render the shell header
 */
function renderHeader(projectInfo) {
  const gitInfo = projectInfo.hasGit
    ? chalk.gray(` [${projectInfo.branch}]`)
    : '';

  const vibeInfo = projectInfo.hasVibecode
    ? chalk.green(' [vibecode]')
    : '';

  return chalk.cyan(`
+----------------------------------------------------------------------+
|  VIBECODE SHELL                                                      |
|                                                                      |
|  Project: ${chalk.white(projectInfo.name.padEnd(52))}|${gitInfo}${vibeInfo}
|  Type: ${chalk.white(projectInfo.type.padEnd(55))}|
|                                                                      |
|  ${chalk.gray('Prefixes:')}                                                        |
|  ${chalk.yellow('@')}${chalk.gray('<cmd>')}   ${chalk.gray('Vibecode command (e.g., @status, @git)')}                 |
|  ${chalk.yellow('?')}${chalk.gray('<query>')} ${chalk.gray('Ask AI (e.g., ?explain auth)')}                           |
|  ${chalk.yellow('!')}${chalk.gray('<cmd>')}   ${chalk.gray('Force raw execution')}                                    |
|  ${chalk.yellow('!!')}       ${chalk.gray('Repeat last command')}                                    |
|                                                                      |
+----------------------------------------------------------------------+
  `);
}

/**
 * Process a command input
 */
async function processCommand(input, cwd, projectInfo, history, rl) {
  // Built-in commands
  if (input === 'exit' || input === 'quit' || input === 'q') {
    rl.close();
    return false;
  }

  if (input === 'clear' || input === 'cls') {
    console.clear();
    console.log(renderHeader(projectInfo));
    return true;
  }

  if (input === 'history' || input === 'hist') {
    console.log(chalk.cyan('\n  Command history:\n'));
    const start = Math.max(0, history.length - 20);
    history.slice(start, -1).forEach((cmd, i) => {
      console.log(chalk.gray(`  ${start + i + 1}. ${cmd}`));
    });
    console.log('');
    return true;
  }

  if (input === 'help' || input === 'h') {
    showHelp();
    return true;
  }

  if (input === 'pwd') {
    console.log(chalk.white(`\n  ${cwd}\n`));
    return true;
  }

  if (input === 'info') {
    showProjectInfo(projectInfo, cwd);
    return true;
  }

  // Repeat last command (!!)
  if (input === '!!') {
    if (history.length < 2) {
      console.log(chalk.yellow('\n  No previous command.\n'));
      return true;
    }
    const lastCmd = history[history.length - 2];
    console.log(chalk.gray(`  Repeating: ${lastCmd}\n`));
    return processCommand(lastCmd, cwd, projectInfo, history, rl);
  }

  // History expansion (!n)
  const histMatch = input.match(/^!(\d+)$/);
  if (histMatch) {
    const index = parseInt(histMatch[1]) - 1;
    if (index >= 0 && index < history.length - 1) {
      const cmd = history[index];
      console.log(chalk.gray(`  Repeating: ${cmd}\n`));
      return processCommand(cmd, cwd, projectInfo, history, rl);
    }
    console.log(chalk.yellow('\n  Invalid history index.\n'));
    return true;
  }

  // Vibecode commands (@)
  if (input.startsWith('@')) {
    await runVibecodeCommand(input.slice(1), cwd);
    return true;
  }

  // AI queries (?)
  if (input.startsWith('?')) {
    await runAIQuery(input.slice(1), cwd, projectInfo);
    return true;
  }

  // Force raw execution (!)
  if (input.startsWith('!') && !input.startsWith('!!')) {
    await runRawCommand(input.slice(1), cwd);
    return true;
  }

  // cd command (special handling)
  if (input.startsWith('cd ')) {
    const dir = input.slice(3).trim();
    try {
      const newPath = path.resolve(cwd, dir);
      await fs.stat(newPath);
      process.chdir(newPath);
      console.log(chalk.gray(`\n  Changed to: ${newPath}\n`));
    } catch {
      console.log(chalk.red(`\n  Directory not found: ${dir}\n`));
    }
    return true;
  }

  // Normal shell command
  await runShellCommand(input, cwd);
  return true;
}

/**
 * Run a vibecode command
 */
async function runVibecodeCommand(cmd, cwd) {
  const parts = cmd.trim().split(/\s+/);
  const command = parts[0];
  const args = parts.slice(1);

  if (!command) {
    console.log(chalk.yellow('\n  Usage: @<command> [args]\n'));
    return;
  }

  console.log(chalk.cyan(`\n  Running: vibecode ${cmd}\n`));

  // Map aliases
  const aliases = {
    's': 'status',
    'g': 'git',
    'd': 'debug',
    'b': 'build',
    'w': 'watch',
    'a': 'assist'
  };

  const vibeCmd = aliases[command] || command;

  return new Promise((resolve) => {
    const child = spawn('vibecode', [vibeCmd, ...args], {
      cwd,
      stdio: 'inherit',
      shell: true
    });

    child.on('close', (code) => {
      console.log('');
      resolve();
    });

    child.on('error', (error) => {
      console.log(chalk.red(`\n  Error: ${error.message}\n`));
      resolve();
    });
  });
}

/**
 * Run an AI query using Claude
 */
async function runAIQuery(query, cwd, projectInfo) {
  if (!query.trim()) {
    console.log(chalk.yellow('\n  Usage: ?<your question>\n'));
    return;
  }

  console.log(chalk.cyan(`\n  AI Query: "${query}"\n`));

  // Build context
  const context = `Project: ${projectInfo.name} (${projectInfo.type})
Directory: ${cwd}
Question: ${query}

Please provide a helpful, concise answer.`;

  return new Promise((resolve) => {
    // Try using claude CLI directly
    const child = spawn('claude', ['-p', context], {
      cwd,
      stdio: 'inherit',
      shell: true
    });

    child.on('close', (code) => {
      console.log('');
      resolve();
    });

    child.on('error', () => {
      // Fallback: suggest using vibecode assist
      console.log(chalk.yellow('  Claude CLI not available.'));
      console.log(chalk.gray('  Try: vibecode assist "' + query + '"\n'));
      resolve();
    });
  });
}

/**
 * Run a raw shell command (force mode)
 */
async function runRawCommand(cmd, cwd) {
  if (!cmd.trim()) {
    console.log(chalk.yellow('\n  Usage: !<command>\n'));
    return;
  }

  return new Promise((resolve) => {
    console.log('');

    const child = spawn(cmd, [], {
      cwd,
      stdio: 'inherit',
      shell: true
    });

    child.on('close', (code) => {
      console.log('');
      resolve();
    });

    child.on('error', (error) => {
      console.log(chalk.red(`\n  Error: ${error.message}\n`));
      resolve();
    });
  });
}

/**
 * Run a normal shell command
 */
async function runShellCommand(cmd, cwd) {
  return new Promise((resolve) => {
    console.log('');

    const child = spawn(cmd, [], {
      cwd,
      stdio: 'inherit',
      shell: true
    });

    child.on('close', (code) => {
      if (code !== 0 && code !== null) {
        console.log(chalk.gray(`  Exit code: ${code}`));
      }
      console.log('');
      resolve();
    });

    child.on('error', (error) => {
      // Command not found
      const cmdName = cmd.split(' ')[0];
      console.log(chalk.red(`\n  Command not found: ${cmdName}`));
      console.log(chalk.gray(`  Did you mean: @${cmdName}?\n`));
      resolve();
    });
  });
}

/**
 * Show help message
 */
function showHelp() {
  console.log(chalk.white(`
  VIBECODE SHELL HELP

  ${chalk.cyan('Built-in Commands:')}
    exit, quit, q      Exit shell
    clear, cls         Clear screen
    history, hist      Show command history
    help, h            Show this help
    pwd                Print working directory
    info               Show project info
    cd <dir>           Change directory

  ${chalk.cyan('Prefixes:')}
    ${chalk.yellow('@')}<command>         Run vibecode command
                       e.g., @status, @git status, @debug

    ${chalk.yellow('?')}<query>           Ask AI a question
                       e.g., ?explain this code, ?fix the error

    ${chalk.yellow('!')}<command>         Force raw shell execution
                       e.g., !npm run dev

    ${chalk.yellow('!!')}                 Repeat last command
    ${chalk.yellow('!')}<n>               Repeat command #n from history

  ${chalk.cyan('Examples:')}
    vibe$ npm test          Run npm test
    vibe$ @git commit       Git commit via vibecode
    vibe$ @s                Vibecode status (alias)
    vibe$ ?what is useState Ask AI about useState
    vibe$ !node server.js   Run node directly
    vibe$ !!                Repeat last command

  ${chalk.cyan('Aliases:')}
    @s  -> @status          @g  -> @git
    @d  -> @debug           @b  -> @build
    @w  -> @watch           @a  -> @assist
  `));
}

/**
 * Show project information
 */
function showProjectInfo(projectInfo, cwd) {
  console.log(chalk.cyan(`
  PROJECT INFO

  Name:      ${chalk.white(projectInfo.name)}
  Type:      ${chalk.white(projectInfo.type)}
  Directory: ${chalk.white(cwd)}
  Git:       ${projectInfo.hasGit ? chalk.green('Yes') + chalk.gray(` (${projectInfo.branch})`) : chalk.gray('No')}
  Vibecode:  ${projectInfo.hasVibecode ? chalk.green('Yes') : chalk.gray('No')}
  `));
}

export default shellCommand;
