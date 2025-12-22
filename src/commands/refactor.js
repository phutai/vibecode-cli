// ═══════════════════════════════════════════════════════════════════════════════
// VIBECODE CLI - Refactor Command
// Phase K4: AI-Powered Refactoring
// ═══════════════════════════════════════════════════════════════════════════════

import { spawn } from 'child_process';
import fs from 'fs/promises';
import path from 'path';
import chalk from 'chalk';
import inquirer from 'inquirer';
import { BackupManager } from '../core/backup.js';

export async function refactorCommand(targetPath, options = {}) {
  const cwd = process.cwd();

  // Interactive mode
  if (!targetPath && !options.type) {
    return interactiveRefactor(cwd);
  }

  return performRefactor(cwd, targetPath || 'src/', options);
}

async function interactiveRefactor(cwd) {
  console.log(chalk.cyan(`
╭────────────────────────────────────────────────────────────────────╮
│  🔄 AI REFACTORING                                                 │
│                                                                    │
│  Improve code quality with AI-powered refactoring                 │
│                                                                    │
╰────────────────────────────────────────────────────────────────────╯
  `));

  const { refactorType } = await inquirer.prompt([{
    type: 'list',
    name: 'refactorType',
    message: 'What type of refactoring?',
    choices: [
      { name: '🧹 Clean Code - Improve readability', value: 'clean' },
      { name: '🔄 DRY - Remove duplication', value: 'dry' },
      { name: '⚡ Performance - Optimize slow code', value: 'performance' },
      { name: '🏗️  Architecture - Better structure', value: 'architecture' },
      { name: '📦 Modularize - Split large files', value: 'modularize' },
      { name: '🆕 Modernize - Update to modern syntax', value: 'modernize' },
      { name: '🎯 Custom - Describe your own', value: 'custom' },
      { name: '👋 Exit', value: 'exit' }
    ]
  }]);

  if (refactorType === 'exit') return;

  const { targetPath } = await inquirer.prompt([{
    type: 'input',
    name: 'targetPath',
    message: 'Path to refactor:',
    default: 'src/'
  }]);

  let customDescription = '';
  if (refactorType === 'custom') {
    const { desc } = await inquirer.prompt([{
      type: 'input',
      name: 'desc',
      message: 'Describe the refactoring:'
    }]);
    customDescription = desc;
  }

  return performRefactor(cwd, targetPath, { type: refactorType, description: customDescription });
}

async function performRefactor(cwd, targetPath, options) {
  const refactorType = options.type || 'clean';

  // Create backup first
  console.log(chalk.gray('\n  Creating backup before refactoring...\n'));
  const backup = new BackupManager(cwd);
  await backup.createBackup(`refactor-${refactorType}`);

  const prompts = {
    clean: `
# Clean Code Refactoring

Improve code readability:
- Better variable/function names (descriptive, consistent)
- Simplify complex conditions (extract to named variables/functions)
- Extract magic numbers to named constants
- Add meaningful comments where logic is complex
- Improve code formatting and consistency
- Follow language conventions and style guides
- Remove dead code and unused imports
`,
    dry: `
# DRY Refactoring (Don't Repeat Yourself)

Remove code duplication:
- Identify repeated code patterns (3+ occurrences)
- Extract common logic to reusable functions
- Create utility modules for shared functionality
- Use generics/templates where appropriate
- Consolidate similar functions with parameters
- Create higher-order functions for common patterns
`,
    performance: `
# Performance Optimization

Optimize for speed and efficiency:
- Replace O(n²) with O(n) where possible
- Add memoization for expensive computations
- Optimize database queries (N+1 problem)
- Implement lazy loading for large data
- Use efficient data structures (Map/Set vs Array)
- Remove unnecessary re-renders (React)
- Add proper caching strategies
- Optimize loops and iterations
`,
    architecture: `
# Architecture Refactoring

Improve code structure:
- Apply SOLID principles
- Implement proper separation of concerns
- Use dependency injection where appropriate
- Apply appropriate design patterns
- Improve module boundaries
- Better error handling structure
- Create clear interfaces between modules
- Reduce coupling, increase cohesion
`,
    modularize: `
# Modularization

Split large files and improve organization:
- Break large files (>300 lines) into smaller modules
- One component/class per file
- Group related functionality in folders
- Create proper index files for exports
- Improve import structure
- Separate concerns (UI, logic, data)
- Create feature-based folder structure
`,
    modernize: `
# Modernize Code

Update to modern syntax and practices:
- ES6+ features (arrow functions, destructuring, spread)
- async/await instead of callbacks/Promise chains
- Optional chaining (?.) and nullish coalescing (??)
- Modern array methods (map, filter, reduce)
- Template literals instead of string concatenation
- const/let instead of var
- TypeScript improvements (if TS project)
- Modern React patterns (hooks, functional components)
`,
    custom: `
# Custom Refactoring

${options.description || 'Improve the code based on best practices.'}
`
  };

  const prompt = `
${prompts[refactorType]}

## Target Path: ${targetPath}

## Instructions:
1. Analyze the code in the target path
2. Apply the refactoring described above
3. Preserve all functionality (don't break anything!)
4. Make minimal changes to achieve the goal
5. Add comments explaining significant changes

## Safety:
- Run tests after refactoring if available
- Keep backward compatibility
- Don't change public APIs without good reason

Perform the refactoring now.
`;

  const promptFile = path.join(cwd, '.vibecode', 'refactor-prompt.md');
  await fs.mkdir(path.dirname(promptFile), { recursive: true });
  await fs.writeFile(promptFile, prompt);

  console.log(chalk.yellow(`  Refactoring (${refactorType})...\n`));

  await runClaudeCode(prompt, cwd);

  console.log(chalk.green('\n✅ Refactoring complete!'));
  console.log(chalk.gray('  • Run tests to verify changes'));
  console.log(chalk.gray('  • Use `vibecode undo` to revert if needed\n'));
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
