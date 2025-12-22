// ═══════════════════════════════════════════════════════════════════════════════
// VIBECODE CLI - Plan Command
// ═══════════════════════════════════════════════════════════════════════════════

import chalk from 'chalk';
import ora from 'ora';
import path from 'path';
import { workspaceExists, getProjectName } from '../core/workspace.js';
import {
  getCurrentSessionId,
  getCurrentSessionPath,
  readSessionFile,
  writeSessionFile,
  sessionFileExists
} from '../core/session.js';
import { getCurrentState, transitionTo } from '../core/state-machine.js';
import { getSpecHash } from '../core/contract.js';
import { STATES } from '../config/constants.js';
import { getPlanTemplate, getCoderPackTemplate } from '../config/templates.js';
import { printBox, printError, printSuccess, printNextStep } from '../ui/output.js';

export async function planCommand(options = {}) {
  const spinner = ora('Creating execution plan...').start();

  try {
    // Check workspace
    if (!await workspaceExists()) {
      spinner.fail();
      printError('No Vibecode workspace found. Run `vibecode init` first.');
      process.exit(1);
    }

    // Check state
    const currentState = await getCurrentState();
    if (currentState !== STATES.CONTRACT_LOCKED) {
      spinner.fail();
      printError(`Cannot create plan in state: ${currentState}`);
      console.log('Contract must be locked first. Run `vibecode lock`.');
      process.exit(1);
    }

    // Get session info
    const projectName = await getProjectName();
    const sessionId = await getCurrentSessionId();
    const sessionPath = await getCurrentSessionPath();
    const specHash = await getSpecHash();

    // Read contract, blueprint, and intake
    spinner.text = 'Reading contract...';
    const contractContent = await readSessionFile('contract.md');

    let blueprintContent = '';
    if (await sessionFileExists('blueprint.md')) {
      blueprintContent = await readSessionFile('blueprint.md');
    }

    let intakeContent = '';
    if (await sessionFileExists('intake.md')) {
      intakeContent = await readSessionFile('intake.md');
    }

    // Generate plan
    spinner.text = 'Generating plan...';
    const planContent = getPlanTemplate(projectName, sessionId, specHash, contractContent);
    await writeSessionFile('plan.md', planContent);

    // Generate coder pack
    spinner.text = 'Generating coder pack...';
    const coderPackContent = getCoderPackTemplate(
      projectName,
      sessionId,
      specHash,
      contractContent,
      blueprintContent,
      intakeContent
    );
    await writeSessionFile('coder_pack.md', coderPackContent);

    // Transition state
    await transitionTo(STATES.PLAN_CREATED, 'plan_created');

    spinner.succeed('Execution plan created!');

    // Success output
    const content = `📋 PLAN CREATED

Project: ${projectName}
Session: ${sessionId}
Spec Hash: ${specHash}

Files generated:
• plan.md - Execution steps
• coder_pack.md - Instructions for AI builder`;

    console.log();
    printBox(content, { borderColor: 'cyan' });

    console.log();
    console.log(chalk.cyan('📁 Files:'));
    console.log(chalk.gray(`   ${sessionPath}/`));
    console.log(chalk.gray('   ├── plan.md'));
    console.log(chalk.gray('   └── coder_pack.md'));

    printNextStep('Transfer coder_pack.md to Claude Code and run `vibecode build --start`');

  } catch (error) {
    spinner.fail('Failed to create plan');
    printError(error.message);
    process.exit(1);
  }
}
