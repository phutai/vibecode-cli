// ═══════════════════════════════════════════════════════════════════════════════
// VIBECODE CLI - Snapshot Command
// ═══════════════════════════════════════════════════════════════════════════════

import chalk from 'chalk';
import ora from 'ora';
import path from 'path';
import inquirer from 'inquirer';
import { exec } from 'child_process';
import { promisify } from 'util';
import { workspaceExists, getProjectName, loadState, saveState } from '../core/workspace.js';
import {
  getCurrentSessionId,
  getCurrentSessionPath,
  writeSessionFile,
  getSessionFilesStatus
} from '../core/session.js';
import { getCurrentState, transitionTo } from '../core/state-machine.js';
import { getSpecHash } from '../core/contract.js';
import { STATES } from '../config/constants.js';
import { getManifestTemplate } from '../config/templates.js';
import { pathExists, readJson, writeJson, appendToFile } from '../utils/files.js';
import { printBox, printError, printSuccess, printWarning, printNextStep } from '../ui/output.js';

const execAsync = promisify(exec);

export async function snapshotCommand(options = {}) {
  try {
    // Check workspace
    if (!await workspaceExists()) {
      printError('No Vibecode workspace found. Run `vibecode init` first.');
      process.exit(1);
    }

    // Check state
    const currentState = await getCurrentState();
    if (currentState !== STATES.REVIEW_PASSED) {
      printError(`Cannot create snapshot in state: ${currentState}`);
      console.log('Review must pass first. Run `vibecode review`.');
      process.exit(1);
    }

    const projectName = await getProjectName();
    const sessionId = await getCurrentSessionId();
    const sessionPath = await getCurrentSessionPath();
    const specHash = await getSpecHash();

    // Determine version bump
    let versionBump = options.major ? 'major' : options.minor ? 'minor' : options.patch ? 'patch' : null;

    if (!versionBump) {
      const { bump } = await inquirer.prompt([
        {
          type: 'list',
          name: 'bump',
          message: 'What type of release is this?',
          choices: [
            { name: 'patch (bug fixes)', value: 'patch' },
            { name: 'minor (new features)', value: 'minor' },
            { name: 'major (breaking changes)', value: 'major' }
          ],
          default: 'patch'
        }
      ]);
      versionBump = bump;
    }

    const spinner = ora('Creating snapshot...').start();

    // Get current version and calculate new version
    let currentVersion = '0.0.0';
    let newVersion = '0.0.1';
    const packageJsonPath = path.join(process.cwd(), 'package.json');

    if (await pathExists(packageJsonPath)) {
      const pkg = await readJson(packageJsonPath);
      currentVersion = pkg.version || '0.0.0';
      newVersion = bumpVersion(currentVersion, versionBump);

      // Update package.json
      spinner.text = 'Updating package.json...';
      pkg.version = newVersion;
      await writeJson(packageJsonPath, pkg);
    }

    // Collect session files
    spinner.text = 'Collecting files...';
    const files = await collectSessionFiles(sessionPath);

    // Generate manifest
    spinner.text = 'Generating manifest...';
    const manifest = getManifestTemplate(
      projectName,
      newVersion,
      specHash,
      sessionId,
      files
    );
    await writeSessionFile('manifest.json', JSON.stringify(manifest, null, 2));

    // Update CHANGELOG
    spinner.text = 'Updating CHANGELOG...';
    await updateChangelog(newVersion, specHash, projectName);

    // Create git tag if git is available
    spinner.text = 'Creating git tag...';
    const gitTagged = await createGitTag(newVersion, specHash);

    // Update state
    const stateData = await loadState();
    stateData.shipped_version = newVersion;
    stateData.shipped_at = new Date().toISOString();
    await saveState(stateData);

    // Transition state
    await transitionTo(STATES.SHIPPED, 'snapshot_created');

    spinner.succeed('Snapshot created!');

    // Success output
    const content = `🚀 SHIPPED!

Project: ${projectName}
Version: ${currentVersion} → ${newVersion}
Spec Hash: ${specHash}
Session: ${sessionId}

Files:
• manifest.json - Release manifest
• CHANGELOG.md - Updated
${gitTagged ? `• Git tag: v${newVersion}` : ''}`;

    console.log();
    printBox(content, { borderColor: 'green' });

    console.log();
    console.log(chalk.cyan('📦 Release Summary:'));
    console.log(chalk.gray(`   Version: ${newVersion}`));
    console.log(chalk.gray(`   Spec Hash: ${specHash}`));
    console.log(chalk.gray(`   Files: ${files.length} session files`));
    if (gitTagged) {
      console.log(chalk.gray(`   Git Tag: v${newVersion}`));
    }

    console.log();
    printSuccess('Your project has been shipped!');

    if (await pathExists(packageJsonPath)) {
      console.log();
      console.log(chalk.cyan('📤 To publish:'));
      console.log(chalk.gray('   npm publish'));
      console.log(chalk.gray('   # or'));
      console.log(chalk.gray('   git push && git push --tags'));
    }

  } catch (error) {
    printError(error.message);
    process.exit(1);
  }
}

function bumpVersion(version, type) {
  const parts = version.split('.').map(Number);

  switch (type) {
    case 'major':
      return `${parts[0] + 1}.0.0`;
    case 'minor':
      return `${parts[0]}.${parts[1] + 1}.0`;
    case 'patch':
    default:
      return `${parts[0]}.${parts[1]}.${parts[2] + 1}`;
  }
}

async function collectSessionFiles(sessionPath) {
  const files = [];
  const fs = await import('fs-extra');

  const sessionFiles = [
    'intake.md',
    'blueprint.md',
    'contract.md',
    'plan.md',
    'coder_pack.md',
    'build_report.md',
    'review_report.md'
  ];

  for (const file of sessionFiles) {
    const filePath = path.join(sessionPath, file);
    if (await pathExists(filePath)) {
      const stat = await fs.default.stat(filePath);
      files.push({
        name: file,
        size: stat.size,
        modified: stat.mtime.toISOString()
      });
    }
  }

  return files;
}

async function updateChangelog(version, specHash, projectName) {
  const changelogPath = path.join(process.cwd(), 'CHANGELOG.md');
  const timestamp = new Date().toISOString().split('T')[0];

  const newEntry = `
## [${version}] - ${timestamp}

### Shipped via Vibecode CLI
- Spec Hash: \`${specHash}\`
- Project: ${projectName}
- Generated by vibecode-cli

---
`;

  if (await pathExists(changelogPath)) {
    const fs = await import('fs-extra');
    const content = await fs.default.readFile(changelogPath, 'utf-8');

    // Insert after the header
    const headerMatch = content.match(/^# .+\n/);
    if (headerMatch) {
      const newContent = headerMatch[0] + newEntry + content.slice(headerMatch[0].length);
      await fs.default.writeFile(changelogPath, newContent, 'utf-8');
    } else {
      await fs.default.writeFile(changelogPath, `# Changelog\n${newEntry}${content}`, 'utf-8');
    }
  } else {
    const fs = await import('fs-extra');
    await fs.default.writeFile(changelogPath, `# Changelog\n${newEntry}`, 'utf-8');
  }
}

async function createGitTag(version, specHash) {
  try {
    // Check if git is available
    await execAsync('git status');

    // Create annotated tag
    const tagMessage = `Release v${version}\n\nSpec Hash: ${specHash}\nGenerated by vibecode-cli`;
    await execAsync(`git tag -a v${version} -m "${tagMessage}"`);

    return true;
  } catch (error) {
    // Git not available or tag failed
    return false;
  }
}
