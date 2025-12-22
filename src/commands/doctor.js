// ═══════════════════════════════════════════════════════════════════════════════
// VIBECODE CLI - Doctor Command
// ═══════════════════════════════════════════════════════════════════════════════

import chalk from 'chalk';
import ora from 'ora';
import { VERSION, SPEC_HASH } from '../config/constants.js';
import {
  workspaceExists,
  loadConfig,
  loadState
} from '../core/workspace.js';
import { getCurrentSessionId, getSessionFilesStatus } from '../core/session.js';
import { getSpecHash } from '../core/contract.js';
import { printBox } from '../ui/output.js';

export async function doctorCommand() {
  console.log();
  console.log(chalk.cyan('🔍 Vibecode Doctor'));
  console.log(chalk.gray('   Checking installation and workspace health...\n'));

  const checks = [];

  // Check Node version
  const nodeVersion = process.version;
  const nodeMajor = parseInt(nodeVersion.slice(1).split('.')[0]);
  checks.push({
    name: 'Node.js version',
    status: nodeMajor >= 18 ? 'ok' : 'error',
    message: `${nodeVersion} ${nodeMajor >= 18 ? '(OK)' : '(Need 18+)'}`
  });

  // Check CLI version
  checks.push({
    name: 'Vibecode CLI',
    status: 'ok',
    message: `v${VERSION}`
  });

  // Check workspace
  const hasWorkspace = await workspaceExists();
  checks.push({
    name: 'Workspace',
    status: hasWorkspace ? 'ok' : 'warning',
    message: hasWorkspace ? '.vibecode/ found' : 'Not initialized (run vibecode init)'
  });

  if (hasWorkspace) {
    try {
      // Check config
      const config = await loadConfig();
      checks.push({
        name: 'Config',
        status: 'ok',
        message: 'vibecode.yaml valid'
      });

      // Check state
      const state = await loadState();
      checks.push({
        name: 'State',
        status: 'ok',
        message: `state.json valid (${state.current_state})`
      });

      // Check session
      const sessionId = await getCurrentSessionId();
      checks.push({
        name: 'Session',
        status: sessionId ? 'ok' : 'info',
        message: sessionId ? '1 active session' : 'No active session'
      });

      // Check contract
      const specHash = await getSpecHash();
      checks.push({
        name: 'Contract',
        status: specHash ? 'ok' : 'warning',
        message: specHash ? `Locked (${specHash.substring(0, 8)}...)` : 'Not locked'
      });

    } catch (error) {
      checks.push({
        name: 'Workspace files',
        status: 'error',
        message: error.message
      });
    }
  }

  // Print results
  let hasErrors = false;
  let hasWarnings = false;

  checks.forEach(check => {
    let icon, color;
    switch (check.status) {
      case 'ok':
        icon = '✅';
        color = chalk.green;
        break;
      case 'warning':
        icon = '⚠️ ';
        color = chalk.yellow;
        hasWarnings = true;
        break;
      case 'error':
        icon = '❌';
        color = chalk.red;
        hasErrors = true;
        break;
      default:
        icon = 'ℹ️ ';
        color = chalk.blue;
    }

    console.log(`  ${icon} ${check.name}: ${color(check.message)}`);
  });

  // Summary
  console.log();
  if (hasErrors) {
    console.log(chalk.red('  Some checks failed. Please fix the errors above.'));
  } else if (hasWarnings) {
    console.log(chalk.yellow('  All checks passed! (with warnings)'));
  } else {
    console.log(chalk.green('  All checks passed!'));
  }
  console.log();
}
