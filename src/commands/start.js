// ═══════════════════════════════════════════════════════════════════════════════
// VIBECODE CLI - Start Command
// ═══════════════════════════════════════════════════════════════════════════════

import chalk from 'chalk';
import ora from 'ora';
import path from 'path';
import {
  workspaceExists,
  loadState,
  getProjectName
} from '../core/workspace.js';
import {
  createSession,
  getCurrentSessionId,
  getCurrentSessionPath,
  createIntake,
  createBlueprint,
  createContract,
  getSessionFilesStatus
} from '../core/session.js';
import { getCurrentState, transitionTo } from '../core/state-machine.js';
import { STATES } from '../config/constants.js';
import {
  printBox,
  printError,
  printSuccess,
  printProgress,
  printStatus,
  printNextStep
} from '../ui/output.js';
import { printWelcome, printDivider } from '../ui/branding.js';
import { askSimpleDescription, askNextAction, confirmAction } from '../ui/prompts.js';

export async function startCommand(options = {}) {
  try {
    // Check workspace
    if (!await workspaceExists()) {
      printError('No Vibecode workspace found.');
      console.log('Run `vibecode init` first.');
      process.exit(1);
    }

    // Load current state
    const currentState = await getCurrentState();
    const projectName = await getProjectName();
    let sessionId = await getCurrentSessionId();

    // Print welcome
    printWelcome();
    printDivider();
    printStatus(projectName, currentState, sessionId);
    printProgress(currentState);
    printDivider();

    // Handle based on state
    switch (currentState) {
      case STATES.INIT:
        await handleInit(projectName);
        break;

      case STATES.INTAKE_CAPTURED:
        await handleIntakeCaptured(projectName);
        break;

      case STATES.BLUEPRINT_DRAFTED:
        await handleBlueprintDrafted(projectName);
        break;

      case STATES.CONTRACT_DRAFTED:
        await handleContractDrafted(projectName);
        break;

      case STATES.CONTRACT_LOCKED:
        await handleContractLocked(projectName);
        break;

      default:
        console.log(chalk.yellow(`State ${currentState} not fully handled in MVP.`));
        console.log('This will be implemented in Phase B.');
    }

  } catch (error) {
    printError(error.message);
    process.exit(1);
  }
}

async function handleInit(projectName) {
  console.log();
  console.log(chalk.cyan('🏗️  Bắt đầu dự án mới!\n'));

  // Get project description
  const description = await askSimpleDescription();

  if (!description || description.trim().length < 10) {
    printError('Mô tả quá ngắn. Vui lòng thử lại.');
    return;
  }

  const spinner = ora('Creating session...').start();

  // Create session
  const sessionId = await createSession(projectName);
  spinner.text = 'Capturing intake...';

  // Create intake
  await createIntake(projectName, description, sessionId);

  // Transition state
  await transitionTo(STATES.INTAKE_CAPTURED, 'intake_captured');

  spinner.succeed('Intake captured!');

  const sessionPath = await getCurrentSessionPath();
  console.log();
  printSuccess(`Intake saved to: ${chalk.gray(path.join(sessionPath, 'intake.md'))}`);
  printNextStep('Review intake.md then run `vibecode start` to continue');
}

async function handleIntakeCaptured(projectName) {
  console.log();
  console.log(chalk.cyan('📋 Intake đã được capture. Sẵn sàng tạo Blueprint.\n'));

  const action = await askNextAction(STATES.INTAKE_CAPTURED);

  if (action === 'blueprint') {
    const spinner = ora('Creating blueprint...').start();
    const sessionId = await getCurrentSessionId();

    await createBlueprint(projectName, sessionId);
    await transitionTo(STATES.BLUEPRINT_DRAFTED, 'blueprint_created');

    spinner.succeed('Blueprint created!');

    const sessionPath = await getCurrentSessionPath();
    printSuccess(`Blueprint saved to: ${chalk.gray(path.join(sessionPath, 'blueprint.md'))}`);
    printNextStep('Edit blueprint.md then run `vibecode start` to continue');

  } else if (action === 'view_intake') {
    const sessionPath = await getCurrentSessionPath();
    console.log(chalk.gray(`\nIntake file: ${path.join(sessionPath, 'intake.md')}`));

  } else {
    console.log('Goodbye!');
  }
}

async function handleBlueprintDrafted(projectName) {
  console.log();
  console.log(chalk.cyan('📘 Blueprint đã sẵn sàng. Tạo Contract?\n'));

  const action = await askNextAction(STATES.BLUEPRINT_DRAFTED);

  if (action === 'contract') {
    const spinner = ora('Creating contract...').start();
    const sessionId = await getCurrentSessionId();

    await createContract(projectName, sessionId);
    await transitionTo(STATES.CONTRACT_DRAFTED, 'contract_created');

    spinner.succeed('Contract created!');

    const sessionPath = await getCurrentSessionPath();
    printSuccess(`Contract saved to: ${chalk.gray(path.join(sessionPath, 'contract.md'))}`);
    printNextStep('Edit contract.md then run `vibecode lock` to finalize');

  } else if (action === 'edit_blueprint') {
    const sessionPath = await getCurrentSessionPath();
    console.log(chalk.gray(`\nBlueprint file: ${path.join(sessionPath, 'blueprint.md')}`));

  } else {
    console.log('Goodbye!');
  }
}

async function handleContractDrafted(projectName) {
  console.log();
  console.log(chalk.cyan('📜 Contract đã được tạo. Sẵn sàng lock?\n'));

  const sessionPath = await getCurrentSessionPath();
  console.log(chalk.gray(`Contract file: ${path.join(sessionPath, 'contract.md')}`));
  console.log();

  const action = await askNextAction(STATES.CONTRACT_DRAFTED);

  if (action === 'lock') {
    console.log(chalk.yellow('\nRun `vibecode lock` to lock the contract.'));

  } else if (action === 'edit_contract') {
    console.log(chalk.gray(`\nEdit: ${path.join(sessionPath, 'contract.md')}`));

  } else {
    console.log('Goodbye!');
  }
}

async function handleContractLocked(projectName) {
  console.log();

  const content = `🎉 Contract is LOCKED!

Your project is ready for build.

In Phase B, you will be able to:
• Run \`vibecode build\` to start building
• Run \`vibecode review\` for QA checks

For now, you can:
• Transfer the contract to Claude Code
• Use Vibecode Kit prompts for building`;

  printBox(content, { borderColor: 'green' });

  const sessionPath = await getCurrentSessionPath();
  console.log();
  console.log(chalk.cyan('📁 Your files:'));
  console.log(chalk.gray(`   ${sessionPath}/`));
  console.log(chalk.gray('   ├── intake.md'));
  console.log(chalk.gray('   ├── blueprint.md'));
  console.log(chalk.gray('   └── contract.md 🔒'));
}
