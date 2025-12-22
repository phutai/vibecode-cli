// ═══════════════════════════════════════════════════════════════════════════════
// VIBECODE CLI - Test Command
// Phase K2: AI Test Generation
// ═══════════════════════════════════════════════════════════════════════════════

import { spawn } from 'child_process';
import fs from 'fs/promises';
import path from 'path';
import chalk from 'chalk';
import inquirer from 'inquirer';

export async function testCommand(targetPath, options = {}) {
  const cwd = process.cwd();

  // Generate tests
  if (options.generate) {
    return generateTests(cwd, targetPath, options);
  }

  // Run tests (pass through to npm test)
  if (options.run) {
    const { exec } = await import('child_process');
    const child = exec('npm test', { cwd });
    child.stdout?.pipe(process.stdout);
    child.stderr?.pipe(process.stderr);
    return new Promise(resolve => child.on('close', resolve));
  }

  // Coverage
  if (options.coverage) {
    const { exec } = await import('child_process');
    const child = exec('npm run test:coverage || npm test -- --coverage', { cwd });
    child.stdout?.pipe(process.stdout);
    child.stderr?.pipe(process.stderr);
    return new Promise(resolve => child.on('close', resolve));
  }

  // Default: show menu
  const { action } = await inquirer.prompt([{
    type: 'list',
    name: 'action',
    message: 'Test options:',
    choices: [
      { name: '🧪 Run tests (npm test)', value: 'run' },
      { name: '✨ Generate tests for file/folder', value: 'generate' },
      { name: '📊 Show coverage', value: 'coverage' },
      { name: '👋 Exit', value: 'exit' }
    ]
  }]);

  if (action === 'run') {
    return testCommand(null, { run: true });
  }
  if (action === 'generate') {
    const { target } = await inquirer.prompt([{
      type: 'input',
      name: 'target',
      message: 'Path to generate tests for:',
      default: 'src/'
    }]);
    return generateTests(cwd, target, options);
  }
  if (action === 'coverage') {
    return testCommand(null, { coverage: true });
  }
}

async function generateTests(cwd, targetPath, options) {
  console.log(chalk.cyan(`
╭────────────────────────────────────────────────────────────────────╮
│  🧪 TEST GENERATION                                                │
│                                                                    │
│  Target: ${(targetPath || 'src/').padEnd(52)}│
│                                                                    │
╰────────────────────────────────────────────────────────────────────╯
  `));

  // Detect test framework
  const framework = await detectTestFramework(cwd);
  console.log(chalk.gray(`  Test framework: ${framework}\n`));

  // Get files to generate tests for
  const files = await getFilesToTest(cwd, targetPath || 'src/');

  if (files.length === 0) {
    console.log(chalk.yellow('  No files found to generate tests for.\n'));
    return;
  }

  console.log(chalk.gray(`  Found ${files.length} files\n`));

  const prompt = `
# Test Generation Request

## Project: ${path.basename(cwd)}
## Test Framework: ${framework}

## Files to Generate Tests For:
${files.map(f => `- ${f}`).join('\n')}

## Instructions:
1. Read each source file
2. Generate comprehensive tests including:
   - Unit tests for each function/method
   - Edge cases (null, undefined, empty, boundary values)
   - Error handling tests
   - Mock external dependencies
   - Integration tests where appropriate

3. Use ${framework} syntax and conventions
4. Follow AAA pattern (Arrange, Act, Assert)
5. Add descriptive test names
6. Include setup/teardown if needed

## Output:
Create test files in __tests__/ or *.test.ts/js format.
For each source file, create corresponding test file.

Generate tests now.
`;

  const promptFile = path.join(cwd, '.vibecode', 'test-gen-prompt.md');
  await fs.mkdir(path.dirname(promptFile), { recursive: true });
  await fs.writeFile(promptFile, prompt);

  console.log(chalk.gray('  Generating tests with Claude Code...\n'));

  await runClaudeCode(prompt, cwd);

  console.log(chalk.green('\n✅ Tests generated!'));
  console.log(chalk.gray('  Run: npm test\n'));
}

async function detectTestFramework(cwd) {
  try {
    const pkgPath = path.join(cwd, 'package.json');
    const pkg = JSON.parse(await fs.readFile(pkgPath, 'utf-8'));
    const deps = { ...pkg.dependencies, ...pkg.devDependencies };

    if (deps.vitest) return 'vitest';
    if (deps.jest) return 'jest';
    if (deps.mocha) return 'mocha';
    if (deps['@testing-library/react']) return 'jest + @testing-library/react';
    if (deps.ava) return 'ava';
    if (deps.tap) return 'tap';
    if (deps.uvu) return 'uvu';

    return 'jest'; // default
  } catch {
    return 'jest';
  }
}

async function getFilesToTest(cwd, targetPath) {
  const files = [];
  const fullPath = path.join(cwd, targetPath);

  async function scan(dir) {
    try {
      const entries = await fs.readdir(dir, { withFileTypes: true });

      for (const entry of entries) {
        if (entry.name.startsWith('.')) continue;
        if (entry.name.includes('.test.') || entry.name.includes('.spec.')) continue;
        if (entry.name === '__tests__') continue;
        if (entry.name === 'node_modules') continue;
        if (entry.name === 'dist' || entry.name === 'build') continue;

        const entryPath = path.join(dir, entry.name);

        if (entry.isDirectory()) {
          await scan(entryPath);
        } else if (/\.(js|ts|jsx|tsx)$/.test(entry.name)) {
          files.push(path.relative(cwd, entryPath));
        }
      }
    } catch {}
  }

  await scan(fullPath);
  return files.slice(0, 20); // Limit
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
