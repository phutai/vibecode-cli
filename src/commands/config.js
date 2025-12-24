// ═══════════════════════════════════════════════════════════════════════════════
// VIBECODE CLI - Config Command
// ═══════════════════════════════════════════════════════════════════════════════

import chalk from 'chalk';
import path from 'path';
import { workspaceExists, getWorkspacePath } from '../core/workspace.js';
import { pathExists, readJson, writeJson } from '../utils/files.js';
import { PROVIDERS, getDefaultProvider } from '../providers/index.js';
import { printBox, printError, printSuccess, printInfo } from '../ui/output.js';

const CONFIG_FILE = 'config.json';

/**
 * Get config file path
 */
function getConfigPath() {
  return path.join(getWorkspacePath(), CONFIG_FILE);
}

/**
 * Load config
 */
async function loadConfig() {
  const configPath = getConfigPath();
  if (await pathExists(configPath)) {
    return await readJson(configPath);
  }
  return getDefaultConfig();
}

/**
 * Save config
 */
async function saveConfig(config) {
  const configPath = getConfigPath();
  await writeJson(configPath, config);
}

/**
 * Get default config
 */
function getDefaultConfig() {
  return {
    provider: 'claude-code',
    claudeCode: {
      flags: ['--dangerously-skip-permissions'],
      timeout: 30 // minutes
    },
    autoEvidence: true,
    verbose: false,
    notifications: true // Desktop notifications
  };
}

export async function configCommand(options = {}) {
  try {
    // Check workspace for set operations
    if (options.provider || options.notifications !== undefined) {
      if (!await workspaceExists()) {
        printError('No Vibecode workspace found. Run `vibecode init` first.');
        process.exit(1);
      }
    }

    // Set notifications
    if (options.notifications !== undefined) {
      await setNotifications(options.notifications);
      return;
    }

    // Show current config
    if (options.show || (!options.provider)) {
      await showConfig();
      return;
    }

    // Set provider
    if (options.provider) {
      await setProvider(options.provider);
      return;
    }

  } catch (error) {
    printError(error.message);
    process.exit(1);
  }
}

async function showConfig() {
  console.log();

  // Check if workspace exists
  if (!await workspaceExists()) {
    // Show default config
    console.log(chalk.cyan('Default Configuration (no workspace):'));
    console.log();
    const defaultConfig = getDefaultConfig();
    console.log(chalk.gray('Provider: ') + chalk.white(defaultConfig.provider));
    console.log(chalk.gray('Flags: ') + chalk.white(defaultConfig.claudeCode.flags.join(', ')));
    console.log(chalk.gray('Timeout: ') + chalk.white(`${defaultConfig.claudeCode.timeout} minutes`));
    console.log();
    console.log(chalk.gray('Run `vibecode init` to create a workspace.'));
    return;
  }

  const config = await loadConfig();

  const content = `Current Configuration

Provider: ${config.provider}
Flags: ${config.claudeCode?.flags?.join(', ') || 'none'}
Timeout: ${config.claudeCode?.timeout || 30} minutes
Auto Evidence: ${config.autoEvidence ? 'enabled' : 'disabled'}
Verbose: ${config.verbose ? 'enabled' : 'disabled'}
Notifications: ${config.notifications !== false ? 'enabled' : 'disabled'}`;

  printBox(content, { borderColor: 'cyan' });

  // Show available providers
  console.log();
  console.log(chalk.cyan('Available Providers:'));
  Object.entries(PROVIDERS).forEach(([key, provider]) => {
    const status = provider.available ? chalk.green('available') : chalk.gray('coming soon');
    const current = key === config.provider ? chalk.yellow(' (current)') : '';
    console.log(chalk.gray(`  • ${key}: ${provider.description} [${status}]${current}`));
  });

  console.log();
  console.log(chalk.gray('To change: vibecode config --provider <name>'));
}

async function setProvider(providerName) {
  // Validate provider
  if (!PROVIDERS[providerName]) {
    printError(`Unknown provider: ${providerName}`);
    console.log();
    console.log(chalk.cyan('Available providers:'));
    Object.keys(PROVIDERS).forEach(key => {
      console.log(chalk.gray(`  • ${key}`));
    });
    process.exit(1);
  }

  if (!PROVIDERS[providerName].available) {
    printError(`Provider "${providerName}" is not yet available.`);
    process.exit(1);
  }

  // Load and update config
  const config = await loadConfig();
  config.provider = providerName;
  await saveConfig(config);

  printSuccess(`Provider set to: ${providerName}`);
  console.log(chalk.gray(`Config saved to: ${getConfigPath()}`));
}

/**
 * Set notifications on/off
 */
async function setNotifications(value) {
  const enabled = value === 'on' || value === true || value === 'true';

  const config = await loadConfig();
  config.notifications = enabled;
  await saveConfig(config);

  if (enabled) {
    printSuccess('Desktop notifications enabled');
  } else {
    printSuccess('Desktop notifications disabled');
  }
  console.log(chalk.gray(`Config saved to: ${getConfigPath()}`));
}

/**
 * Get notifications setting from config
 */
export async function getNotificationsSetting() {
  try {
    const config = await loadConfig();
    return config.notifications !== false;
  } catch {
    return true; // Default to enabled
  }
}
