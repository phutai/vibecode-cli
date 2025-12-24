// ═══════════════════════════════════════════════════════════════════════════════
// VIBECODE CLI - Images Command
// AI-powered image generation and management
// ═══════════════════════════════════════════════════════════════════════════════

import chalk from 'chalk';
import path from 'path';
import inquirer from 'inquirer';
import {
  ImageService,
  createImageService,
  searchImages,
  generateImages,
  getCuratedCollection,
  CURATED_COLLECTIONS
} from '../services/image-service.js';

/**
 * Images command entry point
 */
export async function imagesCommand(query, options = {}) {
  const cwd = process.cwd();

  // List generated images
  if (options.list) {
    return listImages(cwd);
  }

  // Search mode
  if (options.search || query) {
    return searchAndDisplay(query || options.search, options);
  }

  // Replace placeholders
  if (options.replace) {
    return replacePlaceholders(cwd, options);
  }

  // Generate hero image
  if (options.hero) {
    return generateHeroImage(cwd, options);
  }

  // Generate product images
  if (options.products) {
    return generateProductImages(cwd, parseInt(options.products) || 6, options);
  }

  // Generate full image set
  if (options.generate) {
    return generateFullSet(cwd, options);
  }

  // Default: interactive mode
  return interactiveMode(cwd, options);
}

/**
 * Search and display images
 */
async function searchAndDisplay(query, options = {}) {
  console.log(chalk.cyan(`\n  🔍 Searching for "${query}"...\n`));

  const service = createImageService({ verbose: true });
  const images = await service.searchImages(query, {
    count: parseInt(options.count) || 8,
    orientation: options.orientation || 'landscape'
  });

  if (images.length === 0) {
    console.log(chalk.yellow('  No images found.\n'));
    return;
  }

  console.log(chalk.green(`  Found ${images.length} images:\n`));

  for (let i = 0; i < images.length; i++) {
    const img = images[i];
    console.log(chalk.white(`  ${i + 1}. ${img.alt || 'Image'}`));
    console.log(chalk.gray(`     ${img.url}`));
    console.log(chalk.gray(`     by ${img.photographer}\n`));
  }

  // Offer to download
  const { download } = await inquirer.prompt([{
    type: 'confirm',
    name: 'download',
    message: 'Download these images?',
    default: false
  }]);

  if (download) {
    const downloadPath = path.join(process.cwd(), 'public', 'images');
    console.log(chalk.cyan(`\n  Downloading to ${downloadPath}...\n`));

    for (let i = 0; i < images.length; i++) {
      try {
        const filename = `${query.replace(/\s+/g, '-')}-${i + 1}.jpg`;
        await service.downloadImage(images[i].url, filename, { directory: downloadPath });
        console.log(chalk.green(`    ✓ ${filename}`));
      } catch (error) {
        console.log(chalk.red(`    ✗ Failed: ${error.message}`));
      }
    }

    console.log(chalk.green(`\n  ✅ Download complete!\n`));
  }
}

/**
 * Replace placeholder images in project
 */
async function replacePlaceholders(projectPath, options = {}) {
  console.log(chalk.cyan(`
╭────────────────────────────────────────────────────────────────────╮
│  🔄 REPLACING PLACEHOLDER IMAGES                                   │
╰────────────────────────────────────────────────────────────────────╯
  `));

  const service = createImageService({ verbose: true });
  const result = await service.replacePlaceholders(projectPath);

  if (result.replacedCount === 0) {
    console.log(chalk.yellow('  No placeholder images found to replace.\n'));
  } else {
    console.log(chalk.green(`  ✅ Replaced ${result.replacedCount} placeholder images!\n`));
  }
}

/**
 * Generate hero image for project
 */
async function generateHeroImage(projectPath, options = {}) {
  console.log(chalk.cyan(`
╭────────────────────────────────────────────────────────────────────╮
│  🖼️  GENERATING HERO IMAGE                                         │
╰────────────────────────────────────────────────────────────────────╯
  `));

  const theme = options.theme || 'tech';
  const result = await generateImages(projectPath, 'web', {
    hero: true,
    products: 0,
    team: 0,
    testimonials: 0,
    theme
  });

  if (result.downloaded.length > 0) {
    console.log(chalk.green(`  ✅ Hero image generated!`));
    console.log(chalk.gray(`     Path: public/images/${result.downloaded[0].filename}\n`));
  } else {
    console.log(chalk.red(`  ❌ Failed to generate hero image.\n`));
  }
}

/**
 * Generate product images
 */
async function generateProductImages(projectPath, count, options = {}) {
  console.log(chalk.cyan(`
╭────────────────────────────────────────────────────────────────────╮
│  📦 GENERATING PRODUCT IMAGES                                      │
╰────────────────────────────────────────────────────────────────────╯
  `));

  const theme = options.theme || 'tech';
  const result = await generateImages(projectPath, 'ecommerce', {
    hero: false,
    products: count,
    team: 0,
    testimonials: 0,
    theme
  });

  const productCount = result.downloaded.filter(d => d.type === 'product').length;
  if (productCount > 0) {
    console.log(chalk.green(`  ✅ ${productCount} product images generated!`));
    console.log(chalk.gray(`     Path: public/images/\n`));
  } else {
    console.log(chalk.red(`  ❌ Failed to generate product images.\n`));
  }
}

/**
 * Generate full image set
 */
async function generateFullSet(projectPath, options = {}) {
  console.log(chalk.cyan(`
╭────────────────────────────────────────────────────────────────────╮
│  📸 GENERATING FULL IMAGE SET                                      │
╰────────────────────────────────────────────────────────────────────╯
  `));

  const theme = options.theme || 'tech';

  const result = await generateImages(projectPath, 'full', {
    hero: true,
    products: parseInt(options.productCount) || 6,
    team: parseInt(options.teamCount) || 4,
    testimonials: parseInt(options.testimonialCount) || 4,
    theme
  });

  const total = result.downloaded.length;
  if (total > 0) {
    console.log(chalk.green(`  ✅ Generated ${total} images!`));
    console.log(chalk.gray(`     Path: public/images/\n`));

    // Summary
    const byType = {};
    for (const item of result.downloaded) {
      byType[item.type] = (byType[item.type] || 0) + 1;
    }

    console.log(chalk.gray('  Summary:'));
    for (const [type, count] of Object.entries(byType)) {
      console.log(chalk.gray(`    - ${type}: ${count}`));
    }
    console.log('');
  } else {
    console.log(chalk.red(`  ❌ Failed to generate images.\n`));
  }
}

/**
 * Interactive mode
 */
async function interactiveMode(projectPath, options = {}) {
  console.log(chalk.cyan(`
╭────────────────────────────────────────────────────────────────────╮
│  📸 VIBECODE IMAGE GENERATOR                                       │
│                                                                    │
│  Generate professional images for your project                     │
╰────────────────────────────────────────────────────────────────────╯
  `));

  const { action } = await inquirer.prompt([{
    type: 'list',
    name: 'action',
    message: 'What would you like to do?',
    choices: [
      { name: '🔍 Search for images', value: 'search' },
      { name: '🖼️  Generate hero image', value: 'hero' },
      { name: '📦 Generate product images', value: 'products' },
      { name: '👥 Generate team photos', value: 'team' },
      { name: '📸 Generate full image set', value: 'full' },
      { name: '🔄 Replace placeholder images', value: 'replace' },
      { name: '📋 Show curated collections', value: 'collections' },
      { name: '👋 Exit', value: 'exit' }
    ]
  }]);

  if (action === 'exit') {
    return;
  }

  if (action === 'search') {
    const { query } = await inquirer.prompt([{
      type: 'input',
      name: 'query',
      message: 'Search query:',
      default: 'tech hero'
    }]);
    return searchAndDisplay(query, options);
  }

  if (action === 'hero') {
    const { theme } = await inquirer.prompt([{
      type: 'list',
      name: 'theme',
      message: 'Select theme:',
      choices: ['tech', 'business', 'creative', 'nature', 'abstract']
    }]);
    return generateHeroImage(projectPath, { ...options, theme });
  }

  if (action === 'products') {
    const { count, theme } = await inquirer.prompt([
      {
        type: 'number',
        name: 'count',
        message: 'Number of product images:',
        default: 6
      },
      {
        type: 'list',
        name: 'theme',
        message: 'Product category:',
        choices: ['tech', 'fashion', 'food', 'lifestyle']
      }
    ]);
    return generateProductImages(projectPath, count, { ...options, theme });
  }

  if (action === 'team') {
    const { count } = await inquirer.prompt([{
      type: 'number',
      name: 'count',
      message: 'Number of team photos:',
      default: 4
    }]);

    const result = await generateImages(projectPath, 'team', {
      hero: false,
      products: 0,
      team: count,
      testimonials: 0
    });

    console.log(chalk.green(`  ✅ ${result.downloaded.length} team photos generated!\n`));
  }

  if (action === 'full') {
    const { theme } = await inquirer.prompt([{
      type: 'list',
      name: 'theme',
      message: 'Select theme:',
      choices: ['tech', 'business', 'creative']
    }]);
    return generateFullSet(projectPath, { ...options, theme });
  }

  if (action === 'replace') {
    return replacePlaceholders(projectPath, options);
  }

  if (action === 'collections') {
    showCollections();
  }
}

/**
 * Show available curated collections
 */
function showCollections() {
  console.log(chalk.cyan(`
╭────────────────────────────────────────────────────────────────────╮
│  📚 CURATED IMAGE COLLECTIONS                                      │
╰────────────────────────────────────────────────────────────────────╯
  `));

  console.log(chalk.white.bold('  Hero Images:'));
  console.log(chalk.gray('    tech, business, creative, nature, abstract'));

  console.log(chalk.white.bold('\n  Product Images:'));
  console.log(chalk.gray('    tech, fashion, food, lifestyle'));

  console.log(chalk.white.bold('\n  People:'));
  console.log(chalk.gray('    team (8 photos), testimonials (6 avatars)'));

  console.log(chalk.white.bold('\n  Backgrounds:'));
  console.log(chalk.gray('    gradient, pattern'));

  console.log(chalk.gray(`
  ─────────────────────────────────────────────────────────────────────

  Usage:
    ${chalk.cyan('vibecode images --search "tech hero"')}      Search images
    ${chalk.cyan('vibecode images --hero --theme tech')}       Generate hero
    ${chalk.cyan('vibecode images --products 6')}              Generate products
    ${chalk.cyan('vibecode images --generate')}                Full image set
    ${chalk.cyan('vibecode images --replace')}                 Replace placeholders

  With go command:
    ${chalk.cyan('vibecode go --template landing-saas --with-images')}
  `));
}

/**
 * List generated images in project
 */
async function listImages(projectPath) {
  const imagesDir = path.join(projectPath, 'public', 'images');

  console.log(chalk.cyan(`
╭────────────────────────────────────────────────────────────────────╮
│  🖼️  GENERATED IMAGES                                              │
╰────────────────────────────────────────────────────────────────────╯
  `));

  try {
    const fs = await import('fs/promises');
    const files = await fs.readdir(imagesDir);
    const images = files.filter(f => /\.(jpg|jpeg|png|webp|gif|svg)$/i.test(f));

    if (images.length === 0) {
      console.log(chalk.gray('  No images found.\n'));
      console.log(chalk.gray(`  Run ${chalk.cyan('vibecode images --generate')} to generate images.\n`));
      return;
    }

    let totalSize = 0;
    for (const img of images) {
      const stats = await fs.stat(path.join(imagesDir, img));
      const size = stats.size / 1024;
      totalSize += size;

      const sizeStr = size >= 1024
        ? `${(size / 1024).toFixed(1)} MB`
        : `${size.toFixed(1)} KB`;

      const icon = img.includes('hero') ? '🖼️ ' :
                   img.includes('product') ? '📦' :
                   img.includes('team') ? '👤' :
                   img.includes('testimonial') ? '💬' :
                   img.includes('bg') ? '🎨' : '📸';

      console.log(chalk.green(`  ${icon} ${img.padEnd(35)} ${sizeStr.padStart(10)}`));
    }

    const totalStr = totalSize >= 1024
      ? `${(totalSize / 1024).toFixed(1)} MB`
      : `${totalSize.toFixed(1)} KB`;

    console.log(chalk.gray(`\n  ─────────────────────────────────────────────────────`));
    console.log(chalk.white(`  Total: ${images.length} images (${totalStr})`));
    console.log(chalk.gray(`  Location: ${imagesDir}\n`));

  } catch (error) {
    console.log(chalk.yellow('  No images directory found.\n'));
    console.log(chalk.gray(`  Run ${chalk.cyan('vibecode images --generate')} to generate images.\n`));
  }
}

/**
 * Auto-generate images for project (called from go.js)
 */
export async function autoGenerateImages(projectPath, options = {}) {
  const {
    template,
    theme = 'tech'
  } = options;

  // Determine what images to generate based on template
  let imageConfig = {
    hero: true,
    products: 0,
    team: 0,
    testimonials: 0,
    theme
  };

  if (template) {
    if (template.includes('ecommerce') || template.includes('shop')) {
      imageConfig.products = 8;
    }
    if (template.includes('saas') || template.includes('landing')) {
      imageConfig.testimonials = 4;
    }
    if (template.includes('agency') || template.includes('portfolio')) {
      imageConfig.team = 4;
    }
    if (template.includes('dashboard')) {
      imageConfig.hero = false; // Dashboards don't need hero images
    }
  }

  try {
    return await generateImages(projectPath, template || 'web', imageConfig);
  } catch (error) {
    console.log(chalk.yellow(`  ⚠ Image generation failed: ${error.message}`));
    return { downloaded: [], failed: [{ error: error.message }] };
  }
}
