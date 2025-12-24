// ═══════════════════════════════════════════════════════════════════════════════
// VIBECODE CLI - History Command
// View and manage command history
// ═══════════════════════════════════════════════════════════════════════════════

import chalk from 'chalk';
import inquirer from 'inquirer';
import { spawn } from 'child_process';
import {
  loadHistory,
  clearHistory,
  searchHistory,
  getHistoryItem,
  getHistoryStats
} from '../utils/history.js';

/**
 * History command entry point
 */
export async function historyCommand(options = {}) {
  // Clear history
  if (options.clear) {
    const { confirm } = await inquirer.prompt([{
      type: 'confirm',
      name: 'confirm',
      message: 'Clear all command history?',
      default: false
    }]);

    if (confirm) {
      await clearHistory();
      console.log(chalk.green('\n  ✅ History cleared\n'));
    }
    return;
  }

  // Search history
  if (options.search) {
    return searchHistoryCommand(options.search);
  }

  // Run command from history
  if (options.run) {
    return runFromHistory(options.run);
  }

  // Show stats
  if (options.stats) {
    return showHistoryStats();
  }

  // Show history (default)
  return showHistory(options);
}

/**
 * Display command history
 */
async function showHistory(options) {
  const history = await loadHistory();
  const limit = parseInt(options.limit) || 20;

  console.log(chalk.cyan(`
╭────────────────────────────────────────────────────────────────────╮
│  📜 COMMAND HISTORY                                                │
╰────────────────────────────────────────────────────────────────────╯
  `));

  if (history.length === 0) {
    console.log(chalk.gray('  No history yet.\n'));
    console.log(chalk.gray('  Run some commands first:\n'));
    console.log(chalk.gray('    vibecode go "Your project description"\n'));
    return;
  }

  const items = history.slice(0, limit);

  for (let i = 0; i < items.length; i++) {
    const item = items[i];
    const date = new Date(item.timestamp).toLocaleDateString();
    const time = new Date(item.timestamp).toLocaleTimeString([], {
      hour: '2-digit',
      minute: '2-digit'
    });

    // Truncate long commands
    const displayCmd = item.command.length > 60
      ? item.command.substring(0, 57) + '...'
      : item.command;

    console.log(
      chalk.yellow(`  ${(i + 1).toString().padStart(2)}. `) +
      chalk.white(displayCmd)
    );
    console.log(chalk.gray(`      ${date} ${time}`));

    if (item.description && item.description !== item.command) {
      const displayDesc = item.description.length > 50
        ? item.description.substring(0, 47) + '...'
        : item.description;
      console.log(chalk.gray(`      ${displayDesc}`));
    }

    if (item.projectName) {
      console.log(chalk.gray(`      → ${item.projectName}`));
    }

    console.log('');
  }

  console.log(chalk.gray(`  Showing ${items.length} of ${history.length} items\n`));
  console.log(chalk.gray(`  Commands:`));
  console.log(chalk.gray(`    ${chalk.cyan('vibecode history --run <n>')}     Re-run command`));
  console.log(chalk.gray(`    ${chalk.cyan('vibecode history --search <q>')}  Search history`));
  console.log(chalk.gray(`    ${chalk.cyan('vibecode history --clear')}       Clear history\n`));
}

/**
 * Search history and display results
 */
async function searchHistoryCommand(query) {
  const results = await searchHistory(query);

  console.log(chalk.cyan(`\n  🔍 Search results for "${query}":\n`));

  if (results.length === 0) {
    console.log(chalk.gray('  No matches found.\n'));
    return;
  }

  for (let i = 0; i < Math.min(results.length, 20); i++) {
    const item = results[i];
    const date = new Date(item.timestamp).toLocaleDateString();

    const displayCmd = item.command.length > 55
      ? item.command.substring(0, 52) + '...'
      : item.command;

    console.log(chalk.yellow(`  ${i + 1}. `) + chalk.white(displayCmd));
    console.log(chalk.gray(`     ${date}`));

    if (item.description && item.description !== item.command) {
      const displayDesc = item.description.length > 50
        ? item.description.substring(0, 47) + '...'
        : item.description;
      console.log(chalk.gray(`     ${displayDesc}`));
    }
    console.log('');
  }

  if (results.length > 20) {
    console.log(chalk.gray(`  ... and ${results.length - 20} more\n`));
  }
}

/**
 * Re-run a command from history
 */
async function runFromHistory(index) {
  const item = await getHistoryItem(parseInt(index));

  if (!item) {
    console.log(chalk.red(`\n  ❌ History item #${index} not found.\n`));
    return;
  }

  console.log(chalk.cyan(`\n  🔄 Re-running command:\n`));
  console.log(chalk.white(`     ${item.command}\n`));

  if (item.description) {
    console.log(chalk.gray(`     ${item.description}\n`));
  }

  const { confirm } = await inquirer.prompt([{
    type: 'confirm',
    name: 'confirm',
    message: 'Execute this command?',
    default: true
  }]);

  if (!confirm) {
    console.log(chalk.gray('\n  Cancelled.\n'));
    return;
  }

  console.log(chalk.cyan('\n  Executing...\n'));

  const child = spawn('sh', ['-c', item.command], {
    stdio: 'inherit',
    cwd: process.cwd(),
    shell: true
  });

  child.on('close', (code) => {
    if (code === 0) {
      console.log(chalk.green('\n  ✅ Command completed successfully\n'));
    } else {
      console.log(chalk.yellow(`\n  ⚠️ Command exited with code ${code}\n`));
    }
  });

  child.on('error', (error) => {
    console.log(chalk.red(`\n  ❌ Error: ${error.message}\n`));
  });
}

/**
 * Show history statistics
 */
async function showHistoryStats() {
  const stats = await getHistoryStats();
  const history = await loadHistory();

  console.log(chalk.cyan(`
╭────────────────────────────────────────────────────────────────────╮
│  📊 HISTORY STATISTICS                                             │
╰────────────────────────────────────────────────────────────────────╯
  `));

  console.log(chalk.white(`  Total commands: ${stats.total}`));

  if (stats.oldest) {
    console.log(chalk.gray(`  Oldest: ${new Date(stats.oldest).toLocaleString()}`));
  }

  if (stats.newest) {
    console.log(chalk.gray(`  Newest: ${new Date(stats.newest).toLocaleString()}`));
  }

  // Count command types
  if (history.length > 0) {
    const types = {};
    for (const item of history) {
      const cmd = item.command.split(' ')[1] || 'other';
      types[cmd] = (types[cmd] || 0) + 1;
    }

    console.log(chalk.white('\n  Command breakdown:'));
    const sorted = Object.entries(types).sort((a, b) => b[1] - a[1]);
    for (const [cmd, count] of sorted.slice(0, 5)) {
      const bar = '█'.repeat(Math.min(count, 20));
      console.log(chalk.gray(`    ${cmd.padEnd(12)} ${chalk.cyan(bar)} ${count}`));
    }
  }

  console.log('');
}

export default historyCommand;
