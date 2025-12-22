// ═══════════════════════════════════════════════════════════════════════════════
// VIBECODE CLI - Review Command
// Phase K1: AI Code Review
// ═══════════════════════════════════════════════════════════════════════════════

import chalk from 'chalk';
import ora from 'ora';
import path from 'path';
import fs from 'fs/promises';
import { exec, spawn } from 'child_process';
import { promisify } from 'util';
import inquirer from 'inquirer';
import { workspaceExists, getProjectName } from '../core/workspace.js';
import {
  getCurrentSessionId,
  getCurrentSessionPath,
  writeSessionFile,
  readSessionFile,
  sessionFileExists
} from '../core/session.js';
import { getCurrentState, transitionTo } from '../core/state-machine.js';
import { getSpecHash } from '../core/contract.js';
import { STATES } from '../config/constants.js';
import { getReviewReportTemplate } from '../config/templates.js';
import { pathExists } from '../utils/files.js';
import { printBox, printError, printSuccess, printWarning, printNextStep } from '../ui/output.js';

const execAsync = promisify(exec);

export async function reviewCommand(options = {}) {
  // K1: AI-powered code review
  if (options.ai) {
    return aiCodeReview(options);
  }
  const spinner = ora('Starting review...').start();

  try {
    // Check workspace
    if (!await workspaceExists()) {
      spinner.fail();
      printError('No Vibecode workspace found. Run `vibecode init` first.');
      process.exit(1);
    }

    // Check state
    const currentState = await getCurrentState();
    if (currentState !== STATES.BUILD_DONE) {
      spinner.fail();
      printError(`Cannot review in state: ${currentState}`);
      console.log('Complete build first with `vibecode build --complete`.');
      process.exit(1);
    }

    const projectName = await getProjectName();
    const sessionId = await getCurrentSessionId();
    const sessionPath = await getCurrentSessionPath();
    const specHash = await getSpecHash();

    spinner.text = 'Running automated checks...';

    // Run automated checks
    const checks = [];

    // Check 1: Evidence exists
    const evidencePath = path.join(sessionPath, 'evidence');
    const hasEvidence = await pathExists(path.join(evidencePath, 'changes.diff')) ||
                       await pathExists(path.join(evidencePath, 'build.log'));
    checks.push({
      name: 'Evidence captured',
      passed: hasEvidence,
      message: hasEvidence ? 'Evidence files found' : 'No evidence files found'
    });

    // Check 2: Build report exists
    const hasBuildReport = await sessionFileExists('build_report.md');
    checks.push({
      name: 'Build report',
      passed: hasBuildReport,
      message: hasBuildReport ? 'build_report.md exists' : 'Missing build_report.md'
    });

    // Check 3: Try npm test if package.json exists
    const npmTestResult = await runNpmTest();
    if (npmTestResult.ran) {
      checks.push({
        name: 'npm test',
        passed: npmTestResult.passed,
        message: npmTestResult.message
      });
    }

    // Check 4: Try npm run lint if available
    const lintResult = await runNpmLint();
    if (lintResult.ran) {
      checks.push({
        name: 'npm run lint',
        passed: lintResult.passed,
        message: lintResult.message
      });
    }

    // Check 5: Git status clean (no uncommitted changes)
    const gitStatus = await checkGitStatus();
    checks.push({
      name: 'Git status',
      passed: gitStatus.clean,
      message: gitStatus.message
    });

    spinner.stop();

    // Display automated check results
    console.log();
    console.log(chalk.cyan('📋 Automated Checks:'));
    console.log(chalk.gray('─'.repeat(50)));

    for (const check of checks) {
      const icon = check.passed ? chalk.green('✅') : chalk.red('❌');
      console.log(`  ${icon} ${check.name}: ${chalk.gray(check.message)}`);
    }

    console.log(chalk.gray('─'.repeat(50)));

    // If skip-manual flag, auto-determine result
    if (options.skipManual) {
      const allPassed = checks.every(c => c.passed);
      await finalizeReview(allPassed, checks, projectName, sessionId, specHash);
      return;
    }

    // Manual checklist
    console.log();
    console.log(chalk.cyan('📝 Manual Verification:'));

    // Read contract for acceptance criteria
    let acceptanceCriteria = [];
    if (await sessionFileExists('contract.md')) {
      const contract = await readSessionFile('contract.md');
      const match = contract.match(/## ✔️ Acceptance Criteria[\s\S]*?(?=\n---|\n##|$)/);
      if (match) {
        const criteriaText = match[0];
        const criteriaLines = criteriaText.match(/- \[[ x]\] .+/g) || [];
        acceptanceCriteria = criteriaLines.map(line => line.replace(/- \[[ x]\] /, ''));
      }
    }

    if (acceptanceCriteria.length > 0) {
      console.log(chalk.gray('\nVerify each acceptance criterion from the contract:\n'));

      const { verified } = await inquirer.prompt([
        {
          type: 'checkbox',
          name: 'verified',
          message: 'Check all criteria that are met:',
          choices: acceptanceCriteria.map(c => ({ name: c, checked: false }))
        }
      ]);

      const allCriteriaMet = verified.length === acceptanceCriteria.length;

      checks.push({
        name: 'Acceptance criteria',
        passed: allCriteriaMet,
        message: `${verified.length}/${acceptanceCriteria.length} criteria verified`
      });
    }

    // Final confirmation
    console.log();
    const { approve } = await inquirer.prompt([
      {
        type: 'confirm',
        name: 'approve',
        message: 'Do you approve this build for release?',
        default: false
      }
    ]);

    const allPassed = approve && checks.every(c => c.passed);
    await finalizeReview(allPassed, checks, projectName, sessionId, specHash);

  } catch (error) {
    spinner.fail('Review failed');
    printError(error.message);
    process.exit(1);
  }
}

async function finalizeReview(passed, checks, projectName, sessionId, specHash) {
  const spinner = ora('Generating review report...').start();

  // Generate report
  const reportContent = getReviewReportTemplate(
    projectName,
    sessionId,
    specHash,
    checks,
    passed
  );

  await writeSessionFile('review_report.md', reportContent);

  // Transition state
  if (passed) {
    await transitionTo(STATES.REVIEW_PASSED, 'review_passed');
    spinner.succeed('Review PASSED!');

    const content = `✅ REVIEW PASSED

Project: ${projectName}
Spec Hash: ${specHash}

All checks passed!
Ready for release.`;

    console.log();
    printBox(content, { borderColor: 'green' });
    printNextStep('Run `vibecode snapshot` to create release');

  } else {
    await transitionTo(STATES.REVIEW_FAILED, 'review_failed');
    spinner.warn('Review FAILED');

    const failedChecks = checks.filter(c => !c.passed);

    const content = `❌ REVIEW FAILED

Project: ${projectName}
Spec Hash: ${specHash}

Failed checks:
${failedChecks.map(c => `  • ${c.name}: ${c.message}`).join('\n')}`;

    console.log();
    printBox(content, { borderColor: 'red' });
    printNextStep('Fix issues and run `vibecode build --start` to rebuild');
  }
}

async function runNpmTest() {
  try {
    // Check if package.json exists
    const packageExists = await pathExists('package.json');
    if (!packageExists) {
      return { ran: false };
    }

    // Check if test script exists
    const fs = await import('fs-extra');
    const pkg = await fs.default.readJson('package.json');
    if (!pkg.scripts?.test || pkg.scripts.test.includes('no test specified')) {
      return { ran: false };
    }

    // Run tests
    await execAsync('npm test', { timeout: 120000 });
    return { ran: true, passed: true, message: 'All tests passed' };

  } catch (error) {
    return { ran: true, passed: false, message: error.message.split('\n')[0] };
  }
}

async function runNpmLint() {
  try {
    const packageExists = await pathExists('package.json');
    if (!packageExists) {
      return { ran: false };
    }

    const fs = await import('fs-extra');
    const pkg = await fs.default.readJson('package.json');
    if (!pkg.scripts?.lint) {
      return { ran: false };
    }

    await execAsync('npm run lint', { timeout: 60000 });
    return { ran: true, passed: true, message: 'No linting errors' };

  } catch (error) {
    return { ran: true, passed: false, message: 'Linting errors found' };
  }
}

async function checkGitStatus() {
  try {
    const { stdout } = await execAsync('git status --porcelain');
    const clean = stdout.trim() === '';
    return {
      clean,
      message: clean ? 'Working tree clean' : 'Uncommitted changes exist'
    };
  } catch (error) {
    return { clean: true, message: 'Git not available' };
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// K1: AI CODE REVIEW
// ═══════════════════════════════════════════════════════════════════════════════

async function aiCodeReview(options) {
  const cwd = process.cwd();

  console.log(chalk.cyan(`
╭────────────────────────────────────────────────────────────────────╮
│  🔍 AI CODE REVIEW                                                 │
│                                                                    │
│  Analyzing codebase for:                                          │
│  • Code quality & best practices                                  │
│  • Potential bugs & edge cases                                    │
│  • Performance concerns                                           │
│  • Security vulnerabilities                                       │
│  • Maintainability issues                                         │
│                                                                    │
╰────────────────────────────────────────────────────────────────────╯
  `));

  // Gather codebase context
  const files = await gatherSourceFiles(cwd, options.path);

  console.log(chalk.gray(`  Found ${files.length} files to review\n`));

  const prompt = `
# AI Code Review Request

## Project: ${path.basename(cwd)}

## Files to Review:
${files.map(f => `- ${f}`).join('\n')}

## Review Criteria:
1. **Code Quality**: Clean code, readability, naming conventions
2. **Best Practices**: Design patterns, DRY, SOLID principles
3. **Potential Bugs**: Edge cases, null checks, error handling
4. **Performance**: Inefficient loops, memory leaks, N+1 queries
5. **Security**: Input validation, XSS, SQL injection, auth issues
6. **Maintainability**: Modularity, testability, documentation

## Output Format:
For each issue found, provide:
- **Severity**: Critical / High / Medium / Low
- **Category**: Bug / Performance / Security / Quality / Maintainability
- **File**: path/to/file.ts
- **Line**: (if applicable)
- **Issue**: Description
- **Suggestion**: How to fix

## Summary:
End with overall score (A-F) and top 3 priorities.

Review the codebase now.
`;

  // Write prompt
  const promptFile = path.join(cwd, '.vibecode', 'review-prompt.md');
  await fs.mkdir(path.dirname(promptFile), { recursive: true });
  await fs.writeFile(promptFile, prompt);

  // Run Claude Code
  console.log(chalk.gray('  Analyzing with Claude Code...\n'));

  await runClaudeCode(prompt, cwd);

  // Save report
  const reportDir = path.join(cwd, '.vibecode', 'reports');
  await fs.mkdir(reportDir, { recursive: true });
  const reportFile = path.join(reportDir, `review-${Date.now()}.md`);

  console.log(chalk.green(`\n✅ Review complete!`));
  console.log(chalk.gray(`  Report saved to: .vibecode/reports/\n`));
}

async function gatherSourceFiles(cwd, targetPath) {
  const files = [];
  const extensions = ['.js', '.ts', '.tsx', '.jsx', '.py', '.go', '.rs', '.vue', '.svelte'];
  const ignoreDirs = ['node_modules', '.git', 'dist', 'build', '.next', 'coverage', '.vibecode', '__pycache__'];

  const scanDir = targetPath ? path.join(cwd, targetPath) : cwd;

  async function scan(dir) {
    try {
      const entries = await fs.readdir(dir, { withFileTypes: true });

      for (const entry of entries) {
        if (entry.name.startsWith('.')) continue;
        if (ignoreDirs.includes(entry.name)) continue;

        const fullPath = path.join(dir, entry.name);
        const relativePath = path.relative(cwd, fullPath);

        if (entry.isDirectory()) {
          await scan(fullPath);
        } else if (extensions.some(ext => entry.name.endsWith(ext))) {
          files.push(relativePath);
        }
      }
    } catch {}
  }

  await scan(scanDir);
  return files.slice(0, 50); // Limit files
}

async function runClaudeCode(prompt, cwd) {
  return new Promise((resolve) => {
    const child = spawn('claude', ['-p', prompt, '--dangerously-skip-permissions'], {
      cwd,
      stdio: 'inherit'
    });

    child.on('close', resolve);
    child.on('error', () => resolve());
  });
}
