// ═══════════════════════════════════════════════════════════════════════════════
// VIBECODE CLI - Docs Command
// Phase K3: AI Documentation Generation
// ═══════════════════════════════════════════════════════════════════════════════

import { spawn } from 'child_process';
import fs from 'fs/promises';
import path from 'path';
import chalk from 'chalk';
import inquirer from 'inquirer';

export async function docsCommand(options = {}) {
  const cwd = process.cwd();

  if (options.generate || options.type) {
    return generateDocs(cwd, options);
  }

  // Interactive menu
  const { action } = await inquirer.prompt([{
    type: 'list',
    name: 'action',
    message: 'Documentation options:',
    choices: [
      { name: '📝 Generate README.md', value: 'readme' },
      { name: '📚 Generate API docs', value: 'api' },
      { name: '🏗️  Generate Architecture docs', value: 'architecture' },
      { name: '💬 Add JSDoc comments', value: 'jsdoc' },
      { name: '📦 Generate all docs', value: 'all' },
      { name: '👋 Exit', value: 'exit' }
    ]
  }]);

  if (action === 'exit') return;

  return generateDocs(cwd, { ...options, type: action });
}

async function generateDocs(cwd, options) {
  const docType = options.type || 'all';

  console.log(chalk.cyan(`
╭────────────────────────────────────────────────────────────────────╮
│  📚 DOCUMENTATION GENERATION                                       │
│                                                                    │
│  Type: ${docType.padEnd(56)}│
│                                                                    │
╰────────────────────────────────────────────────────────────────────╯
  `));

  const prompts = {
    readme: `
# Generate README.md

Analyze this project and generate a comprehensive README.md:

1. **Project Title & Description**: What does this project do?
2. **Features**: Key features list with brief descriptions
3. **Installation**: Step-by-step installation guide
4. **Usage**: Basic usage examples with code snippets
5. **API Reference**: Main functions/endpoints (brief overview)
6. **Configuration**: Environment variables, config files
7. **Contributing**: How to contribute
8. **License**: MIT or detected license

Make it professional, clear, and helpful. Include badges if appropriate.
`,
    api: `
# Generate API Documentation

Analyze the codebase and generate API documentation:

1. For each public function/method:
   - Name, description
   - Parameters with types
   - Return value
   - Example usage
   - Throws/errors

2. For REST endpoints (if any):
   - Method, path
   - Request body
   - Response format
   - Status codes
   - Example requests/responses

3. For React components (if any):
   - Props with types
   - Usage examples

Output in Markdown format suitable for docs site.
Create docs/API.md
`,
    architecture: `
# Generate Architecture Documentation

Analyze and document the architecture:

1. **System Overview**: High-level description
2. **Directory Structure**: Explain each folder's purpose
3. **Core Components**: Main modules and their responsibilities
4. **Data Flow**: How data moves through the system
5. **Dependencies**: Key dependencies and why they're used
6. **Diagrams**: Generate Mermaid diagrams for:
   - Component diagram
   - Sequence diagram for main flows
   - Data model (if applicable)

Output in Markdown with Mermaid blocks.
Create docs/ARCHITECTURE.md
`,
    jsdoc: `
# Add JSDoc Comments

For each function, class, and method in the codebase:

1. Add JSDoc comments with:
   - @description - What it does
   - @param for each parameter with type and description
   - @returns - Return value with type
   - @throws (if applicable)
   - @example - Usage example

2. Add type annotations where missing
3. Don't modify function logic, only add comments
4. Use TypeScript types in JSDoc if .ts files

Apply to all .js/.ts files in src/
`,
    all: `
# Generate Complete Documentation

Create comprehensive documentation:

1. **README.md** - Project overview, installation, usage
2. **docs/API.md** - API reference
3. **docs/ARCHITECTURE.md** - System architecture with diagrams
4. Add JSDoc comments to key source files

Make documentation professional and thorough.
`
  };

  const prompt = prompts[docType] || prompts.all;

  const promptFile = path.join(cwd, '.vibecode', 'docs-prompt.md');
  await fs.mkdir(path.dirname(promptFile), { recursive: true });
  await fs.writeFile(promptFile, prompt);

  console.log(chalk.gray('  Generating documentation with Claude Code...\n'));

  await runClaudeCode(prompt, cwd);

  console.log(chalk.green('\n✅ Documentation generated!\n'));
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
