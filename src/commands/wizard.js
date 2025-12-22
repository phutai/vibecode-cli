// ═══════════════════════════════════════════════════════════════════════════════
// VIBECODE CLI - Interactive Wizard
// Phase H1: Smart Defaults - No args = Interactive menu
// ═══════════════════════════════════════════════════════════════════════════════

import inquirer from 'inquirer';
import chalk from 'chalk';
import { VERSION } from '../config/constants.js';

/**
 * Wizard Command - Interactive menu when no args provided
 *
 * Usage:
 *   vibecode  (no args) → Shows interactive menu
 */
export async function wizardCommand() {
  // Show welcome banner
  console.log(chalk.cyan(`
╭────────────────────────────────────────────────────────────────────╮
│                                                                    │
│   🏗️  VIBECODE v${VERSION.padEnd(43)}│
│   Build Software with Discipline                                   │
│                                                                    │
╰────────────────────────────────────────────────────────────────────╯
  `));

  const { action } = await inquirer.prompt([
    {
      type: 'list',
      name: 'action',
      message: 'Bạn muốn làm gì hôm nay?',
      choices: [
        { name: '🚀 Tạo project mới nhanh', value: 'go' },
        { name: '🤖 Build project phức tạp (nhiều modules)', value: 'agent' },
        { name: '🔍 Debug/fix lỗi', value: 'debug' },
        { name: '🤝 Trợ giúp từ AI', value: 'assist' },
        new inquirer.Separator(),
        { name: '📊 Xem trạng thái project hiện tại', value: 'status' },
        { name: '⚙️  Cài đặt', value: 'config' },
        { name: '📁 Khởi tạo workspace mới', value: 'init' },
        new inquirer.Separator(),
        { name: '❓ Xem trợ giúp', value: 'help' },
        { name: '👋 Thoát', value: 'exit' }
      ]
    }
  ]);

  switch (action) {
    case 'go':
      await handleGo();
      break;
    case 'agent':
      await handleAgent();
      break;
    case 'debug':
      await handleDebug();
      break;
    case 'assist':
      await handleAssist();
      break;
    case 'status':
      await handleStatus();
      break;
    case 'config':
      await handleConfig();
      break;
    case 'init':
      await handleInit();
      break;
    case 'help':
      showHelp();
      break;
    case 'exit':
      console.log(chalk.cyan('\n👋 Hẹn gặp lại!\n'));
      process.exit(0);
  }
}

/**
 * Handle Go command with prompts
 */
async function handleGo() {
  const { goCommand } = await import('./go.js');

  const { description } = await inquirer.prompt([
    {
      type: 'input',
      name: 'description',
      message: 'Mô tả project bạn muốn tạo:',
      validate: (input) => input.length > 5 || 'Vui lòng mô tả chi tiết hơn (ít nhất 6 ký tự)'
    }
  ]);

  const { template } = await inquirer.prompt([
    {
      type: 'list',
      name: 'template',
      message: 'Chọn template (hoặc để trống):',
      choices: [
        { name: '🎨 Không dùng template (tự do)', value: null },
        { name: '🌐 Landing page', value: 'landing' },
        { name: '💼 SaaS application', value: 'saas' },
        { name: '⌨️  CLI tool', value: 'cli' },
        { name: '🔌 REST API', value: 'api' }
      ]
    }
  ]);

  const { confirm } = await inquirer.prompt([
    {
      type: 'confirm',
      name: 'confirm',
      message: `Tạo project: "${description}"${template ? ` (template: ${template})` : ''}?`,
      default: true
    }
  ]);

  if (confirm) {
    const options = {};
    if (template) options.template = template;
    await goCommand(description, options);
  } else {
    console.log(chalk.gray('\n✗ Đã huỷ.\n'));
  }
}

/**
 * Handle Agent command with prompts
 */
async function handleAgent() {
  const { agentCommand } = await import('./agent.js');

  const { description } = await inquirer.prompt([
    {
      type: 'input',
      name: 'description',
      message: 'Mô tả project phức tạp (VD: SaaS với auth, billing, dashboard):',
      validate: (input) => input.length > 10 || 'Vui lòng mô tả chi tiết hơn (ít nhất 11 ký tự)'
    }
  ]);

  const { createNew } = await inquirer.prompt([
    {
      type: 'confirm',
      name: 'createNew',
      message: 'Tạo thư mục project mới?',
      default: true
    }
  ]);

  const { verbose } = await inquirer.prompt([
    {
      type: 'confirm',
      name: 'verbose',
      message: 'Hiển thị chi tiết quá trình build?',
      default: false
    }
  ]);

  console.log(chalk.blue('\n🤖 Bắt đầu Agent Mode...\n'));
  await agentCommand(description, { new: createNew, verbose });
}

/**
 * Handle Debug command
 */
async function handleDebug() {
  const { debugCommand } = await import('./debug.js');

  const { mode } = await inquirer.prompt([
    {
      type: 'list',
      name: 'mode',
      message: 'Chọn chế độ debug:',
      choices: [
        { name: '🔄 Interactive - Debug trực tiếp', value: 'interactive' },
        { name: '🔍 Auto-scan - Tự động tìm và fix lỗi', value: 'auto' },
        { name: '📝 Mô tả lỗi', value: 'describe' }
      ]
    }
  ]);

  if (mode === 'interactive') {
    await debugCommand([], { interactive: true });
  } else if (mode === 'auto') {
    await debugCommand([], { auto: true });
  } else {
    const { description } = await inquirer.prompt([
      {
        type: 'input',
        name: 'description',
        message: 'Mô tả lỗi bạn gặp phải:',
        validate: (input) => input.length > 5 || 'Vui lòng mô tả chi tiết hơn'
      }
    ]);
    await debugCommand([description], {});
  }
}

/**
 * Handle Assist command
 */
async function handleAssist() {
  const { assistCommand } = await import('./assist.js');

  const { hasPrompt } = await inquirer.prompt([
    {
      type: 'confirm',
      name: 'hasPrompt',
      message: 'Bạn có câu hỏi cụ thể không?',
      default: false
    }
  ]);

  if (hasPrompt) {
    const { prompt } = await inquirer.prompt([
      {
        type: 'input',
        name: 'prompt',
        message: 'Nhập câu hỏi của bạn:',
        validate: (input) => input.length > 3 || 'Vui lòng nhập câu hỏi'
      }
    ]);
    await assistCommand([prompt], {});
  } else {
    await assistCommand([], {});
  }
}

/**
 * Handle Status command
 */
async function handleStatus() {
  const { statusCommand } = await import('./status.js');
  await statusCommand({});
}

/**
 * Handle Config command
 */
async function handleConfig() {
  const { configCommand } = await import('./config.js');

  const { action } = await inquirer.prompt([
    {
      type: 'list',
      name: 'action',
      message: 'Cài đặt:',
      choices: [
        { name: '👀 Xem cài đặt hiện tại', value: 'show' },
        { name: '🔧 Thay đổi provider', value: 'provider' }
      ]
    }
  ]);

  if (action === 'show') {
    await configCommand({ show: true });
  } else {
    const { provider } = await inquirer.prompt([
      {
        type: 'list',
        name: 'provider',
        message: 'Chọn AI provider:',
        choices: [
          { name: 'Claude Code (mặc định)', value: 'claude-code' }
        ]
      }
    ]);
    await configCommand({ provider });
  }
}

/**
 * Handle Init command
 */
async function handleInit() {
  const { initCommand } = await import('./init.js');

  const { confirm } = await inquirer.prompt([
    {
      type: 'confirm',
      name: 'confirm',
      message: `Khởi tạo Vibecode workspace tại ${process.cwd()}?`,
      default: true
    }
  ]);

  if (confirm) {
    await initCommand({});
  }
}

/**
 * Show help text
 */
function showHelp() {
  console.log(chalk.white(`
📚 VIBECODE COMMANDS

  ${chalk.cyan('Workflow cơ bản:')}
    vibecode init          Khởi tạo workspace
    vibecode start         Bắt đầu intake → blueprint → contract
    vibecode lock          Khoá contract
    vibecode plan          Tạo execution plan
    vibecode build         Build với AI
    vibecode review        Kiểm tra kết quả
    vibecode snapshot      Tạo release

  ${chalk.cyan('Power commands:')}
    vibecode go "..."      Một lệnh, tạo cả project
    vibecode agent "..."   Build project phức tạp tự động
    vibecode debug         Debug thông minh 9 bước
    vibecode assist        Trợ giúp trực tiếp từ AI

  ${chalk.cyan('Khác:')}
    vibecode status        Xem trạng thái
    vibecode config        Cài đặt
    vibecode doctor        Kiểm tra health

📖 Chi tiết: ${chalk.yellow('vibecode <command> --help')}
  `));
}
