// ═══════════════════════════════════════════════════════════════════════════════
// VIBECODE CLI - Init Command
// ═══════════════════════════════════════════════════════════════════════════════

import ora from 'ora';
import { workspaceExists, createWorkspace, getWorkspacePath } from '../core/workspace.js';
import { printBox, printSuccess, printError, printNextStep } from '../ui/output.js';
import { confirmAction } from '../ui/prompts.js';

export async function initCommand(options = {}) {
  const spinner = ora('Checking workspace...').start();

  try {
    // Check if already exists
    if (await workspaceExists()) {
      spinner.stop();

      if (!options.force) {
        printError('Workspace already exists!');
        console.log();
        console.log('  Use --force to reinitialize (will backup existing)');
        console.log('  Or run `vibecode start` to continue');
        process.exit(1);
      }

      const confirm = await confirmAction('This will overwrite existing workspace. Continue?');
      if (!confirm) {
        console.log('Cancelled.');
        process.exit(0);
      }

      spinner.start('Reinitializing workspace...');
    }

    // Create workspace
    spinner.text = 'Creating workspace...';
    await createWorkspace();

    spinner.succeed('Workspace initialized!');

    // Print success box
    const content = `✅ Vibecode workspace initialized!

Created:
  .vibecode/
  ├── vibecode.yaml
  ├── state.json
  ├── sessions/
  ├── library/
  └── logs/

Spec Hash Reference: 0fe43335f5a325e3279a079ce616c052`;

    printBox(content, { borderColor: 'green' });
    printNextStep('Run `vibecode start` to begin your project');

  } catch (error) {
    spinner.fail('Failed to initialize workspace');
    printError(error.message);
    process.exit(1);
  }
}
