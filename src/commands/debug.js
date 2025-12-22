// ═══════════════════════════════════════════════════════════════════════════════
// VIBECODE CLI - Debug Command
// Phase G: Intelligent 9-Step Bug Fixing
// ═══════════════════════════════════════════════════════════════════════════════

import chalk from 'chalk';
import ora from 'ora';
import path from 'path';
import fs from 'fs-extra';
import readline from 'readline';
import inquirer from 'inquirer';
import { printBox, printError, printSuccess, printWarning, printNextStep } from '../ui/output.js';
import { createDebugEngine } from '../debug/index.js';
import { ImageAnalyzer } from '../debug/image-analyzer.js';

/**
 * Debug Command Entry Point
 * Usage:
 *   vibecode debug                         - Interactive mode (default)
 *   vibecode debug "error description"     - Debug with description
 *   vibecode debug --log                   - Paste error log
 *   vibecode debug --image <path>          - Debug from screenshot
 *   vibecode debug --auto                  - Auto-scan and fix
 */
export async function debugCommand(args = [], options = {}) {
  try {
    const projectPath = process.cwd();

    // Handle image input modes first
    if (options.image) {
      return handleImageDebug(options.image, projectPath, options);
    }

    if (options.clipboard) {
      return handleClipboardDebug(projectPath, options);
    }

    // Parse command arguments
    const input = parseDebugInput(args, options);

    // If interactive mode or no input provided, enter interactive mode
    if (options.interactive || (!input.description && !input.log && !input.image && !input.auto)) {
      return interactiveDebug(projectPath, options);
    }

    // Create debug engine
    const engine = createDebugEngine(projectPath, {
      autoFix: options.autoFix !== false,
      maxAttempts: options.attempts || 3,
      verbose: options.verbose || false,
      interactive: !options.quiet
    });

    // Show intro
    console.log();
    printBox(`🔍 VIBECODE DEBUG

Intelligent 9-Step Bug Fixing
Mode: ${input.auto ? 'Auto-Scan' : input.log ? 'Log Analysis' : input.image ? 'Image Analysis' : 'Description'}
Max Attempts: ${options.attempts || 3}`, { borderColor: 'cyan' });
    console.log();

    // Run debug workflow
    const result = await engine.debug(input);

    // Show final result
    await showDebugResult(result, projectPath);

  } catch (error) {
    printError(`Debug failed: ${error.message}`);
    if (options.verbose) {
      console.error(error.stack);
    }
    process.exit(1);
  }
}

/**
 * Parse debug input from args and options
 */
function parseDebugInput(args, options) {
  const input = {
    description: null,
    log: null,
    image: null,
    auto: options.auto || false
  };

  // Join args as description
  if (args.length > 0) {
    input.description = args.join(' ');
  }

  // Log paste mode
  if (options.log) {
    if (typeof options.log === 'string') {
      input.log = options.log;
    } else {
      // Will need to read from stdin or file
      input.log = options.logContent || null;
    }
  }

  // Image mode
  if (options.image) {
    input.image = options.image;
  }

  return input;
}

/**
 * Show debug result summary
 */
async function showDebugResult(result, projectPath) {
  console.log();

  if (result.status === 'resolved') {
    const content = `✅ BUG FIXED!

Status: ${result.status}
Attempts: ${result.session.attempts}
Steps: ${result.session.steps}

Documentation saved to:
  .vibecode/debug/fixes.md

Prevention rules added to:
  CLAUDE.md`;

    printBox(content, { borderColor: 'green' });
    printNextStep('Build your project to verify the fix');

  } else if (result.status === 'no_error') {
    printSuccess('No errors found to fix!');

  } else if (result.status === 'no_hypothesis') {
    printWarning('Could not determine how to fix this error.');
    console.log(chalk.gray('\nTry:'));
    console.log(chalk.gray('  • Providing more details about the error'));
    console.log(chalk.gray('  • Pasting the full error log with --log'));
    console.log(chalk.gray('  • Running vibecode debug --auto to scan project'));

  } else {
    // Show escalation options - user NEVER bế tắc
    console.log(chalk.yellow(`
╭───────────────────────────────────────────────────────────────────╮
│                                                                   │
│   ⚠️  COULD NOT AUTO-RESOLVE                                      │
│                                                                   │
│   Status: ${result.status.padEnd(47)}│
│   Attempts: ${String(result.session.attempts).padEnd(45)}│
│                                                                   │
│   Don't worry! You have options:                                  │
│                                                                   │
│   1. vibecode assist "describe your issue"                       │
│      → Direct AI expert access with full context                 │
│                                                                   │
│   2. vibecode debug -i                                           │
│      → Interactive debug with more context                       │
│                                                                   │
│   3. vibecode debug --attempts 5                                 │
│      → Retry with more attempts                                  │
│                                                                   │
╰───────────────────────────────────────────────────────────────────╯
`));

    // Ask if user wants to auto-escalate to summon
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout
    });

    try {
      const answer = await new Promise(resolve => {
        rl.question(chalk.cyan('\n🤝 Escalate to AI Assist? (Y/n): '), resolve);
      });
      rl.close();

      if (answer.toLowerCase() !== 'n') {
        const { assistCommand } = await import('./assist.js');
        const errorMsg = result.message || 'the error that occurred';
        await assistCommand([`Fix ${errorMsg}`], {});
      }
    } catch {
      rl.close();
    }
  }
}

/**
 * Handle image file debug
 */
async function handleImageDebug(imagePath, projectPath, options) {
  const analyzer = new ImageAnalyzer(projectPath);

  try {
    const analysis = await analyzer.analyzeImage(imagePath);
    console.log(analyzer.formatAnalysis(analysis));

    // If error detected, ask to fix
    if (analysis.errorType && analysis.suggestedFix) {
      const { fix } = await inquirer.prompt([{
        type: 'confirm',
        name: 'fix',
        message: 'Apply suggested fix?',
        default: true
      }]);

      if (fix) {
        return debugWithAnalysis(analysis, projectPath, options);
      }
    }
  } catch (error) {
    printError(error.message);
  }
}

/**
 * Handle clipboard image debug
 */
async function handleClipboardDebug(projectPath, options) {
  const analyzer = new ImageAnalyzer(projectPath);

  try {
    const analysis = await analyzer.analyzeClipboard();
    console.log(analyzer.formatAnalysis(analysis));

    // If error detected, ask to fix
    if (analysis.errorType && analysis.suggestedFix) {
      const { fix } = await inquirer.prompt([{
        type: 'confirm',
        name: 'fix',
        message: 'Apply suggested fix?',
        default: true
      }]);

      if (fix) {
        return debugWithAnalysis(analysis, projectPath, options);
      }
    }
  } catch (error) {
    printError(error.message);
  }
}

/**
 * Debug with analysis from image
 */
async function debugWithAnalysis(analysis, projectPath, options) {
  // Build error description from analysis
  const errorDescription = [
    analysis.errorType,
    analysis.errorMessage,
    analysis.location ? `at ${analysis.location}` : '',
    analysis.rootCause ? `Cause: ${analysis.rootCause}` : ''
  ].filter(Boolean).join(' - ');

  console.log(chalk.cyan(`\n  Attempting to fix: ${analysis.errorType}\n`));

  // Create debug engine and run
  const engine = createDebugEngine(projectPath, {
    autoFix: true,
    maxAttempts: options.attempts || 3,
    verbose: options.verbose || false,
    interactive: !options.quiet
  });

  const input = {
    description: errorDescription,
    suggestedFix: analysis.suggestedFix,
    fromImage: true
  };

  const result = await engine.debug(input);

  // Show result
  if (result.status === 'resolved') {
    printSuccess('Bug fixed successfully!');
  } else {
    printWarning('Could not auto-fix. Try: vibecode assist "' + analysis.errorMessage + '"');
  }
}

/**
 * Show debug command help
 */
function showDebugHelp() {
  console.log();
  printBox(`🔍 VIBECODE DEBUG - Help

Intelligent 9-step bug fixing powered by AI.

Usage:
  vibecode debug "error description"     Quick fix from description
  vibecode debug --auto                  Auto-scan project for errors
  vibecode debug --log "error text"      Fix from error log
  vibecode debug --image path/to/img     Fix from screenshot
  vibecode debug --clipboard             Fix from clipboard image

Options:
  --auto             Auto-scan mode - find and fix errors
  --log <text>       Provide error log directly
  --image <path>     Provide error screenshot
  --clipboard        Analyze image from clipboard
  --attempts <n>     Max fix attempts (default: 3)
  --verbose          Show detailed output
  --quiet            Minimal output

Examples:
  vibecode debug "Cannot read property of undefined"
  vibecode debug --auto
  vibecode debug --log "TypeError: x is not a function"
  vibecode debug --image ./error-screenshot.png
  vibecode debug --clipboard`, { borderColor: 'cyan' });
  console.log();
}

/**
 * Interactive Debug Mode
 * REPL-like interface for debugging
 */
async function interactiveDebug(projectPath, options) {
  const engine = createDebugEngine(projectPath, {
    autoFix: true,
    maxAttempts: options.attempts || 3,
    verbose: options.verbose || false,
    interactive: true
  });

  // Show welcome banner
  console.log(chalk.cyan(`
╭────────────────────────────────────────────────────────────────────╮
│                                                                    │
│   🔍 VIBECODE DEBUG (Interactive Mode)                             │
│                                                                    │
│   Commands:                                                        │
│   • Type error description or paste log                            │
│   • /scan   - Auto-scan project for errors                         │
│   • /fix    - Apply last suggested fix                             │
│   • /retry  - Retry with current context                           │
│   • /clear  - Clear context                                        │
│   • /help   - Show help                                            │
│   • /quit   - Exit                                                 │
│                                                                    │
╰────────────────────────────────────────────────────────────────────╯
  `));

  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
    prompt: chalk.green('debug> ')
  });

  // Session context
  const context = {
    errors: [],
    lastAnalysis: null,
    lastFix: null,
    lastEvidence: null
  };

  rl.prompt();

  rl.on('line', async (line) => {
    const input = line.trim();

    if (!input) {
      rl.prompt();
      return;
    }

    // Handle commands
    if (input.startsWith('/')) {
      await handleDebugCommand(input, engine, context, rl);
    } else {
      // Treat as error description or log
      await handleDebugInput(input, engine, context);
    }

    rl.prompt();
  });

  rl.on('close', () => {
    console.log(chalk.cyan('\n👋 Debug session ended.\n'));
    process.exit(0);
  });
}

/**
 * Handle debug commands (/scan, /fix, etc.)
 */
async function handleDebugCommand(cmd, engine, context, rl) {
  const command = cmd.toLowerCase().split(' ')[0];

  switch (command) {
    case '/scan':
      console.log(chalk.blue('\n🔍 Scanning project for errors...\n'));
      try {
        const result = await engine.debug({ auto: true });
        context.lastAnalysis = result;
        context.lastEvidence = result.evidence;

        if (result.status === 'resolved') {
          console.log(chalk.green('\n✅ All errors resolved!'));
        } else if (result.status === 'no_error') {
          console.log(chalk.green('\n✅ No errors found!'));
        } else {
          console.log(chalk.yellow('\n⚠️  Some issues found. Use /fix to apply fixes.'));
        }
      } catch (error) {
        console.log(chalk.red(`\nScan error: ${error.message}`));
      }
      break;

    case '/fix':
      if (context.lastAnalysis && context.lastAnalysis.fixPrompt) {
        console.log(chalk.blue('\n🔧 Applying fix...\n'));
        try {
          const fixResult = await engine.applyFix(context.lastAnalysis.fixPrompt);
          if (fixResult.success) {
            console.log(chalk.green('\n✅ Fix applied! Run /scan to verify.'));
          } else {
            console.log(chalk.yellow(`\n⚠️  Fix may have issues: ${fixResult.error || 'Check output above'}`));
          }
        } catch (error) {
          console.log(chalk.red(`\nFix error: ${error.message}`));
        }
      } else if (context.errors.length > 0) {
        // Try to generate fix from accumulated context
        console.log(chalk.blue('\n🔧 Generating fix from context...\n'));
        try {
          const result = await engine.debug({ description: context.errors.join('\n\n') });
          context.lastAnalysis = result;
        } catch (error) {
          console.log(chalk.red(`\nError: ${error.message}`));
        }
      } else {
        console.log(chalk.yellow('\nNo analysis to fix. Run /scan or describe an error first.'));
      }
      break;

    case '/retry':
      if (context.errors.length > 0) {
        console.log(chalk.blue('\n🔄 Retrying with accumulated context...\n'));
        try {
          const result = await engine.debug({ description: context.errors.join('\n\n') });
          context.lastAnalysis = result;
        } catch (error) {
          console.log(chalk.red(`\nRetry error: ${error.message}`));
        }
      } else {
        console.log(chalk.yellow('\nNo context to retry with. Describe an error first.'));
      }
      break;

    case '/clear':
      context.errors = [];
      context.lastAnalysis = null;
      context.lastFix = null;
      context.lastEvidence = null;
      console.log(chalk.green('\n✓ Context cleared.\n'));
      break;

    case '/context':
      console.log(chalk.cyan('\n📋 Current Context:'));
      console.log(chalk.gray(`   Errors collected: ${context.errors.length}`));
      console.log(chalk.gray(`   Last analysis: ${context.lastAnalysis ? 'Yes' : 'No'}`));
      if (context.errors.length > 0) {
        console.log(chalk.gray('\n   Recent errors:'));
        context.errors.slice(-3).forEach((e, i) => {
          console.log(chalk.gray(`   ${i + 1}. ${e.substring(0, 60)}${e.length > 60 ? '...' : ''}`));
        });
      }
      console.log();
      break;

    case '/help':
      console.log(chalk.cyan(`
  Commands:
    /scan     Auto-scan project for errors
    /fix      Apply last suggested fix
    /retry    Retry with accumulated context
    /clear    Clear all context
    /context  Show current context
    /help     Show this help
    /quit     Exit debug mode

  Tips:
    • Paste error messages directly for analysis
    • Describe what's wrong in plain English
    • Use /scan for automatic error detection
    • Context accumulates - use /clear to reset
      `));
      break;

    case '/quit':
    case '/exit':
    case '/q':
      rl.close();
      break;

    default:
      console.log(chalk.yellow(`\nUnknown command: ${cmd}`));
      console.log(chalk.gray('Type /help for available commands.\n'));
  }
}

/**
 * Handle user input (error description or log)
 */
async function handleDebugInput(input, engine, context) {
  // Add to context
  context.errors.push(input);

  // Show spinner
  const spinner = ora('Analyzing error...').start();

  try {
    const result = await engine.debug({ description: input });
    context.lastAnalysis = result;

    spinner.stop();

    if (result.status === 'resolved') {
      console.log(chalk.green('\n✅ Error analyzed and fixed!\n'));
    } else if (result.status === 'no_error') {
      console.log(chalk.green('\n✅ No actionable error found.\n'));
    } else {
      console.log(chalk.yellow('\n⚠️  Analysis complete. Use /fix to apply suggested fix.\n'));

      // Show brief analysis
      if (result.session && result.session.steps > 0) {
        console.log(chalk.gray(`   Steps completed: ${result.session.steps}`));
        console.log(chalk.gray(`   Attempts: ${result.session.attempts}`));
      }
    }
  } catch (error) {
    spinner.stop();
    console.log(chalk.red(`\nAnalysis error: ${error.message}\n`));
  }
}

/**
 * Interactive log paste mode (for future enhancement)
 */
async function interactiveLogMode() {
  console.log(chalk.cyan('Paste your error log below (end with Ctrl+D):'));
  console.log(chalk.gray('---'));

  let logContent = '';

  process.stdin.setEncoding('utf8');

  return new Promise((resolve) => {
    process.stdin.on('data', (chunk) => {
      logContent += chunk;
    });

    process.stdin.on('end', () => {
      console.log(chalk.gray('---'));
      resolve(logContent.trim());
    });
  });
}
