#!/usr/bin/env node

// ═══════════════════════════════════════════════════════════════════════════════
// VIBECODE CLI - Entry Point
// Spec Hash: 0fe43335f5a325e3279a079ce616c052
// ═══════════════════════════════════════════════════════════════════════════════

import { Command } from 'commander';
import {
  initCommand,
  startCommand,
  statusCommand,
  lockCommand,
  doctorCommand,
  planCommand,
  buildCommand,
  reviewCommand,
  snapshotCommand,
  configCommand,
  goCommand,
  agentCommand,
  debugCommand,
  assistCommand,
  undoCommand,
  learnCommand,
  gitCommand,
  watchCommand,
  shellCommand,
  // Phase K Commands
  testCommand,
  docsCommand,
  refactorCommand,
  securityCommand,
  askCommand,
  migrateCommand,
  VERSION
} from '../src/index.js';

const program = new Command();

program
  .name('vibecode')
  .description('Build software with discipline - AI coding with guardrails')
  .version(VERSION);

// ─────────────────────────────────────────────────────────────────────────────
// Phase A Commands - Planning
// ─────────────────────────────────────────────────────────────────────────────

program
  .command('init')
  .description('Initialize Vibecode workspace in current directory')
  .option('-f, --force', 'Overwrite existing workspace')
  .option('-q, --quiet', 'Minimal output')
  .action(initCommand);

program
  .command('start')
  .description('Start guided Vibecode session')
  .option('-r, --resume', 'Resume existing session')
  .action(startCommand);

program
  .command('status')
  .description('Display current state and progress')
  .option('--json', 'Output as JSON')
  .option('-v, --verbose', 'Show detailed info')
  .action(statusCommand);

program
  .command('lock')
  .description('Lock contract and generate spec hash')
  .option('-d, --dry-run', 'Validate without locking')
  .option('-f, --force', 'Lock even with warnings')
  .action(lockCommand);

program
  .command('doctor')
  .description('Check configuration and diagnose issues')
  .action(doctorCommand);

// ─────────────────────────────────────────────────────────────────────────────
// Phase B Commands - Execution
// ─────────────────────────────────────────────────────────────────────────────

program
  .command('plan')
  .description('Create execution plan from locked contract')
  .action(planCommand);

program
  .command('build')
  .description('Manage build process and capture evidence')
  .option('-s, --start', 'Start the build process')
  .option('-c, --complete', 'Mark build as complete')
  .option('-e, --evidence', 'Capture evidence snapshot')
  .option('-a, --auto', 'Auto-build with Claude Code (--dangerously-skip-permissions)')
  .option('-i, --iterate', 'Iterative build: build-test-fix loop until tests pass')
  .option('-m, --max <n>', 'Max iterations for --iterate mode', parseInt)
  .option('--strict', 'Strict mode: exit with error if tests fail after max iterations')
  .option('--provider <name>', 'Provider to use: claude-code', 'claude-code')
  .action(buildCommand);

program
  .command('review')
  .description('Review build against acceptance criteria')
  .option('--skip-manual', 'Skip manual verification prompts')
  .option('--ai', 'AI-powered code review')
  .option('-p, --path <dir>', 'Specific path to review')
  .action(reviewCommand);

program
  .command('snapshot')
  .description('Create release snapshot with version bump')
  .option('--patch', 'Patch version bump (default)')
  .option('--minor', 'Minor version bump')
  .option('--major', 'Major version bump')
  .action(snapshotCommand);

// ─────────────────────────────────────────────────────────────────────────────
// Phase C Commands - AI Integration
// ─────────────────────────────────────────────────────────────────────────────

program
  .command('config')
  .description('Manage Vibecode configuration')
  .option('--show', 'Show current configuration')
  .option('--provider <name>', 'Set default AI provider')
  .action(configCommand);

// ─────────────────────────────────────────────────────────────────────────────
// Phase E Commands - Magic Mode
// ─────────────────────────────────────────────────────────────────────────────

program
  .command('go <description>')
  .description('Magic mode: one command, full automated build')
  .option('-t, --template <name>', 'Use template (landing, saas, cli, api)')
  .option('-i, --iterate', 'Enable iterative build mode')
  .option('-m, --max <n>', 'Max iterations for iterative mode', parseInt)
  .option('-o, --open', 'Auto-open result when done')
  .action(goCommand);

// ─────────────────────────────────────────────────────────────────────────────
// Phase F Commands - Agent Mode
// ─────────────────────────────────────────────────────────────────────────────

program
  .command('agent <description>')
  .description('Agent mode: autonomous multi-module builder with self-healing')
  .option('-n, --new', 'Create new project directory')
  .option('-v, --verbose', 'Show detailed progress')
  .option('--analyze', 'Analyze project structure without building')
  .option('--status', 'Show agent status and memory stats')
  .option('--report', 'Export memory report to markdown')
  .option('--clear', 'Clear agent memory')
  .option('--force', 'Force operation (for --clear)')
  .option('--json', 'Output as JSON (for --analyze, --status)')
  .option('--max-retries <n>', 'Max retries per module', parseInt)
  .option('--skip-tests', 'Skip tests after each module')
  .option('--continue', 'Continue on module failure')
  .option('--stdout', 'Output report to stdout (for --report)')
  .action(agentCommand);

// ─────────────────────────────────────────────────────────────────────────────
// Phase G Commands - Debug Mode
// ─────────────────────────────────────────────────────────────────────────────

program
  .command('debug [description...]')
  .description('Debug mode: intelligent 9-step bug fixing')
  .option('-i, --interactive', 'Interactive debug session (default if no args)')
  .option('-a, --auto', 'Auto-scan project for errors and fix')
  .option('-l, --log <text>', 'Provide error log directly')
  .option('--image <path>', 'Analyze error from screenshot file')
  .option('--clipboard', 'Analyze error from clipboard image')
  .option('--attempts <n>', 'Max fix attempts (default: 3)', parseInt)
  .option('-v, --verbose', 'Show detailed output')
  .option('-q, --quiet', 'Minimal output')
  .action((description, options) => {
    debugCommand(description || [], options);
  });

program
  .command('assist [prompt...]')
  .alias('expert')
  .description('🤝 AI Assist: Direct Claude Code access with full project context')
  .option('--no-context', 'Skip context injection')
  .action((prompt, options) => {
    assistCommand(prompt || [], options);
  });

// ─────────────────────────────────────────────────────────────────────────────
// Phase H Commands - Undo/Rollback
// ─────────────────────────────────────────────────────────────────────────────

program
  .command('undo')
  .description('⏪ Undo/rollback: Restore files to previous state')
  .option('-l, --list', 'List available backups')
  .option('-s, --step <n>', 'Restore to N steps ago', parseInt)
  .option('-c, --clear', 'Clear all backups')
  .option('-f, --force', 'Force operation without confirmation')
  .action(undoCommand);

// ─────────────────────────────────────────────────────────────────────────────
// Phase H5 Commands - Learning Mode
// ─────────────────────────────────────────────────────────────────────────────

program
  .command('learn')
  .description('🧠 View and manage AI learnings from feedback')
  .option('-s, --stats', 'Show learning statistics')
  .option('-c, --clear', 'Clear all learnings')
  .option('-e, --export', 'Export learnings to file')
  .option('-f, --force', 'Skip confirmation prompts')
  .action(learnCommand);

// ─────────────────────────────────────────────────────────────────────────────
// Phase I Commands - Git Integration
// ─────────────────────────────────────────────────────────────────────────────

program
  .command('git [subcommand] [args...]')
  .description('Git integration - commit, diff, branch, push with enhanced UI')
  .option('-a, --auto', 'Auto-stage all changes before commit')
  .option('-m, --message <msg>', 'Commit message')
  .option('--staged', 'Show only staged changes (for diff)')
  .option('--review', 'AI-powered diff review')
  .option('--count <n>', 'Number of commits to show (for log)', parseInt)
  .option('--all', 'Include all files (for add)')
  .action((subcommand, args, options) => {
    gitCommand(subcommand, args || [], options);
  });

// ─────────────────────────────────────────────────────────────────────────────
// Phase I2 Commands - File Watcher
// ─────────────────────────────────────────────────────────────────────────────

program
  .command('watch')
  .description('Watch mode - auto-test/lint/build on file changes')
  .option('-d, --dir <path>', 'Directory to watch')
  .option('-t, --test', 'Run tests on change')
  .option('-l, --lint', 'Run lint on change')
  .option('-b, --build', 'Run build on change')
  .option('-T, --typecheck', 'Run TypeScript check on change')
  .option('-a, --all', 'Run all checks (test, lint, typecheck)')
  .option('-n, --notify', 'Desktop notifications')
  .option('-i, --immediate', 'Run checks immediately on start')
  .action(watchCommand);

// ─────────────────────────────────────────────────────────────────────────────
// Phase I3 Commands - Shell Mode
// ─────────────────────────────────────────────────────────────────────────────

program
  .command('shell')
  .alias('$')
  .description('Interactive shell with vibecode context and AI assistance')
  .action(shellCommand);

// ─────────────────────────────────────────────────────────────────────────────
// Phase K Commands - Maximize Claude Code
// ─────────────────────────────────────────────────────────────────────────────

program
  .command('test [path]')
  .description('🧪 Test generation and running')
  .option('-g, --generate', 'Generate tests with AI')
  .option('-r, --run', 'Run tests')
  .option('-c, --coverage', 'Show coverage')
  .action(testCommand);

program
  .command('docs')
  .description('📚 Generate documentation with AI')
  .option('-g, --generate', 'Generate docs')
  .option('-t, --type <type>', 'Doc type: readme, api, architecture, jsdoc, all')
  .action(docsCommand);

program
  .command('refactor [path]')
  .description('🔄 AI-powered code refactoring')
  .option('-t, --type <type>', 'Type: clean, dry, performance, architecture, modularize, modernize')
  .option('-d, --description <desc>', 'Custom refactoring description')
  .action(refactorCommand);

program
  .command('security')
  .description('🔒 Security audit with AI analysis')
  .option('-f, --fix', 'Auto-fix security issues')
  .action(securityCommand);

program
  .command('ask [question...]')
  .description('💬 Ask questions about your codebase')
  .action(askCommand);

program
  .command('migrate [description...]')
  .description('🔄 AI-powered code migration')
  .option('-p, --path <path>', 'Specific path to migrate')
  .action(migrateCommand);

// ─────────────────────────────────────────────────────────────────────────────
// Parse - If no command provided, show interactive wizard
// ─────────────────────────────────────────────────────────────────────────────

if (process.argv.length === 2) {
  // No command provided - show interactive wizard
  import('../src/commands/wizard.js').then(m => m.wizardCommand()).catch(err => {
    console.error('Failed to load wizard:', err.message);
    program.help();
  });
} else {
  program.parse();
}
