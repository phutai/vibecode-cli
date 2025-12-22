// ═══════════════════════════════════════════════════════════════════════════════
// VIBECODE CLI - Interactive Prompts
// ═══════════════════════════════════════════════════════════════════════════════

import inquirer from 'inquirer';
import chalk from 'chalk';

/**
 * Ask for project description
 */
export async function askProjectDescription() {
  const { description } = await inquirer.prompt([
    {
      type: 'editor',
      name: 'description',
      message: 'Mô tả ý tưởng dự án của bạn (mở editor):',
      waitForUseInput: false
    }
  ]);

  // If editor fails, fall back to input
  if (!description || description.trim() === '') {
    const { fallback } = await inquirer.prompt([
      {
        type: 'input',
        name: 'fallback',
        message: chalk.cyan('📝 Bạn muốn build gì hôm nay?\n') + chalk.gray('   (Mô tả bằng ngôn ngữ tự nhiên)\n\n   >'),
      }
    ]);
    return fallback;
  }

  return description;
}

/**
 * Simple text input for description
 */
export async function askSimpleDescription() {
  console.log();
  const { description } = await inquirer.prompt([
    {
      type: 'input',
      name: 'description',
      message: chalk.cyan('📝 Bạn muốn build gì hôm nay?'),
      validate: (input) => {
        if (input.trim().length < 10) {
          return 'Vui lòng mô tả chi tiết hơn (ít nhất 10 ký tự)';
        }
        return true;
      }
    }
  ]);
  return description;
}

/**
 * Confirm action
 */
export async function confirmAction(message) {
  const { confirm } = await inquirer.prompt([
    {
      type: 'confirm',
      name: 'confirm',
      message: message,
      default: true
    }
  ]);
  return confirm;
}

/**
 * Select from options
 */
export async function selectOption(message, choices) {
  const { selection } = await inquirer.prompt([
    {
      type: 'list',
      name: 'selection',
      message: message,
      choices: choices
    }
  ]);
  return selection;
}

/**
 * Ask what to do next based on state
 */
export async function askNextAction(state) {
  const actions = {
    'INIT': [
      { name: 'Capture intake (mô tả dự án)', value: 'intake' },
      { name: 'Exit', value: 'exit' }
    ],
    'INTAKE_CAPTURED': [
      { name: 'Create blueprint', value: 'blueprint' },
      { name: 'View intake', value: 'view_intake' },
      { name: 'Exit', value: 'exit' }
    ],
    'BLUEPRINT_DRAFTED': [
      { name: 'Create contract', value: 'contract' },
      { name: 'Edit blueprint', value: 'edit_blueprint' },
      { name: 'Exit', value: 'exit' }
    ],
    'CONTRACT_DRAFTED': [
      { name: 'Lock contract (vibecode lock)', value: 'lock' },
      { name: 'Edit contract', value: 'edit_contract' },
      { name: 'Exit', value: 'exit' }
    ],
    'CONTRACT_LOCKED': [
      { name: 'Ready for build! (Phase B)', value: 'ready' },
      { name: 'View contract', value: 'view_contract' },
      { name: 'Exit', value: 'exit' }
    ]
  };

  const choices = actions[state] || actions['INIT'];
  return await selectOption('What would you like to do?', choices);
}
