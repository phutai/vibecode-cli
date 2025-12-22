// ═══════════════════════════════════════════════════════════════════════════════
// VIBECODE CLI - Migrate Command
// Phase K8: AI-Powered Code Migration
// ═══════════════════════════════════════════════════════════════════════════════

import { spawn } from 'child_process';
import fs from 'fs/promises';
import path from 'path';
import chalk from 'chalk';
import inquirer from 'inquirer';
import { BackupManager } from '../core/backup.js';

export async function migrateCommand(description, options = {}) {
  const cwd = process.cwd();

  // Interactive mode
  if (!description || description.length === 0) {
    return interactiveMigrate(cwd);
  }

  const migrationDesc = Array.isArray(description) ? description.join(' ') : description;
  return performMigration(cwd, migrationDesc, options);
}

async function interactiveMigrate(cwd) {
  console.log(chalk.cyan(`
╭────────────────────────────────────────────────────────────────────╮
│  🔄 CODE MIGRATION                                                 │
│                                                                    │
│  AI-powered code migration and transformation                     │
│                                                                    │
╰────────────────────────────────────────────────────────────────────╯
  `));

  const { migrationType } = await inquirer.prompt([{
    type: 'list',
    name: 'migrationType',
    message: 'What migration do you need?',
    choices: [
      { name: '📘 JavaScript → TypeScript', value: 'js-to-ts' },
      { name: '⚛️  Class Components → Hooks', value: 'class-to-hooks' },
      { name: '🔄 CommonJS → ESM', value: 'cjs-to-esm' },
      { name: '📦 REST → GraphQL', value: 'rest-to-graphql' },
      { name: '🎨 CSS → Tailwind', value: 'css-to-tailwind' },
      { name: '🗄️  Mongoose → Prisma', value: 'mongoose-to-prisma' },
      { name: '⚡ Express → Fastify', value: 'express-to-fastify' },
      { name: '📱 Pages Router → App Router', value: 'pages-to-app' },
      { name: '🧪 Jest → Vitest', value: 'jest-to-vitest' },
      { name: '✏️  Custom migration', value: 'custom' },
      { name: '👋 Exit', value: 'exit' }
    ]
  }]);

  if (migrationType === 'exit') return;

  let migrationDesc = migrationType;

  if (migrationType === 'custom') {
    const { desc } = await inquirer.prompt([{
      type: 'input',
      name: 'desc',
      message: 'Describe your migration:'
    }]);
    migrationDesc = desc;
  }

  const { targetPath } = await inquirer.prompt([{
    type: 'input',
    name: 'targetPath',
    message: 'Path to migrate (leave empty for entire project):',
    default: ''
  }]);

  return performMigration(cwd, migrationDesc, { path: targetPath });
}

async function performMigration(cwd, migrationDesc, options) {
  // Create backup
  console.log(chalk.gray('\n  Creating backup before migration...\n'));
  const backup = new BackupManager(cwd);
  await backup.createBackup(`migrate-${Date.now()}`);

  const migrations = {
    'js-to-ts': `
# JavaScript to TypeScript Migration

Convert JavaScript files to TypeScript:

1. **Setup**
   - Create/update tsconfig.json with appropriate settings
   - Install TypeScript and @types packages

2. **File Conversion**
   - Rename .js files to .ts/.tsx (for React components)
   - Add type annotations to variables, parameters, return values
   - Define interfaces/types for objects and props
   - Fix any TypeScript errors

3. **Best Practices**
   - Use strict mode
   - Avoid 'any' where possible
   - Use enums for constants
   - Add proper generics

4. **Cleanup**
   - Update imports
   - Remove JSDoc type annotations (now in code)
`,
    'class-to-hooks': `
# React Class to Hooks Migration

Convert React class components to functional components with hooks:

1. **Component Conversion**
   - Convert class to function component
   - Replace this.state with useState
   - Replace lifecycle methods:
     - componentDidMount → useEffect(..., [])
     - componentDidUpdate → useEffect
     - componentWillUnmount → useEffect cleanup

2. **Methods & Bindings**
   - Convert class methods to functions
   - Remove .bind(this) calls
   - Use useCallback for memoized callbacks

3. **Refs & Context**
   - Replace createRef with useRef
   - Replace this.context with useContext

4. **State Management**
   - Use useReducer for complex state
   - Lift state or use context where appropriate
`,
    'cjs-to-esm': `
# CommonJS to ES Modules Migration

Convert CommonJS to ESM:

1. **Syntax Changes**
   - Replace require() with import
   - Replace module.exports with export
   - Replace exports.x with export const x

2. **Package.json**
   - Add "type": "module"
   - Update main/exports fields

3. **File Extensions**
   - Ensure .js extensions in imports (or configure bundler)

4. **Dynamic Imports**
   - Replace require() in conditionals with import()
   - Handle __dirname, __filename with import.meta.url
`,
    'rest-to-graphql': `
# REST to GraphQL Migration

Convert REST API to GraphQL:

1. **Schema Design**
   - Create GraphQL types from REST response shapes
   - Design queries for GET endpoints
   - Design mutations for POST/PUT/DELETE

2. **Server Setup**
   - Set up Apollo Server or similar
   - Create resolvers for each query/mutation
   - Connect to existing data sources

3. **Client Migration**
   - Replace fetch/axios calls with GraphQL queries
   - Set up Apollo Client or urql
   - Use generated types if TypeScript
`,
    'css-to-tailwind': `
# CSS to Tailwind Migration

Convert CSS/SCSS to Tailwind classes:

1. **Setup**
   - Install and configure Tailwind CSS
   - Set up tailwind.config.js

2. **Conversion**
   - Replace CSS properties with Tailwind utilities
   - Convert custom values to Tailwind config
   - Handle responsive designs with breakpoint prefixes

3. **Components**
   - Use @apply for repeated patterns
   - Create component classes where needed
   - Remove unused CSS

4. **Cleanup**
   - Remove old CSS files
   - Update build process
`,
    'mongoose-to-prisma': `
# Mongoose to Prisma Migration

Convert Mongoose ODM to Prisma ORM:

1. **Schema Migration**
   - Create Prisma schema from Mongoose models
   - Convert types (ObjectId → String with @id)
   - Define relations explicitly

2. **Query Migration**
   - Replace Model.find() with prisma.model.findMany()
   - Replace Model.findById() with prisma.model.findUnique()
   - Update create/update/delete operations

3. **Setup**
   - Configure Prisma client
   - Set up migrations
   - Handle connection pooling
`,
    'express-to-fastify': `
# Express to Fastify Migration

Convert Express.js to Fastify:

1. **App Setup**
   - Replace express() with fastify()
   - Update middleware to plugins
   - Configure async handlers (native in Fastify)

2. **Routes**
   - Update route syntax
   - Replace req/res patterns
   - Use schema validation

3. **Middleware**
   - Convert Express middleware to Fastify plugins
   - Update error handling
   - Replace body-parser (built into Fastify)
`,
    'pages-to-app': `
# Next.js Pages to App Router Migration

Convert Pages Router to App Router:

1. **Directory Structure**
   - Move pages/ to app/
   - Create layout.tsx files
   - Convert _app.tsx to root layout

2. **Data Fetching**
   - Replace getServerSideProps with server components
   - Replace getStaticProps with fetch + cache
   - Use generateStaticParams for dynamic routes

3. **Components**
   - Mark client components with 'use client'
   - Keep server components as default
   - Update metadata handling

4. **API Routes**
   - Move to app/api/[route]/route.ts
   - Update to new Route Handlers format
`,
    'jest-to-vitest': `
# Jest to Vitest Migration

Convert Jest tests to Vitest:

1. **Configuration**
   - Create vitest.config.ts
   - Remove jest.config.js
   - Update package.json scripts

2. **Test Files**
   - Update imports from 'vitest'
   - Replace jest.fn() with vi.fn()
   - Replace jest.mock() with vi.mock()
   - Replace jest.spyOn() with vi.spyOn()

3. **Assertions**
   - Most expect() syntax is compatible
   - Update any Jest-specific matchers
`
  };

  const migrationGuide = migrations[migrationDesc] || `
# Custom Migration: ${migrationDesc}

Perform this migration following best practices:
1. Analyze current code structure
2. Plan the migration steps
3. Apply changes incrementally
4. Verify each step works
5. Run tests after migration
`;

  const targetInfo = options.path ? `\n## Target Path: ${options.path}` : '\n## Target: Entire project';

  const prompt = `
${migrationGuide}
${targetInfo}

## Safety Requirements:
1. Preserve all existing functionality
2. Don't lose any data or configuration
3. Make incremental changes when possible
4. Add comments for complex changes
5. Run tests if available

## Instructions:
1. Analyze the codebase
2. Create a migration plan
3. Execute the migration step by step
4. Verify the changes work

Perform the migration now.
`;

  const promptFile = path.join(cwd, '.vibecode', 'migrate-prompt.md');
  await fs.mkdir(path.dirname(promptFile), { recursive: true });
  await fs.writeFile(promptFile, prompt);

  console.log(chalk.yellow(`  Performing migration: ${migrationDesc}\n`));

  await runClaudeCode(prompt, cwd);

  console.log(chalk.green('\n✅ Migration complete!'));
  console.log(chalk.gray('  • Run tests to verify'));
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
