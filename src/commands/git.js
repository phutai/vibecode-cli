/**
 * Git Integration for Vibecode CLI
 * Native git commands with enhanced UI and AI-powered commit messages
 * Phase K7: AI Diff Review
 */

import { exec, spawn } from 'child_process';
import { promisify } from 'util';
import fs from 'fs/promises';
import path from 'path';
import chalk from 'chalk';
import inquirer from 'inquirer';

const execAsync = promisify(exec);

/**
 * Main git command handler
 */
export async function gitCommand(subcommand, args = [], options = {}) {
  // Check if in git repo
  const isGitRepo = await checkGitRepo();
  if (!isGitRepo) {
    console.log(chalk.red('\n  Khong phai git repository.'));
    console.log(chalk.gray('   Chay: git init\n'));
    return;
  }

  // No subcommand = interactive menu
  if (!subcommand) {
    return interactiveGit(options);
  }

  switch (subcommand) {
    case 'status':
    case 's':
      return gitStatus(options);
    case 'commit':
    case 'c':
      return gitCommit(args, options);
    case 'diff':
    case 'd':
      return gitDiff(args, options);
    case 'branch':
    case 'b':
      return gitBranch(args, options);
    case 'push':
      return gitPush(options);
    case 'pull':
      return gitPull(options);
    case 'log':
    case 'l':
      return gitLog(options);
    case 'stash':
      return gitStash(args, options);
    case 'unstash':
      return gitUnstash(options);
    case 'add':
    case 'a':
      return gitAdd(args, options);
    case 'reset':
      return gitReset(args, options);
    case 'checkout':
    case 'co':
      return gitCheckout(args, options);
    default:
      // Pass through to git
      return gitPassthrough(subcommand, args);
  }
}

/**
 * Check if current directory is a git repository
 */
async function checkGitRepo() {
  try {
    await execAsync('git rev-parse --git-dir');
    return true;
  } catch {
    return false;
  }
}

/**
 * Get current git status summary
 */
async function getGitStatus() {
  try {
    const { stdout: branch } = await execAsync('git branch --show-current');
    const { stdout: status } = await execAsync('git status --porcelain');

    const lines = status.trim().split('\n').filter(Boolean);
    const staged = lines.filter(l => l[0] !== ' ' && l[0] !== '?').length;
    const changed = lines.length;
    const untracked = lines.filter(l => l.startsWith('??')).length;

    // Get remote status
    let ahead = 0;
    let behind = 0;
    try {
      const { stdout: remote } = await execAsync('git rev-list --left-right --count HEAD...@{upstream} 2>/dev/null');
      const parts = remote.trim().split('\t');
      ahead = parseInt(parts[0]) || 0;
      behind = parseInt(parts[1]) || 0;
    } catch {
      // No upstream
    }

    return {
      branch: branch.trim() || 'HEAD detached',
      changed,
      staged,
      untracked,
      ahead,
      behind,
      files: lines
    };
  } catch {
    return { branch: 'unknown', changed: 0, staged: 0, untracked: 0, ahead: 0, behind: 0, files: [] };
  }
}

/**
 * Interactive git menu
 */
async function interactiveGit(options) {
  const status = await getGitStatus();

  // Build status line
  let syncStatus = '';
  if (status.ahead > 0) syncStatus += chalk.green(` ${status.ahead}`);
  if (status.behind > 0) syncStatus += chalk.red(` ${status.behind}`);

  console.log(chalk.cyan(`
+----------------------------------------------------------------------+
|  VIBECODE GIT                                                        |
|                                                                      |
|  Branch: ${chalk.green(status.branch.padEnd(54))}|
|  Changes: ${chalk.yellow(String(status.changed).padEnd(10))} Staged: ${chalk.green(String(status.staged).padEnd(10))} Untracked: ${chalk.gray(String(status.untracked).padEnd(7))}|${syncStatus ? `
|  Sync: ${syncStatus.padEnd(58)}|` : ''}
+----------------------------------------------------------------------+
  `));

  const choices = [
    { name: `  Status ${status.changed > 0 ? chalk.yellow(`(${status.changed} changes)`) : chalk.gray('(clean)')}`, value: 'status' },
    { name: '  Commit changes', value: 'commit' },
    { name: '  View diff', value: 'diff' },
    new inquirer.Separator(),
    { name: '  Switch/create branch', value: 'branch' },
    { name: '  Push to remote', value: 'push' },
    { name: '  Pull from remote', value: 'pull' },
    new inquirer.Separator(),
    { name: '  View log', value: 'log' },
    { name: '  Stash changes', value: 'stash' },
    { name: '  Unstash changes', value: 'unstash' },
    new inquirer.Separator(),
    { name: '  Exit', value: 'exit' }
  ];

  const { action } = await inquirer.prompt([{
    type: 'list',
    name: 'action',
    message: 'Select action:',
    choices,
    pageSize: 15
  }]);

  if (action === 'exit') {
    console.log(chalk.gray('\n  Bye!\n'));
    return;
  }

  switch (action) {
    case 'status': await gitStatus(options); break;
    case 'commit': await gitCommit([], options); break;
    case 'diff': await gitDiff([], options); break;
    case 'branch': await gitBranch([], options); break;
    case 'push': await gitPush(options); break;
    case 'pull': await gitPull(options); break;
    case 'log': await gitLog(options); break;
    case 'stash': await gitStash([], options); break;
    case 'unstash': await gitUnstash(options); break;
  }

  // Return to menu
  console.log('');
  const { continueMenu } = await inquirer.prompt([{
    type: 'confirm',
    name: 'continueMenu',
    message: 'Back to git menu?',
    default: true
  }]);

  if (continueMenu) {
    return interactiveGit(options);
  }
}

/**
 * Show git status with colors
 */
async function gitStatus(options) {
  try {
    const { stdout } = await execAsync('git status');

    // Colorize output
    const colored = stdout
      .replace(/modified:/g, chalk.yellow('modified:'))
      .replace(/new file:/g, chalk.green('new file:'))
      .replace(/deleted:/g, chalk.red('deleted:'))
      .replace(/renamed:/g, chalk.blue('renamed:'))
      .replace(/Untracked files:/g, chalk.gray('Untracked files:'))
      .replace(/On branch (\S+)/g, `On branch ${chalk.green('$1')}`)
      .replace(/Your branch is ahead/g, chalk.green('Your branch is ahead'))
      .replace(/Your branch is behind/g, chalk.red('Your branch is behind'))
      .replace(/nothing to commit/g, chalk.green('nothing to commit'));

    console.log('\n' + colored);
  } catch (error) {
    console.log(chalk.red(`\n  Error: ${error.message}\n`));
  }
}

/**
 * Commit changes with optional AI-generated message
 */
async function gitCommit(args, options) {
  const status = await getGitStatus();

  if (status.changed === 0) {
    console.log(chalk.yellow('\n  No changes to commit.\n'));
    return;
  }

  // Show what will be committed
  console.log(chalk.cyan('\n  Files to commit:'));
  for (const file of status.files) {
    const statusCode = file.substring(0, 2);
    const filename = file.substring(3);

    if (statusCode.includes('M')) {
      console.log(chalk.yellow(`   M  ${filename}`));
    } else if (statusCode.includes('A')) {
      console.log(chalk.green(`   A  ${filename}`));
    } else if (statusCode.startsWith('??')) {
      console.log(chalk.gray(`   ?  ${filename}`));
    } else if (statusCode.includes('D')) {
      console.log(chalk.red(`   D  ${filename}`));
    } else if (statusCode.includes('R')) {
      console.log(chalk.blue(`   R  ${filename}`));
    } else {
      console.log(chalk.gray(`   ${statusCode} ${filename}`));
    }
  }
  console.log('');

  let message = args.join(' ');

  // If message provided via -m option
  if (options.message) {
    message = options.message;
  }

  // If no message, generate or ask
  if (!message) {
    const { messageChoice } = await inquirer.prompt([{
      type: 'list',
      name: 'messageChoice',
      message: 'Commit message:',
      choices: [
        { name: '  Enter message manually', value: 'manual' },
        { name: '  AI generate message', value: 'ai' },
        { name: '  Cancel', value: 'cancel' }
      ]
    }]);

    if (messageChoice === 'cancel') {
      console.log(chalk.gray('\n  Cancelled.\n'));
      return;
    }

    if (messageChoice === 'manual') {
      const { manualMessage } = await inquirer.prompt([{
        type: 'input',
        name: 'manualMessage',
        message: 'Enter commit message:',
        validate: (input) => input.length > 0 || 'Message cannot be empty'
      }]);
      message = manualMessage;
    } else {
      // AI generate
      console.log(chalk.gray('\n  Generating commit message...\n'));
      message = await generateCommitMessage(status.files);
      console.log(chalk.cyan(`  Generated: ${chalk.white(message)}\n`));

      const { useGenerated } = await inquirer.prompt([{
        type: 'confirm',
        name: 'useGenerated',
        message: 'Use this message?',
        default: true
      }]);

      if (!useGenerated) {
        const { manualMessage } = await inquirer.prompt([{
          type: 'input',
          name: 'manualMessage',
          message: 'Enter commit message:',
          default: message,
          validate: (input) => input.length > 0 || 'Message cannot be empty'
        }]);
        message = manualMessage;
      }
    }
  }

  // Confirm
  const { confirm } = await inquirer.prompt([{
    type: 'confirm',
    name: 'confirm',
    message: `Commit with message: "${chalk.cyan(message)}"?`,
    default: true
  }]);

  if (!confirm) {
    console.log(chalk.gray('\n  Cancelled.\n'));
    return;
  }

  try {
    // Stage all if --auto or untracked files exist
    if (options.auto || status.untracked > 0) {
      await execAsync('git add -A');
      console.log(chalk.gray('  Staged all changes.'));
    }

    // Commit
    const escapedMessage = message.replace(/"/g, '\\"').replace(/`/g, '\\`');
    await execAsync(`git commit -m "${escapedMessage}"`);

    console.log(chalk.green(`\n  Committed: ${message}\n`));

    // Ask to push
    const { shouldPush } = await inquirer.prompt([{
      type: 'confirm',
      name: 'shouldPush',
      message: 'Push to remote?',
      default: false
    }]);

    if (shouldPush) {
      await gitPush(options);
    }
  } catch (error) {
    if (error.message.includes('nothing to commit')) {
      console.log(chalk.yellow('\n  Nothing to commit. Stage files first with: vibecode git add\n'));
    } else {
      console.log(chalk.red(`\n  Commit failed: ${error.message}\n`));
    }
  }
}

/**
 * Generate commit message based on changed files
 */
async function generateCommitMessage(files) {
  // Get diff for context
  let diffSummary = '';
  try {
    const { stdout } = await execAsync('git diff --stat HEAD 2>/dev/null || git diff --stat --cached');
    diffSummary = stdout;
  } catch {
    // Ignore
  }

  const fileNames = files.map(f => f.substring(3).toLowerCase());

  // Analyze file types
  const hasNewFiles = files.some(f => f.startsWith('A') || f.startsWith('??'));
  const hasModified = files.some(f => f.includes('M'));
  const hasDeleted = files.some(f => f.includes('D'));

  // Detect categories
  const hasTests = fileNames.some(f => f.includes('test') || f.includes('spec'));
  const hasDocs = fileNames.some(f => f.includes('readme') || f.endsWith('.md'));
  const hasConfig = fileNames.some(f => f.includes('config') || f.includes('package.json') || f.includes('.rc'));
  const hasStyles = fileNames.some(f => f.endsWith('.css') || f.endsWith('.scss') || f.endsWith('.less'));
  const hasSrc = fileNames.some(f => f.includes('src/'));

  // Determine type
  let type = 'chore';
  let subject = 'update project';

  if (hasTests && !hasSrc) {
    type = 'test';
    subject = 'update tests';
  } else if (hasDocs && files.length === 1) {
    type = 'docs';
    subject = 'update documentation';
  } else if (hasConfig && files.length <= 2) {
    type = 'chore';
    subject = 'update configuration';
  } else if (hasStyles && !hasSrc) {
    type = 'style';
    subject = 'update styles';
  } else if (hasNewFiles && !hasModified && !hasDeleted) {
    type = 'feat';
    const newFileNames = files.filter(f => f.startsWith('A') || f.startsWith('??')).map(f => f.substring(3));
    if (newFileNames.length === 1) {
      subject = `add ${newFileNames[0].split('/').pop()}`;
    } else {
      subject = 'add new files';
    }
  } else if (hasDeleted && !hasNewFiles && !hasModified) {
    type = 'refactor';
    subject = 'remove unused files';
  } else if (hasModified && files.length === 1) {
    const modifiedFile = files[0].substring(3);
    subject = `update ${modifiedFile.split('/').pop()}`;
  }

  // Extract scope from file paths
  let scope = '';
  const dirs = fileNames.map(f => {
    const parts = f.split('/');
    return parts.length > 1 ? parts[0] : '';
  }).filter(Boolean);

  if (dirs.length > 0) {
    const uniqueDirs = [...new Set(dirs)];
    if (uniqueDirs.length === 1 && uniqueDirs[0] !== 'src') {
      scope = `(${uniqueDirs[0]})`;
    }
  }

  return `${type}${scope}: ${subject}`;
}

/**
 * Show diff with syntax highlighting
 */
async function gitDiff(args, options) {
  // K7: AI diff review
  if (options.review || args.includes('--review')) {
    return aiDiffReview();
  }

  try {
    const file = args[0];
    let cmd = 'git diff';

    if (file && file !== '--review') {
      cmd = `git diff -- "${file}"`;
    } else if (options.staged) {
      cmd = 'git diff --cached';
    }

    const { stdout } = await execAsync(cmd);

    if (!stdout.trim()) {
      console.log(chalk.yellow('\n  No changes to show.\n'));
      if (!options.staged) {
        console.log(chalk.gray('  Tip: Use --staged to see staged changes.\n'));
      }
      return;
    }

    // Colorize diff
    const colored = stdout
      .split('\n')
      .map(line => {
        if (line.startsWith('+') && !line.startsWith('+++')) {
          return chalk.green(line);
        } else if (line.startsWith('-') && !line.startsWith('---')) {
          return chalk.red(line);
        } else if (line.startsWith('@@')) {
          return chalk.cyan(line);
        } else if (line.startsWith('diff ')) {
          return chalk.bold.white('\n' + line);
        } else if (line.startsWith('index ')) {
          return chalk.gray(line);
        }
        return line;
      })
      .join('\n');

    console.log('\n' + colored + '\n');
  } catch (error) {
    console.log(chalk.red(`\n  Error: ${error.message}\n`));
  }
}

/**
 * K7: AI Diff Review
 */
async function aiDiffReview() {
  const cwd = process.cwd();

  console.log(chalk.cyan(`
╭────────────────────────────────────────────────────────────────────╮
│  🔍 AI DIFF REVIEW                                                 │
│                                                                    │
│  Reviewing staged changes...                                      │
│                                                                    │
╰────────────────────────────────────────────────────────────────────╯
  `));

  // Get diff
  let diff = '';
  try {
    const { stdout: stagedDiff } = await execAsync('git diff --staged', { cwd });
    diff = stagedDiff;
  } catch {}

  if (!diff.trim()) {
    // Try unstaged
    try {
      const { stdout: unstagedDiff } = await execAsync('git diff', { cwd });
      diff = unstagedDiff;
    } catch {}
  }

  if (!diff.trim()) {
    console.log(chalk.yellow('\n  No changes to review.\n'));
    return;
  }

  // Truncate diff if too long
  const maxDiffLength = 8000;
  const truncatedDiff = diff.length > maxDiffLength
    ? diff.substring(0, maxDiffLength) + '\n... (truncated)'
    : diff;

  const prompt = `
# Git Diff Review

Review these code changes:

\`\`\`diff
${truncatedDiff}
\`\`\`

## Review Criteria:
1. **Correctness**: Are there any bugs or logic errors?
2. **Best Practices**: Does it follow conventions and patterns?
3. **Security**: Any security concerns introduced?
4. **Performance**: Any performance issues?
5. **Tests**: Should tests be added/updated?
6. **Edge Cases**: Any edge cases not handled?

## Output Format:
1. **Overall Assessment**: (Good / Concerns / Issues)
2. **Specific Feedback**: Per file/change feedback
3. **Suggested Improvements**: What could be better
4. **Recommended Commit Message**: A conventional commit message for these changes

Review the diff now.
`;

  const promptFile = path.join(cwd, '.vibecode', 'diff-review-prompt.md');
  await fs.mkdir(path.dirname(promptFile), { recursive: true });
  await fs.writeFile(promptFile, prompt);

  console.log(chalk.gray('  Reviewing with Claude Code...\n'));

  await runClaudeCode(prompt, cwd);

  console.log(chalk.green('\n✅ Diff review complete!\n'));
}

/**
 * Run Claude Code with prompt
 */
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

/**
 * Branch management
 */
async function gitBranch(args, options) {
  const branchName = args[0];

  if (!branchName) {
    // Show branches
    try {
      const { stdout: branches } = await execAsync('git branch -a');
      const { stdout: current } = await execAsync('git branch --show-current');

      console.log(chalk.cyan('\n  Branches:\n'));

      const lines = branches.split('\n').filter(Boolean);
      const localBranches = [];
      const remoteBranches = [];

      for (const line of lines) {
        const trimmed = line.replace('*', '').trim();
        if (line.includes('remotes/')) {
          remoteBranches.push(trimmed);
        } else {
          localBranches.push(trimmed);
          if (trimmed === current.trim()) {
            console.log(chalk.green(`  * ${trimmed}`));
          } else {
            console.log(`    ${trimmed}`);
          }
        }
      }

      if (remoteBranches.length > 0) {
        console.log(chalk.gray('\n  Remote branches:'));
        for (const rb of remoteBranches.slice(0, 5)) {
          console.log(chalk.gray(`    ${rb}`));
        }
        if (remoteBranches.length > 5) {
          console.log(chalk.gray(`    ... and ${remoteBranches.length - 5} more`));
        }
      }
      console.log('');

      // Ask to switch or create
      const { action } = await inquirer.prompt([{
        type: 'list',
        name: 'action',
        message: 'Action:',
        choices: [
          { name: '  Switch branch', value: 'switch' },
          { name: '  Create new branch', value: 'create' },
          { name: '  Delete branch', value: 'delete' },
          { name: '  Back', value: 'exit' }
        ]
      }]);

      if (action === 'exit') return;

      if (action === 'switch') {
        const { branch } = await inquirer.prompt([{
          type: 'list',
          name: 'branch',
          message: 'Select branch:',
          choices: localBranches.filter(b => b !== current.trim())
        }]);

        await execAsync(`git checkout "${branch}"`);
        console.log(chalk.green(`\n  Switched to ${branch}\n`));
      } else if (action === 'create') {
        const { newBranch } = await inquirer.prompt([{
          type: 'input',
          name: 'newBranch',
          message: 'New branch name:',
          validate: (input) => /^[\w\-\/]+$/.test(input) || 'Invalid branch name'
        }]);

        await execAsync(`git checkout -b "${newBranch}"`);
        console.log(chalk.green(`\n  Created and switched to ${newBranch}\n`));
      } else if (action === 'delete') {
        const deletableBranches = localBranches.filter(b => b !== current.trim());

        if (deletableBranches.length === 0) {
          console.log(chalk.yellow('\n  No branches to delete.\n'));
          return;
        }

        const { branchToDelete } = await inquirer.prompt([{
          type: 'list',
          name: 'branchToDelete',
          message: 'Select branch to delete:',
          choices: deletableBranches
        }]);

        const { confirmDelete } = await inquirer.prompt([{
          type: 'confirm',
          name: 'confirmDelete',
          message: `Delete branch "${branchToDelete}"?`,
          default: false
        }]);

        if (confirmDelete) {
          await execAsync(`git branch -d "${branchToDelete}"`);
          console.log(chalk.green(`\n  Deleted branch ${branchToDelete}\n`));
        }
      }
    } catch (error) {
      console.log(chalk.red(`\n  Error: ${error.message}\n`));
    }
  } else {
    // Create/switch to branch
    try {
      // Check if branch exists
      const { stdout } = await execAsync('git branch');
      const exists = stdout.split('\n').some(b => b.replace('*', '').trim() === branchName);

      if (exists) {
        await execAsync(`git checkout "${branchName}"`);
        console.log(chalk.green(`\n  Switched to ${branchName}\n`));
      } else {
        await execAsync(`git checkout -b "${branchName}"`);
        console.log(chalk.green(`\n  Created and switched to ${branchName}\n`));
      }
    } catch (error) {
      console.log(chalk.red(`\n  Error: ${error.message}\n`));
    }
  }
}

/**
 * Push to remote
 */
async function gitPush(options) {
  try {
    const { stdout: branch } = await execAsync('git branch --show-current');
    const branchName = branch.trim();

    console.log(chalk.cyan(`\n  Pushing to ${branchName}...`));

    // Check if remote exists
    try {
      await execAsync('git remote get-url origin');
    } catch {
      console.log(chalk.yellow('\n  No remote configured.'));
      console.log(chalk.gray('  Run: git remote add origin <url>\n'));
      return;
    }

    // Push with upstream
    const { stdout, stderr } = await execAsync(`git push -u origin "${branchName}" 2>&1`);

    console.log(chalk.green('\n  Push successful!\n'));
    if (stdout) console.log(chalk.gray(stdout));
  } catch (error) {
    if (error.message.includes('rejected')) {
      console.log(chalk.red('\n  Push rejected. Pull first with: vibecode git pull\n'));
    } else {
      console.log(chalk.red(`\n  Push failed: ${error.message}\n`));
    }
  }
}

/**
 * Pull from remote
 */
async function gitPull(options) {
  try {
    console.log(chalk.cyan('\n  Pulling from remote...'));

    const { stdout } = await execAsync('git pull 2>&1');

    if (stdout.includes('Already up to date')) {
      console.log(chalk.green('\n  Already up to date.\n'));
    } else {
      console.log(chalk.green('\n  Pull successful!'));
      console.log(stdout + '\n');
    }
  } catch (error) {
    if (error.message.includes('conflict')) {
      console.log(chalk.red('\n  Merge conflicts detected!'));
      console.log(chalk.gray('  Resolve conflicts and commit.\n'));
    } else {
      console.log(chalk.red(`\n  Pull failed: ${error.message}\n`));
    }
  }
}

/**
 * Show commit log
 */
async function gitLog(options) {
  try {
    const count = options.count || 15;
    const { stdout } = await execAsync(`git log --oneline -${count}`);

    console.log(chalk.cyan('\n  Recent commits:\n'));

    const lines = stdout.split('\n').filter(Boolean);
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const [hash, ...messageParts] = line.split(' ');
      const message = messageParts.join(' ');

      // Highlight conventional commit types
      let formattedMessage = message;
      if (message.startsWith('feat')) {
        formattedMessage = chalk.green('feat') + message.slice(4);
      } else if (message.startsWith('fix')) {
        formattedMessage = chalk.red('fix') + message.slice(3);
      } else if (message.startsWith('docs')) {
        formattedMessage = chalk.blue('docs') + message.slice(4);
      } else if (message.startsWith('refactor')) {
        formattedMessage = chalk.yellow('refactor') + message.slice(8);
      } else if (message.startsWith('test')) {
        formattedMessage = chalk.magenta('test') + message.slice(4);
      } else if (message.startsWith('chore')) {
        formattedMessage = chalk.gray('chore') + message.slice(5);
      }

      console.log(`  ${chalk.yellow(hash)} ${formattedMessage}`);
    }
    console.log('');
  } catch (error) {
    console.log(chalk.red(`\n  Error: ${error.message}\n`));
  }
}

/**
 * Stash changes
 */
async function gitStash(args, options) {
  try {
    const message = args.join(' ');

    // Check if there are changes
    const { stdout: status } = await execAsync('git status --porcelain');
    if (!status.trim()) {
      console.log(chalk.yellow('\n  No changes to stash.\n'));
      return;
    }

    const cmd = message ? `git stash push -m "${message}"` : 'git stash';

    await execAsync(cmd);
    console.log(chalk.green('\n  Changes stashed!\n'));

    // Show stash list
    const { stdout: list } = await execAsync('git stash list');
    if (list.trim()) {
      console.log(chalk.gray('  Current stashes:'));
      const stashes = list.trim().split('\n').slice(0, 3);
      for (const s of stashes) {
        console.log(chalk.gray(`    ${s}`));
      }
      console.log('');
    }
  } catch (error) {
    console.log(chalk.red(`\n  Stash failed: ${error.message}\n`));
  }
}

/**
 * Unstash changes
 */
async function gitUnstash(options) {
  try {
    // List stashes
    const { stdout } = await execAsync('git stash list');

    if (!stdout.trim()) {
      console.log(chalk.yellow('\n  No stashes found.\n'));
      return;
    }

    const stashes = stdout.trim().split('\n');

    console.log(chalk.cyan('\n  Available stashes:\n'));

    const { stash } = await inquirer.prompt([{
      type: 'list',
      name: 'stash',
      message: 'Select stash to apply:',
      choices: stashes.map((s, i) => ({
        name: `  ${s}`,
        value: i
      }))
    }]);

    const { action } = await inquirer.prompt([{
      type: 'list',
      name: 'action',
      message: 'Action:',
      choices: [
        { name: '  Pop (apply and remove)', value: 'pop' },
        { name: '  Apply (keep stash)', value: 'apply' },
        { name: '  Drop (delete stash)', value: 'drop' },
        { name: '  Cancel', value: 'cancel' }
      ]
    }]);

    if (action === 'cancel') return;

    await execAsync(`git stash ${action} stash@{${stash}}`);
    console.log(chalk.green(`\n  Stash ${action} successful!\n`));
  } catch (error) {
    if (error.message.includes('conflict')) {
      console.log(chalk.red('\n  Merge conflicts detected!'));
      console.log(chalk.gray('  Resolve conflicts manually.\n'));
    } else {
      console.log(chalk.red(`\n  Unstash failed: ${error.message}\n`));
    }
  }
}

/**
 * Stage files
 */
async function gitAdd(args, options) {
  try {
    if (args.length === 0 || options.all) {
      await execAsync('git add -A');
      console.log(chalk.green('\n  Staged all changes.\n'));
    } else {
      for (const file of args) {
        await execAsync(`git add "${file}"`);
        console.log(chalk.green(`  Staged: ${file}`));
      }
      console.log('');
    }
  } catch (error) {
    console.log(chalk.red(`\n  Error: ${error.message}\n`));
  }
}

/**
 * Reset staged files
 */
async function gitReset(args, options) {
  try {
    if (args.length === 0) {
      const { confirm } = await inquirer.prompt([{
        type: 'confirm',
        name: 'confirm',
        message: 'Unstage all files?',
        default: true
      }]);

      if (confirm) {
        await execAsync('git reset HEAD');
        console.log(chalk.green('\n  Unstaged all files.\n'));
      }
    } else {
      for (const file of args) {
        await execAsync(`git reset HEAD "${file}"`);
        console.log(chalk.green(`  Unstaged: ${file}`));
      }
      console.log('');
    }
  } catch (error) {
    console.log(chalk.red(`\n  Error: ${error.message}\n`));
  }
}

/**
 * Checkout files
 */
async function gitCheckout(args, options) {
  if (args.length === 0) {
    return gitBranch([], options);
  }

  const target = args[0];

  try {
    // Check if it's a branch
    const { stdout: branches } = await execAsync('git branch');
    const isBranch = branches.split('\n').some(b => b.replace('*', '').trim() === target);

    if (isBranch) {
      await execAsync(`git checkout "${target}"`);
      console.log(chalk.green(`\n  Switched to branch ${target}\n`));
    } else {
      // Assume it's a file - restore it
      const { confirm } = await inquirer.prompt([{
        type: 'confirm',
        name: 'confirm',
        message: `Discard changes to "${target}"?`,
        default: false
      }]);

      if (confirm) {
        await execAsync(`git checkout -- "${target}"`);
        console.log(chalk.green(`\n  Restored: ${target}\n`));
      }
    }
  } catch (error) {
    console.log(chalk.red(`\n  Error: ${error.message}\n`));
  }
}

/**
 * Pass through to native git
 */
async function gitPassthrough(subcommand, args) {
  try {
    const cmd = `git ${subcommand} ${args.join(' ')}`.trim();
    console.log(chalk.gray(`\n  Running: ${cmd}\n`));

    const { stdout, stderr } = await execAsync(cmd);

    if (stdout) console.log(stdout);
    if (stderr) console.log(chalk.yellow(stderr));
  } catch (error) {
    console.log(chalk.red(`\n  Error: ${error.message}\n`));
  }
}

/**
 * Auto-commit after vibecode actions (for integration with other commands)
 */
export async function autoCommit(action, files = []) {
  const isGitRepo = await checkGitRepo();
  if (!isGitRepo) return false;

  try {
    // Check if there are changes
    const { stdout } = await execAsync('git status --porcelain');
    if (!stdout.trim()) return false;

    // Stage and commit
    await execAsync('git add -A');
    await execAsync(`git commit -m "vibecode: ${action}"`);

    console.log(chalk.gray(`\n    Auto-committed: vibecode: ${action}`));
    return true;
  } catch {
    // Silently fail - not critical
    return false;
  }
}

export default gitCommand;
