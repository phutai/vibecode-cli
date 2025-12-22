// ═══════════════════════════════════════════════════════════════════════════════
// VIBECODE CLI - Lock Command
// ═══════════════════════════════════════════════════════════════════════════════

import chalk from 'chalk';
import ora from 'ora';
import { workspaceExists, loadState } from '../core/workspace.js';
import { getCurrentSessionId, sessionFileExists } from '../core/session.js';
import { lockContract, validateContract } from '../core/contract.js';
import { readSessionFile } from '../core/session.js';
import { transitionTo, getCurrentState } from '../core/state-machine.js';
import { STATES } from '../config/constants.js';
import { printBox, printError, printSuccess, printWarning, printNextStep } from '../ui/output.js';

export async function lockCommand(options = {}) {
  const spinner = ora('Validating contract...').start();

  try {
    // Check workspace
    if (!await workspaceExists()) {
      spinner.fail();
      printError('No Vibecode workspace found. Run `vibecode init` first.');
      process.exit(1);
    }

    // Check state
    const currentState = await getCurrentState();
    if (currentState !== STATES.CONTRACT_DRAFTED) {
      spinner.fail();
      printError(`Cannot lock contract in state: ${currentState}`);
      console.log('Contract must be in CONTRACT_DRAFTED state.');
      console.log(`Current state: ${currentState}`);
      process.exit(1);
    }

    // Check contract file exists
    if (!await sessionFileExists('contract.md')) {
      spinner.fail();
      printError('Contract file not found.');
      console.log('Create a contract first using `vibecode start`.');
      process.exit(1);
    }

    // Dry run mode
    if (options.dryRun) {
      const content = await readSessionFile('contract.md');
      const validation = validateContract(content);

      spinner.stop();

      if (validation.valid) {
        printSuccess('Contract validation passed!');
        if (validation.warnings.length > 0) {
          validation.warnings.forEach(w => printWarning(w));
        }
        console.log('\nRun without --dry-run to lock.');
      } else {
        printError('Contract validation failed:');
        validation.errors.forEach(e => console.log(chalk.red(`  • ${e}`)));
      }
      return;
    }

    // Lock contract
    spinner.text = 'Locking contract...';
    const result = await lockContract();

    if (!result.success) {
      spinner.fail('Contract validation failed');
      console.log();
      result.errors.forEach(e => console.log(chalk.red(`  ❌ ${e}`)));
      console.log();
      console.log('Please edit contract.md and try again.');
      process.exit(1);
    }

    // Transition state
    await transitionTo(STATES.CONTRACT_LOCKED, 'contract_locked');

    spinner.succeed('Contract locked!');

    // Success output
    const content = `🔒 CONTRACT LOCKED

Spec Hash: ${result.specHash}
Locked at: ${result.timestamp}

Contract is now immutable.
All builds must reference this spec_hash.`;

    printBox(content, { borderColor: 'green' });

    if (result.warnings.length > 0) {
      console.log();
      result.warnings.forEach(w => printWarning(w));
    }

    printNextStep('Ready for build! Transfer to Claude Code with contract.');

  } catch (error) {
    spinner.fail('Failed to lock contract');
    printError(error.message);
    process.exit(1);
  }
}
