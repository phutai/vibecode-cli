// ═══════════════════════════════════════════════════════════════════════════════
// VIBECODE CLI - Ask Command
// Phase K6: Codebase Q&A
// ═══════════════════════════════════════════════════════════════════════════════

import { spawn } from 'child_process';
import fs from 'fs/promises';
import path from 'path';
import chalk from 'chalk';
import readline from 'readline';

export async function askCommand(question, options = {}) {
  const cwd = process.cwd();

  // If no question, enter interactive mode
  if (!question || question.length === 0) {
    return interactiveAsk(cwd);
  }

  const questionText = Array.isArray(question) ? question.join(' ') : question;
  return answerQuestion(cwd, questionText);
}

async function interactiveAsk(cwd) {
  console.log(chalk.cyan(`
╭────────────────────────────────────────────────────────────────────╮
│  💬 CODEBASE Q&A                                                   │
│                                                                    │
│  Ask anything about your codebase.                                │
│  Type 'exit' to quit.                                             │
│                                                                    │
╰────────────────────────────────────────────────────────────────────╯
  `));

  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
    prompt: chalk.green('ask> ')
  });

  rl.prompt();

  rl.on('line', async (line) => {
    const input = line.trim();

    if (!input) {
      rl.prompt();
      return;
    }

    if (input === 'exit' || input === 'quit' || input === 'q') {
      console.log(chalk.cyan('\n👋 Goodbye!\n'));
      rl.close();
      return;
    }

    await answerQuestion(cwd, input);
    console.log('');
    rl.prompt();
  });

  rl.on('close', () => process.exit(0));
}

async function answerQuestion(cwd, question) {
  console.log(chalk.gray('\n  Analyzing codebase...\n'));

  // Build context
  const projectInfo = await getProjectContext(cwd);

  const prompt = `
# Codebase Question

## Project: ${path.basename(cwd)}
## Type: ${projectInfo.type}

## Project Structure:
${projectInfo.structure}

## Key Files:
${projectInfo.keyFiles.join('\n')}

## Question:
${question}

## Instructions:
1. Analyze the codebase to answer the question
2. Reference specific files and line numbers when applicable
3. Provide code examples if helpful
4. Be concise but thorough
5. If you need to look at specific files, do so

Answer the question now.
`;

  await runClaudeCode(prompt, cwd);
}

async function getProjectContext(cwd) {
  const context = {
    type: 'unknown',
    structure: '',
    keyFiles: []
  };

  // Detect project type
  try {
    const pkgPath = path.join(cwd, 'package.json');
    const pkg = JSON.parse(await fs.readFile(pkgPath, 'utf-8'));
    const deps = { ...pkg.dependencies, ...pkg.devDependencies };

    if (deps.next) context.type = 'Next.js';
    else if (deps.nuxt) context.type = 'Nuxt';
    else if (deps['@angular/core']) context.type = 'Angular';
    else if (deps.react) context.type = 'React';
    else if (deps.vue) context.type = 'Vue';
    else if (deps.svelte) context.type = 'Svelte';
    else if (deps.express) context.type = 'Express';
    else if (deps.fastify) context.type = 'Fastify';
    else if (deps.koa) context.type = 'Koa';
    else if (deps.nestjs || deps['@nestjs/core']) context.type = 'NestJS';
    else context.type = 'Node.js';
  } catch {
    // Check for other project types
    try {
      await fs.access(path.join(cwd, 'Cargo.toml'));
      context.type = 'Rust';
    } catch {}
    try {
      await fs.access(path.join(cwd, 'go.mod'));
      context.type = 'Go';
    } catch {}
    try {
      await fs.access(path.join(cwd, 'requirements.txt'));
      context.type = 'Python';
    } catch {}
  }

  // Get directory structure
  context.structure = await getDirectoryTree(cwd, 3);

  // Get key files
  context.keyFiles = await findKeyFiles(cwd);

  return context;
}

async function getDirectoryTree(dir, depth, prefix = '') {
  if (depth === 0) return '';

  let result = '';

  try {
    const entries = await fs.readdir(dir, { withFileTypes: true });
    const filtered = entries.filter(e =>
      !e.name.startsWith('.') &&
      e.name !== 'node_modules' &&
      e.name !== 'dist' &&
      e.name !== 'build' &&
      e.name !== '.next' &&
      e.name !== 'coverage' &&
      e.name !== '__pycache__'
    );

    for (const entry of filtered.slice(0, 15)) {
      const icon = entry.isDirectory() ? '📁' : '📄';
      result += `${prefix}${icon} ${entry.name}\n`;

      if (entry.isDirectory() && depth > 1) {
        result += await getDirectoryTree(
          path.join(dir, entry.name),
          depth - 1,
          prefix + '  '
        );
      }
    }

    if (filtered.length > 15) {
      result += `${prefix}... and ${filtered.length - 15} more\n`;
    }
  } catch {}

  return result;
}

async function findKeyFiles(cwd) {
  const keyFiles = [];
  const importantFiles = [
    'package.json',
    'tsconfig.json',
    'README.md',
    'CLAUDE.md',
    '.env.example',
    'src/index.ts',
    'src/index.js',
    'src/main.ts',
    'src/main.js',
    'src/app.ts',
    'src/app.js',
    'app/page.tsx',
    'app/layout.tsx',
    'pages/index.tsx',
    'pages/_app.tsx',
    'prisma/schema.prisma',
    'drizzle.config.ts',
    'Dockerfile',
    'docker-compose.yml'
  ];

  for (const file of importantFiles) {
    try {
      await fs.access(path.join(cwd, file));
      keyFiles.push(file);
    } catch {}
  }

  return keyFiles;
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
