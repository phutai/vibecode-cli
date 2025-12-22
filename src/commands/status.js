// ═══════════════════════════════════════════════════════════════════════════════
// VIBECODE CLI - Status Command
// ═══════════════════════════════════════════════════════════════════════════════

import chalk from 'chalk';
import {
  workspaceExists,
  loadState,
  getProjectName
} from '../core/workspace.js';
import { getCurrentSessionId, getSessionFilesStatus } from '../core/session.js';
import { getSpecHash } from '../core/contract.js';
import {
  printBox,
  printError,
  printProgress,
  printStatus,
  printNextStep
} from '../ui/output.js';
import { STATES } from '../config/constants.js';

export async function statusCommand(options = {}) {
  try {
    // Check workspace exists
    if (!await workspaceExists()) {
      printError('No Vibecode workspace found.');
      console.log('Run `vibecode init` first.');
      process.exit(1);
    }

    // Load data
    const stateData = await loadState();
    const projectName = await getProjectName();
    const sessionId = await getCurrentSessionId();
    const specHash = await getSpecHash();
    const filesStatus = await getSessionFilesStatus();

    // Output
    if (options.json) {
      console.log(JSON.stringify({
        project: projectName,
        state: stateData.current_state,
        session: sessionId,
        specHash: specHash,
        files: filesStatus
      }, null, 2));
      return;
    }

    // Visual output
    console.log();
    printStatus(projectName, stateData.current_state, sessionId, specHash);
    printProgress(stateData.current_state);

    // Files status
    if (filesStatus) {
      console.log();
      console.log(chalk.cyan('📁 Session Files:'));
      console.log(chalk.gray(`   ├── intake.md ${filesStatus.intake ? '✅' : '⬜'}`));
      console.log(chalk.gray(`   ├── blueprint.md ${filesStatus.blueprint ? '✅' : '⬜'}`));
      console.log(chalk.gray(`   ├── contract.md ${filesStatus.contract ? (specHash ? '🔒' : '📝') : '⬜'}`));
      console.log(chalk.gray(`   ├── plan.md ${filesStatus.plan ? '✅' : '⬜'}`));
      console.log(chalk.gray(`   ├── coder_pack.md ${filesStatus.coderPack ? '✅' : '⬜'}`));
      console.log(chalk.gray(`   ├── build_report.md ${filesStatus.buildReport ? '✅' : '⬜'}`));
      console.log(chalk.gray(`   ├── review_report.md ${filesStatus.reviewReport ? '✅' : '⬜'}`));
      console.log(chalk.gray(`   └── manifest.json ${filesStatus.manifest ? '✅' : '⬜'}`));
    }

    // Next step hint
    const hints = {
      [STATES.INIT]: 'Run `vibecode start` to capture requirements',
      [STATES.INTAKE_CAPTURED]: 'Create blueprint for your project',
      [STATES.BLUEPRINT_DRAFTED]: 'Create contract with deliverables',
      [STATES.CONTRACT_DRAFTED]: 'Run `vibecode lock` to finalize contract',
      [STATES.CONTRACT_LOCKED]: 'Run `vibecode plan` to create execution plan',
      [STATES.PLAN_CREATED]: 'Run `vibecode build --start` to begin building',
      [STATES.BUILD_IN_PROGRESS]: 'Build in progress. Run `vibecode build --complete` when done',
      [STATES.BUILD_DONE]: 'Run `vibecode review` to validate your build',
      [STATES.REVIEW_PASSED]: 'Run `vibecode snapshot` to create release',
      [STATES.REVIEW_FAILED]: 'Fix issues and run `vibecode build --start` to rebuild',
      [STATES.SHIPPED]: 'Project shipped! Start a new session with `vibecode start`',
    };

    printNextStep(hints[stateData.current_state] || 'Continue with your workflow');
    console.log();

  } catch (error) {
    printError(error.message);
    process.exit(1);
  }
}
