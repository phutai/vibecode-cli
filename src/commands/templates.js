// ═══════════════════════════════════════════════════════════════════════════════
// VIBECODE CLI - Templates Command
// Browse and use project templates
// ═══════════════════════════════════════════════════════════════════════════════

import chalk from 'chalk';
import inquirer from 'inquirer';
import {
  TEMPLATES,
  getCategories,
  getTemplatesByCategory,
  searchTemplates,
  getTemplate,
  getCategoryIcon
} from '../templates/index.js';

/**
 * Templates command entry point
 */
export async function templatesCommand(options = {}) {
  // Show template info
  if (options.info) {
    return showTemplateInfo(options.info);
  }

  // Preview template
  if (options.preview) {
    return previewTemplate(options.preview);
  }

  // Search templates
  if (options.search) {
    return searchAndShow(options.search);
  }

  // Default: List all templates
  return listTemplates(options);
}

/**
 * List all templates grouped by category
 */
async function listTemplates(options) {
  const categories = getCategories();
  const totalTemplates = Object.keys(TEMPLATES).length;

  console.log(chalk.cyan(`
╭────────────────────────────────────────────────────────────────────╮
│  📦 VIBECODE TEMPLATE GALLERY                                      │
│                                                                    │
│  ${String(totalTemplates).padEnd(2)} professional templates ready to use                      │
╰────────────────────────────────────────────────────────────────────╯
  `));

  // Group by category
  for (const category of categories) {
    const templates = getTemplatesByCategory(category.id);
    const icon = getCategoryIcon(category.id);

    console.log(chalk.white.bold(`\n  ${icon} ${category.name.toUpperCase()} (${category.count})`));
    console.log(chalk.gray('  ' + '─'.repeat(60)));

    for (const template of templates) {
      const id = chalk.green(template.id.padEnd(22));
      const desc = chalk.gray(truncate(template.description, 40));
      console.log(`    ${id} ${desc}`);
    }
  }

  console.log(chalk.gray(`
  ─────────────────────────────────────────────────────────────────────

  Usage:
    ${chalk.cyan('vibecode templates --info <id>')}        View template details
    ${chalk.cyan('vibecode templates --search <query>')}   Search templates
    ${chalk.cyan('vibecode go --template <id>')}           Use a template
    ${chalk.cyan('vibecode go -t <id> --name "X"')}        With customization

  Example:
    ${chalk.cyan('vibecode go --template landing-saas')}
    ${chalk.cyan('vibecode go -t dashboard-admin --name "My Dashboard"')}
  `));

  // Interactive mode unless quiet
  if (!options.quiet) {
    await interactiveMode();
  }
}

/**
 * Interactive template browser
 */
async function interactiveMode() {
  const { action } = await inquirer.prompt([{
    type: 'list',
    name: 'action',
    message: 'What would you like to do?',
    choices: [
      { name: '📋 View template details', value: 'info' },
      { name: '🚀 Use a template', value: 'use' },
      { name: '🔍 Search templates', value: 'search' },
      { name: '👋 Exit', value: 'exit' }
    ]
  }]);

  if (action === 'exit') {
    return;
  }

  if (action === 'info') {
    const { templateId } = await inquirer.prompt([{
      type: 'list',
      name: 'templateId',
      message: 'Select template to view:',
      choices: Object.values(TEMPLATES).map(t => ({
        name: `${getCategoryIcon(t.category)} ${t.name} - ${truncate(t.description, 35)}`,
        value: t.id
      })),
      pageSize: 15
    }]);
    return showTemplateInfo(templateId);
  }

  if (action === 'use') {
    const { templateId } = await inquirer.prompt([{
      type: 'list',
      name: 'templateId',
      message: 'Select template to use:',
      choices: Object.values(TEMPLATES).map(t => ({
        name: `${getCategoryIcon(t.category)} ${t.name}`,
        value: t.id
      })),
      pageSize: 15
    }]);

    const template = getTemplate(templateId);

    // Ask for customization if template has variables
    let customOptions = {};
    if (Object.keys(template.variables).length > 0) {
      const { customize } = await inquirer.prompt([{
        type: 'confirm',
        name: 'customize',
        message: 'Customize template options?',
        default: false
      }]);

      if (customize) {
        customOptions = await promptForVariables(template);
      }
    }

    console.log(chalk.cyan(`
  ─────────────────────────────────────────────────────────────────────

  Run this command to create your project:

    ${chalk.white.bold(`vibecode go --template ${templateId}${formatCustomOptions(customOptions)}`)}

  `));
  }

  if (action === 'search') {
    const { query } = await inquirer.prompt([{
      type: 'input',
      name: 'query',
      message: 'Search:'
    }]);

    const results = searchTemplates(query);
    if (results.length === 0) {
      console.log(chalk.yellow('\n  No templates found matching your search.\n'));
    } else {
      console.log(chalk.green(`\n  Found ${results.length} template(s):\n`));
      for (const t of results) {
        const icon = getCategoryIcon(t.category);
        console.log(`    ${icon} ${chalk.green(t.id.padEnd(22))} ${chalk.gray(truncate(t.description, 40))}`);
      }
      console.log('');

      // Offer to view details
      const { viewDetails } = await inquirer.prompt([{
        type: 'confirm',
        name: 'viewDetails',
        message: 'View template details?',
        default: true
      }]);

      if (viewDetails && results.length > 0) {
        const { templateId } = await inquirer.prompt([{
          type: 'list',
          name: 'templateId',
          message: 'Select template:',
          choices: results.map(t => ({ name: t.name, value: t.id }))
        }]);
        return showTemplateInfo(templateId);
      }
    }
  }
}

/**
 * Show detailed template information
 */
async function showTemplateInfo(templateId) {
  const template = getTemplate(templateId);

  if (!template) {
    console.log(chalk.red(`\n  ❌ Template "${templateId}" not found.\n`));
    console.log(chalk.gray(`  Run ${chalk.cyan('vibecode templates')} to see available templates.\n`));
    return;
  }

  const icon = getCategoryIcon(template.category);

  console.log(chalk.cyan(`
╭────────────────────────────────────────────────────────────────────╮
│  ${icon} ${template.name.padEnd(56)}│
╰────────────────────────────────────────────────────────────────────╯
  `));

  console.log(chalk.white(`  ${template.description}\n`));

  console.log(chalk.gray('  Category:    ') + chalk.white(template.category));
  console.log(chalk.gray('  Tags:        ') + chalk.cyan(template.tags.join(', ')));
  console.log(chalk.gray('  Stack:       ') + chalk.yellow(template.stack.join(', ')));

  console.log(chalk.gray('\n  Features:'));
  for (const feature of template.features) {
    console.log(chalk.green(`    ✓ ${feature}`));
  }

  // Show customization options
  if (Object.keys(template.variables).length > 0) {
    console.log(chalk.gray('\n  Customization Options:'));
    for (const [key, config] of Object.entries(template.variables)) {
      const typeInfo = config.type === 'select'
        ? `[${config.options.join('|')}]`
        : `(${config.type})`;
      console.log(chalk.yellow(`    --${key}`) + chalk.gray(` ${typeInfo}`));
      console.log(chalk.gray(`      ${config.description}`));
      console.log(chalk.gray(`      Default: "${config.default}"`));
    }
  }

  console.log(chalk.gray(`
  ─────────────────────────────────────────────────────────────────────

  Use this template:
    ${chalk.cyan(`vibecode go --template ${templateId}`)}

  With customization:
    ${chalk.cyan(`vibecode go -t ${templateId} --name "MyProject"`)}
  `));

  // Prompt to use
  const { useNow } = await inquirer.prompt([{
    type: 'confirm',
    name: 'useNow',
    message: 'Use this template now?',
    default: false
  }]);

  if (useNow) {
    // Ask for customization
    let customOptions = {};
    if (Object.keys(template.variables).length > 0) {
      customOptions = await promptForVariables(template);
    }

    // Import and call go command
    const { goCommand } = await import('./go.js');
    await goCommand('', { template: templateId, ...customOptions });
  }
}

/**
 * Prompt user for template variables
 */
async function promptForVariables(template) {
  const questions = [];

  for (const [key, config] of Object.entries(template.variables)) {
    if (config.type === 'select') {
      questions.push({
        type: 'list',
        name: key,
        message: config.description,
        choices: config.options,
        default: config.default
      });
    } else if (config.type === 'boolean') {
      questions.push({
        type: 'confirm',
        name: key,
        message: config.description,
        default: config.default
      });
    } else if (config.type === 'number') {
      questions.push({
        type: 'number',
        name: key,
        message: config.description,
        default: config.default
      });
    } else {
      questions.push({
        type: 'input',
        name: key,
        message: config.description,
        default: config.default
      });
    }
  }

  return inquirer.prompt(questions);
}

/**
 * Search and display results
 */
async function searchAndShow(query) {
  const results = searchTemplates(query);

  if (results.length === 0) {
    console.log(chalk.yellow(`\n  No templates found for "${query}".\n`));
    console.log(chalk.gray(`  Try: landing, dashboard, ecommerce, blog, portfolio, app\n`));
    return;
  }

  console.log(chalk.green(`\n  Found ${results.length} template(s) matching "${query}":\n`));

  for (const t of results) {
    const icon = getCategoryIcon(t.category);
    console.log(`  ${icon} ${chalk.green(t.id.padEnd(22))} ${chalk.gray(truncate(t.description, 40))}`);
  }

  console.log(chalk.gray(`
  ─────────────────────────────────────────────────────────────────────

  View details:
    ${chalk.cyan(`vibecode templates --info ${results[0].id}`)}

  Use template:
    ${chalk.cyan(`vibecode go --template ${results[0].id}`)}
  `));
}

/**
 * Preview template (open in browser)
 */
async function previewTemplate(templateId) {
  const template = getTemplate(templateId);

  if (!template) {
    console.log(chalk.red(`\n  ❌ Template "${templateId}" not found.\n`));
    return;
  }

  console.log(chalk.cyan(`\n  🖼️  Preview: ${template.name}`));
  console.log(chalk.gray(`  URL: ${template.preview}\n`));

  if (template.preview.startsWith('http')) {
    try {
      const open = (await import('open')).default;
      await open(template.preview);
      console.log(chalk.green('  ✓ Opened preview in browser.\n'));
    } catch (e) {
      console.log(chalk.yellow('  ⚠ Could not open browser. Visit URL manually.\n'));
    }
  } else {
    console.log(chalk.gray('  (Preview not available yet)\n'));
  }
}

/**
 * Truncate string to max length
 */
function truncate(str, maxLen) {
  if (str.length <= maxLen) return str;
  return str.substring(0, maxLen - 3) + '...';
}

/**
 * Format custom options for display
 */
function formatCustomOptions(options) {
  const parts = [];
  for (const [key, value] of Object.entries(options)) {
    if (typeof value === 'string') {
      parts.push(`--${key} "${value}"`);
    } else {
      parts.push(`--${key} ${value}`);
    }
  }
  return parts.length > 0 ? ' ' + parts.join(' ') : '';
}
