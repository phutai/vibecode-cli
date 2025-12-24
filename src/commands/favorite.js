// ═══════════════════════════════════════════════════════════════════════════════
// VIBECODE CLI - Favorite Command
// Manage favorite prompts for quick reuse
// ═══════════════════════════════════════════════════════════════════════════════

import chalk from 'chalk';
import inquirer from 'inquirer';
import { spawn } from 'child_process';
import {
  loadFavorites,
  addFavorite,
  removeFavorite,
  getFavorite,
  searchFavorites,
  updateFavoriteUsage,
  exportFavorites,
  importFavorites,
  clearFavorites,
  getFavoritesStats
} from '../utils/history.js';

/**
 * Favorite command entry point
 */
export async function favoriteCommand(action, args = [], options = {}) {
  // Default action: list
  if (!action || action === 'list') {
    return listFavorites();
  }

  // Add favorite
  if (action === 'add') {
    const prompt = Array.isArray(args) ? args.join(' ') : args;
    if (!prompt) {
      console.log(chalk.red('\n  ❌ Please provide a prompt to save.\n'));
      console.log(chalk.gray('  Usage: vibecode fav add "Your prompt here"\n'));
      return;
    }
    return addFavoriteCommand(prompt, options);
  }

  // Remove favorite
  if (action === 'remove' || action === 'rm' || action === 'delete') {
    const identifier = Array.isArray(args) ? args[0] : args;
    if (!identifier) {
      console.log(chalk.red('\n  ❌ Please specify which favorite to remove.\n'));
      console.log(chalk.gray('  Usage: vibecode fav remove <number or name>\n'));
      return;
    }
    return removeFavoriteCommand(identifier);
  }

  // Run favorite
  if (action === 'run' || action === 'use') {
    const identifier = Array.isArray(args) ? args[0] : args;
    if (!identifier) {
      return selectAndRunFavorite();
    }
    return runFavoriteCommand(identifier, options);
  }

  // Search favorites
  if (action === 'search' || action === 'find') {
    const query = Array.isArray(args) ? args.join(' ') : args;
    if (!query) {
      console.log(chalk.red('\n  ❌ Please provide a search query.\n'));
      return;
    }
    return searchFavoritesCommand(query);
  }

  // Export
  if (action === 'export') {
    const data = await exportFavorites();
    console.log(JSON.stringify(data, null, 2));
    return;
  }

  // Import
  if (action === 'import') {
    return importFavoritesCommand(options);
  }

  // Clear
  if (action === 'clear') {
    return clearFavoritesCommand();
  }

  // Stats
  if (action === 'stats') {
    return showFavoritesStats();
  }

  // Unknown action - show help
  showFavoriteHelp();
}

/**
 * List all favorites
 */
async function listFavorites() {
  const favorites = await loadFavorites();

  console.log(chalk.cyan(`
╭────────────────────────────────────────────────────────────────────╮
│  ⭐ FAVORITES                                                      │
╰────────────────────────────────────────────────────────────────────╯
  `));

  if (favorites.length === 0) {
    console.log(chalk.gray('  No favorites yet.\n'));
    console.log(chalk.gray('  Add one:\n'));
    console.log(chalk.gray('    vibecode fav add "Your prompt here"\n'));
    return;
  }

  for (let i = 0; i < favorites.length; i++) {
    const fav = favorites[i];
    const usage = fav.usageCount
      ? chalk.gray(` (used ${fav.usageCount}x)`)
      : '';

    const displayName = (fav.name || fav.description || 'Untitled').substring(0, 40);

    console.log(
      chalk.yellow(`  ${(i + 1).toString().padStart(2)}. `) +
      chalk.white(displayName) +
      usage
    );

    // Show command preview
    const cmdPreview = fav.command.length > 55
      ? fav.command.substring(0, 52) + '...'
      : fav.command;
    console.log(chalk.gray(`      ${cmdPreview}`));

    // Show tags if any
    if (fav.tags && fav.tags.length > 0) {
      console.log(chalk.gray(`      Tags: ${fav.tags.join(', ')}`));
    }

    console.log('');
  }

  console.log(chalk.gray(`  Commands:`));
  console.log(chalk.gray(`    ${chalk.cyan('vibecode fav run <n>')}      Run favorite`));
  console.log(chalk.gray(`    ${chalk.cyan('vibecode fav add "..."')}    Add favorite`));
  console.log(chalk.gray(`    ${chalk.cyan('vibecode fav remove <n>')}   Remove favorite\n`));
}

/**
 * Add a new favorite
 */
async function addFavoriteCommand(prompt, options) {
  // Build command
  let command;
  if (options.template) {
    command = `vibecode go --template ${options.template}`;
  } else {
    command = `vibecode go "${prompt}"`;
  }

  // Add extra options if specified
  if (options.preview) command += ' --preview';
  if (options.deploy) command += ' --deploy';
  if (options.notify) command += ' --notify';

  const name = options.name || prompt.substring(0, 40);
  const tags = options.tags ? options.tags.split(',').map(t => t.trim()) : [];

  const result = await addFavorite(name, command, prompt, tags);

  if (result.success) {
    console.log(chalk.green(`\n  ⭐ Added to favorites!\n`));
    console.log(chalk.white(`     Name: ${name}`));
    console.log(chalk.gray(`     Command: ${command}\n`));
  } else {
    console.log(chalk.yellow(`\n  ⚠️ ${result.message}\n`));
  }
}

/**
 * Remove a favorite
 */
async function removeFavoriteCommand(identifier) {
  const result = await removeFavorite(identifier);

  if (result.success) {
    console.log(chalk.green(`\n  ✅ Removed: "${result.removed.name}"\n`));
  } else {
    console.log(chalk.red(`\n  ❌ ${result.message}\n`));
  }
}

/**
 * Run a favorite by identifier
 */
async function runFavoriteCommand(identifier, options = {}) {
  const favorite = await getFavorite(identifier);

  if (!favorite) {
    console.log(chalk.red(`\n  ❌ Favorite "${identifier}" not found.\n`));
    console.log(chalk.gray('  Run `vibecode fav` to see your favorites.\n'));
    return;
  }

  console.log(chalk.cyan(`\n  ⭐ Running: ${favorite.name}\n`));
  console.log(chalk.gray(`     ${favorite.command}\n`));

  if (!options.yes) {
    const { confirm } = await inquirer.prompt([{
      type: 'confirm',
      name: 'confirm',
      message: 'Execute?',
      default: true
    }]);

    if (!confirm) {
      console.log(chalk.gray('\n  Cancelled.\n'));
      return;
    }
  }

  // Update usage count
  await updateFavoriteUsage(favorite.id);

  console.log(chalk.cyan('\n  Executing...\n'));

  // Execute
  const child = spawn('sh', ['-c', favorite.command], {
    stdio: 'inherit',
    cwd: process.cwd(),
    shell: true
  });

  child.on('error', (error) => {
    console.log(chalk.red(`\n  ❌ Error: ${error.message}\n`));
  });
}

/**
 * Interactive favorite selection
 */
async function selectAndRunFavorite() {
  const favorites = await loadFavorites();

  if (favorites.length === 0) {
    console.log(chalk.yellow('\n  No favorites yet.\n'));
    console.log(chalk.gray('  Add one: vibecode fav add "Your prompt"\n'));
    return;
  }

  const { selected } = await inquirer.prompt([{
    type: 'list',
    name: 'selected',
    message: 'Select favorite to run:',
    choices: favorites.map((f, i) => {
      const cmdPreview = f.command.length > 40
        ? f.command.substring(0, 37) + '...'
        : f.command;
      return {
        name: `${f.name} - ${chalk.gray(cmdPreview)}`,
        value: i + 1
      };
    })
  }]);

  await runFavoriteCommand(selected, { yes: true });
}

/**
 * Search favorites
 */
async function searchFavoritesCommand(query) {
  const results = await searchFavorites(query);

  console.log(chalk.cyan(`\n  🔍 Favorites matching "${query}":\n`));

  if (results.length === 0) {
    console.log(chalk.gray('  No matches found.\n'));
    return;
  }

  for (let i = 0; i < results.length; i++) {
    const fav = results[i];
    console.log(chalk.yellow(`  ${i + 1}. `) + chalk.white(fav.name));

    const cmdPreview = fav.command.length > 55
      ? fav.command.substring(0, 52) + '...'
      : fav.command;
    console.log(chalk.gray(`     ${cmdPreview}\n`));
  }

  console.log(chalk.gray(`  Run: vibecode fav run "<name>"\n`));
}

/**
 * Import favorites from stdin
 */
async function importFavoritesCommand(options) {
  // Check if data is being piped
  if (process.stdin.isTTY) {
    console.log(chalk.yellow('\n  Paste JSON data and press Ctrl+D when done:\n'));
  }

  let data = '';
  process.stdin.setEncoding('utf8');

  return new Promise((resolve) => {
    process.stdin.on('readable', () => {
      let chunk;
      while ((chunk = process.stdin.read()) !== null) {
        data += chunk;
      }
    });

    process.stdin.on('end', async () => {
      try {
        const parsed = JSON.parse(data);

        if (!Array.isArray(parsed)) {
          console.log(chalk.red('\n  ❌ Invalid format: expected an array\n'));
          resolve();
          return;
        }

        const result = await importFavorites(parsed, !options.replace);
        console.log(chalk.green(`\n  ✅ Imported ${result.imported} favorites`));
        console.log(chalk.gray(`     Total favorites: ${result.total}\n`));
      } catch (error) {
        console.log(chalk.red(`\n  ❌ Invalid JSON: ${error.message}\n`));
      }
      resolve();
    });
  });
}

/**
 * Clear all favorites
 */
async function clearFavoritesCommand() {
  const favorites = await loadFavorites();

  if (favorites.length === 0) {
    console.log(chalk.gray('\n  No favorites to clear.\n'));
    return;
  }

  const { confirm } = await inquirer.prompt([{
    type: 'confirm',
    name: 'confirm',
    message: `Clear all ${favorites.length} favorites?`,
    default: false
  }]);

  if (confirm) {
    await clearFavorites();
    console.log(chalk.green('\n  ✅ All favorites cleared\n'));
  }
}

/**
 * Show favorites statistics
 */
async function showFavoritesStats() {
  const stats = await getFavoritesStats();

  console.log(chalk.cyan(`
╭────────────────────────────────────────────────────────────────────╮
│  📊 FAVORITES STATISTICS                                           │
╰────────────────────────────────────────────────────────────────────╯
  `));

  console.log(chalk.white(`  Total favorites: ${stats.total}`));
  console.log(chalk.white(`  Total usage: ${stats.totalUsage} runs`));

  if (stats.mostUsed) {
    console.log(chalk.white(`  Most used: ${stats.mostUsed}`));
  }

  console.log('');
}

/**
 * Show help for favorite command
 */
function showFavoriteHelp() {
  console.log(chalk.cyan(`
  ⭐ Favorites Commands:

  ${chalk.yellow('vibecode fav')}                    List all favorites
  ${chalk.yellow('vibecode fav list')}               List all favorites

  ${chalk.yellow('vibecode fav add "prompt"')}       Add a favorite
  ${chalk.yellow('vibecode fav add "prompt" -n X')} Add with custom name
  ${chalk.yellow('vibecode fav add "prompt" -t T')} Add with template

  ${chalk.yellow('vibecode fav run <n>')}            Run favorite by number
  ${chalk.yellow('vibecode fav run "name"')}         Run favorite by name
  ${chalk.yellow('vibecode fav run')}                Interactive selection

  ${chalk.yellow('vibecode fav remove <n>')}         Remove favorite
  ${chalk.yellow('vibecode fav search <query>')}     Search favorites

  ${chalk.yellow('vibecode fav export')}             Export to JSON
  ${chalk.yellow('vibecode fav import')}             Import from JSON
  ${chalk.yellow('vibecode fav clear')}              Clear all favorites
  ${chalk.yellow('vibecode fav stats')}              Show statistics
  `));
}

export default favoriteCommand;
