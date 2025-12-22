// ═══════════════════════════════════════════════════════════════════════════════
// VIBECODE CLI - Output Formatting
// ═══════════════════════════════════════════════════════════════════════════════

import chalk from 'chalk';
import boxen from 'boxen';
import { PROGRESS_MAP, COLORS } from '../config/constants.js';

/**
 * Print boxed message
 */
export function printBox(content, options = {}) {
  const defaultOptions = {
    padding: 1,
    borderStyle: 'round',
    borderColor: 'cyan'
  };
  console.log(boxen(content, { ...defaultOptions, ...options }));
}

/**
 * Print success message
 */
export function printSuccess(message) {
  console.log(chalk.green('✅ ' + message));
}

/**
 * Print error message
 */
export function printError(message) {
  console.log(chalk.red('❌ ' + message));
}

/**
 * Print warning message
 */
export function printWarning(message) {
  console.log(chalk.yellow('⚠️  ' + message));
}

/**
 * Print info message
 */
export function printInfo(message) {
  console.log(chalk.blue('ℹ️  ' + message));
}

/**
 * Print progress bar based on state
 */
export function printProgress(state) {
  const progress = PROGRESS_MAP[state] || PROGRESS_MAP.INIT;

  const bar = `  ${progress.intake} INTAKE  ${progress.blueprint} BLUEPRINT  ${progress.contract} CONTRACT  ${progress.plan} PLAN  ${progress.build} BUILD  ${progress.review} REVIEW  ${progress.ship} SHIP`;

  console.log(chalk.gray('┌─ Progress ───────────────────────────────────────────────────────────────────────────┐'));
  console.log(chalk.white(bar));
  console.log(chalk.gray('└──────────────────────────────────────────────────────────────────────────────────────┘'));
}

/**
 * Print status info
 */
export function printStatus(projectName, state, sessionId, specHash = null) {
  console.log();
  console.log(chalk.cyan(`📍 Project: ${chalk.white(projectName)}`));
  console.log(chalk.cyan(`📊 State: ${chalk.white(state)}`));
  console.log(chalk.cyan(`📋 Session: ${chalk.gray(sessionId || 'none')}`));

  if (specHash) {
    console.log(chalk.cyan(`🔒 Spec Hash: ${chalk.green(specHash)}`));
  } else {
    console.log(chalk.cyan(`📄 Spec Hash: ${chalk.gray('(not locked)')}`));
  }
  console.log();
}

/**
 * Print file tree
 */
export function printFileTree(files) {
  console.log(chalk.cyan('📁 Files:'));
  files.forEach((file, index) => {
    const prefix = index === files.length - 1 ? '└── ' : '├── ';
    console.log(chalk.gray(`   ${prefix}${file}`));
  });
}

/**
 * Print next step hint
 */
export function printNextStep(message) {
  console.log();
  console.log(chalk.yellow(`💡 Next: ${message}`));
}
