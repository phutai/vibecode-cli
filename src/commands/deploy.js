// ═══════════════════════════════════════════════════════════════════════════════
// VIBECODE CLI - Deploy Command
// One-command deployment to cloud platforms
// ═══════════════════════════════════════════════════════════════════════════════

import { spawn, exec } from 'child_process';
import { promisify } from 'util';
import fs from 'fs/promises';
import path from 'path';
import chalk from 'chalk';
import inquirer from 'inquirer';
import { notifyDeployComplete } from '../utils/notifications.js';

const execAsync = promisify(exec);

// Supported deployment platforms
const PLATFORMS = {
  vercel: {
    name: 'Vercel',
    icon: '▲',
    cli: 'vercel',
    installCmd: 'npm install -g vercel',
    deployCmd: 'vercel',
    previewCmd: 'vercel',
    prodCmd: 'vercel --prod',
    loginCmd: 'vercel login',
    whoamiCmd: 'vercel whoami',
    configFile: 'vercel.json',
    recommended: true
  },
  netlify: {
    name: 'Netlify',
    icon: '◆',
    cli: 'netlify',
    installCmd: 'npm install -g netlify-cli',
    deployCmd: 'netlify deploy',
    previewCmd: 'netlify deploy',
    prodCmd: 'netlify deploy --prod',
    loginCmd: 'netlify login',
    whoamiCmd: 'netlify status',
    configFile: 'netlify.toml',
    recommended: false
  },
  'github-pages': {
    name: 'GitHub Pages',
    icon: '⬡',
    cli: 'gh',
    installCmd: 'npm install -g gh-pages && brew install gh',
    deployCmd: 'npx gh-pages -d dist',
    previewCmd: null,
    prodCmd: 'npx gh-pages -d dist',
    loginCmd: 'gh auth login',
    whoamiCmd: 'gh auth status',
    configFile: null,
    recommended: false,
    requiresBuild: true,
    buildCmd: 'npm run build'
  },
  railway: {
    name: 'Railway',
    icon: '🚂',
    cli: 'railway',
    installCmd: 'npm install -g @railway/cli',
    deployCmd: 'railway up',
    previewCmd: 'railway up',
    prodCmd: 'railway up',
    loginCmd: 'railway login',
    whoamiCmd: 'railway whoami',
    configFile: 'railway.json',
    recommended: false
  },
  render: {
    name: 'Render',
    icon: '🎨',
    cli: 'render',
    installCmd: 'npm install -g render-cli',
    deployCmd: 'render deploy',
    previewCmd: 'render deploy',
    prodCmd: 'render deploy',
    loginCmd: 'render login',
    whoamiCmd: 'render whoami',
    configFile: 'render.yaml',
    recommended: false
  }
};

/**
 * Deploy command entry point
 */
export async function deployCommand(options = {}) {
  const cwd = process.cwd();

  // Check deployment status
  if (options.status) {
    return showDeploymentStatus(cwd);
  }

  // Show deployment history
  if (options.history) {
    return showDeploymentHistory(cwd);
  }

  // Detect platform from options
  let platform = null;
  if (options.vercel) platform = 'vercel';
  else if (options.netlify) platform = 'netlify';
  else if (options.githubPages) platform = 'github-pages';
  else if (options.railway) platform = 'railway';
  else if (options.render) platform = 'render';

  // Interactive mode if no platform specified
  if (!platform) {
    platform = await selectPlatform();
    if (!platform) return;
  }

  const platformConfig = PLATFORMS[platform];

  console.log(chalk.cyan(`
╭────────────────────────────────────────────────────────────────────╮
│  🚀 VIBECODE DEPLOY                                                │
│                                                                    │
│  Platform: ${(platformConfig.icon + ' ' + platformConfig.name).padEnd(51)}│
│                                                                    │
╰────────────────────────────────────────────────────────────────────╯
  `));

  // Step 1: Check if project is valid
  const isValidProject = await checkProject(cwd);
  if (!isValidProject) {
    console.log(chalk.red('  ❌ No package.json found. Is this a valid project?\n'));
    return;
  }

  // Step 2: Check if CLI is installed
  console.log(chalk.gray('  Checking prerequisites...\n'));
  const cliInstalled = await checkCLI(platformConfig.cli);

  if (!cliInstalled) {
    console.log(chalk.yellow(`  ⚠️ ${platformConfig.name} CLI not found.\n`));

    const { install } = await inquirer.prompt([{
      type: 'confirm',
      name: 'install',
      message: `Install ${platformConfig.name} CLI?`,
      default: true
    }]);

    if (install) {
      const installed = await installCLI(platformConfig);
      if (!installed) return;
    } else {
      console.log(chalk.gray(`\n  Install manually: ${platformConfig.installCmd}\n`));
      return;
    }
  } else {
    console.log(chalk.green(`  ✓ ${platformConfig.name} CLI installed`));
  }

  // Step 3: Check authentication
  const isLoggedIn = await checkAuth(platformConfig);

  if (!isLoggedIn) {
    console.log(chalk.yellow('\n  🔐 Authentication required.\n'));
    const authenticated = await authenticate(platformConfig);
    if (!authenticated) {
      console.log(chalk.red('  ❌ Authentication failed.\n'));
      return;
    }
  } else {
    console.log(chalk.green(`  ✓ Authenticated`));
  }

  // Step 4: Check/Create config
  await ensureConfig(cwd, platform, platformConfig, options);

  // Step 5: Build if needed
  if (platformConfig.requiresBuild) {
    console.log(chalk.yellow('\n  📦 Building project...\n'));
    const buildSuccess = await buildProject(cwd, platformConfig);
    if (!buildSuccess) {
      console.log(chalk.red('  ❌ Build failed. Fix errors and try again.\n'));
      return;
    }
  }

  // Step 6: Deploy
  console.log(chalk.yellow('\n  🚀 Deploying...\n'));

  const isProduction = !options.preview;
  const result = await deploy(cwd, platformConfig, isProduction, options);

  // Step 7: Save deployment info
  await saveDeploymentInfo(cwd, platform, result);

  // Step 8: Send notification if enabled
  if (options.notify) {
    notifyDeployComplete(result.success, platformConfig.name, result.url);
  }

  // Step 9: Show result
  showDeploymentResult(result, platformConfig);

  return result;
}

/**
 * Interactive platform selection
 */
async function selectPlatform() {
  console.log(chalk.cyan(`
╭────────────────────────────────────────────────────────────────────╮
│  🚀 VIBECODE DEPLOY                                                │
│                                                                    │
│  Deploy your project to the cloud                                  │
│                                                                    │
╰────────────────────────────────────────────────────────────────────╯
  `));

  const choices = Object.entries(PLATFORMS).map(([key, config]) => ({
    name: `${config.icon} ${config.name}${config.recommended ? chalk.green(' (Recommended)') : ''}`,
    value: key
  }));

  choices.push({ name: '👋 Cancel', value: null });

  const { platform } = await inquirer.prompt([{
    type: 'list',
    name: 'platform',
    message: 'Select deployment platform:',
    choices
  }]);

  return platform;
}

/**
 * Check if project is valid
 */
async function checkProject(cwd) {
  try {
    await fs.access(path.join(cwd, 'package.json'));
    return true;
  } catch {
    return false;
  }
}

/**
 * Check if CLI tool is installed
 */
async function checkCLI(cli) {
  try {
    await execAsync(`which ${cli}`);
    return true;
  } catch {
    // Also try npx for some tools
    try {
      await execAsync(`npx ${cli} --version`);
      return true;
    } catch {
      return false;
    }
  }
}

/**
 * Install CLI tool
 */
async function installCLI(platformConfig) {
  console.log(chalk.yellow(`\n  📦 Installing ${platformConfig.name} CLI...\n`));

  return new Promise((resolve) => {
    const child = spawn('sh', ['-c', platformConfig.installCmd], {
      stdio: 'inherit'
    });

    child.on('close', (code) => {
      if (code === 0) {
        console.log(chalk.green(`\n  ✅ ${platformConfig.name} CLI installed\n`));
        resolve(true);
      } else {
        console.log(chalk.red(`\n  ❌ Installation failed.`));
        console.log(chalk.gray(`  Try manually: ${platformConfig.installCmd}\n`));
        resolve(false);
      }
    });

    child.on('error', () => {
      console.log(chalk.red(`\n  ❌ Installation failed.`));
      resolve(false);
    });
  });
}

/**
 * Check if user is authenticated
 */
async function checkAuth(platformConfig) {
  if (!platformConfig.whoamiCmd) return true;

  try {
    await execAsync(platformConfig.whoamiCmd);
    return true;
  } catch {
    return false;
  }
}

/**
 * Authenticate with platform
 */
async function authenticate(platformConfig) {
  return new Promise((resolve) => {
    const child = spawn('sh', ['-c', platformConfig.loginCmd], {
      stdio: 'inherit'
    });

    child.on('close', (code) => {
      if (code === 0) {
        console.log(chalk.green('\n  ✅ Authentication complete\n'));
        resolve(true);
      } else {
        resolve(false);
      }
    });

    child.on('error', () => {
      resolve(false);
    });
  });
}

/**
 * Ensure deployment config exists
 */
async function ensureConfig(cwd, platform, platformConfig, options) {
  if (!platformConfig.configFile) return;

  const configPath = path.join(cwd, platformConfig.configFile);

  try {
    await fs.access(configPath);
    console.log(chalk.green(`  ✓ ${platformConfig.configFile} found`));
  } catch {
    console.log(chalk.yellow(`  📝 Creating ${platformConfig.configFile}...`));

    const config = await generateConfig(cwd, platform, options);

    if (platform === 'netlify') {
      // Netlify uses TOML format
      const toml = generateNetlifyToml(config);
      await fs.writeFile(configPath, toml);
    } else {
      await fs.writeFile(configPath, JSON.stringify(config, null, 2));
    }

    console.log(chalk.green(`  ✅ ${platformConfig.configFile} created`));
  }
}

/**
 * Generate platform config based on project type
 */
async function generateConfig(cwd, platform, options) {
  // Detect project type
  const pkgPath = path.join(cwd, 'package.json');
  let framework = 'static';
  let buildCommand = 'npm run build';
  let outputDirectory = 'dist';

  try {
    const pkg = JSON.parse(await fs.readFile(pkgPath, 'utf-8'));
    const deps = { ...pkg.dependencies, ...pkg.devDependencies };

    if (deps.next) {
      framework = 'nextjs';
      outputDirectory = '.next';
      buildCommand = 'next build';
    } else if (deps.vite) {
      framework = 'vite';
      outputDirectory = 'dist';
    } else if (deps['react-scripts']) {
      framework = 'create-react-app';
      outputDirectory = 'build';
    } else if (deps.vue || deps['@vue/cli-service']) {
      framework = 'vue';
      outputDirectory = 'dist';
    } else if (deps.nuxt) {
      framework = 'nuxt';
      outputDirectory = '.output';
    } else if (deps['@sveltejs/kit']) {
      framework = 'sveltekit';
      outputDirectory = 'build';
    }
  } catch {}

  switch (platform) {
    case 'vercel':
      return {
        version: 2,
        framework,
        buildCommand,
        outputDirectory,
        ...(options.domain && { alias: [options.domain] })
      };

    case 'netlify':
      return {
        build: {
          command: buildCommand,
          publish: outputDirectory
        }
      };

    case 'railway':
      return {
        build: {
          builder: 'NIXPACKS'
        },
        deploy: {
          startCommand: 'npm start'
        }
      };

    case 'render':
      return {
        services: [{
          type: 'web',
          name: path.basename(cwd),
          env: 'node',
          buildCommand,
          startCommand: 'npm start'
        }]
      };

    default:
      return {};
  }
}

/**
 * Generate Netlify TOML config
 */
function generateNetlifyToml(config) {
  return `[build]
  command = "${config.build?.command || 'npm run build'}"
  publish = "${config.build?.publish || 'dist'}"

[[redirects]]
  from = "/*"
  to = "/index.html"
  status = 200
`;
}

/**
 * Build project before deployment
 */
async function buildProject(cwd, platformConfig) {
  return new Promise((resolve) => {
    const buildCmd = platformConfig.buildCmd || 'npm run build';

    const child = spawn('sh', ['-c', buildCmd], {
      cwd,
      stdio: 'inherit'
    });

    child.on('close', (code) => {
      if (code === 0) {
        console.log(chalk.green('  ✅ Build complete'));
        resolve(true);
      } else {
        resolve(false);
      }
    });

    child.on('error', () => {
      resolve(false);
    });
  });
}

/**
 * Execute deployment
 */
async function deploy(cwd, platformConfig, isProduction, options) {
  return new Promise((resolve) => {
    let cmd = isProduction ? platformConfig.prodCmd : platformConfig.previewCmd;

    // Add domain if specified
    if (options.domain && platformConfig.name === 'Vercel') {
      cmd = `${cmd} --alias ${options.domain}`;
    }

    let output = '';
    let deployUrl = '';

    const child = spawn('sh', ['-c', cmd], {
      cwd,
      stdio: ['inherit', 'pipe', 'pipe']
    });

    child.stdout.on('data', (data) => {
      const text = data.toString();
      output += text;
      process.stdout.write(text);

      // Extract deployment URL from various formats
      const urlPatterns = [
        /https:\/\/[a-zA-Z0-9-]+\.vercel\.app[^\s]*/,
        /https:\/\/[a-zA-Z0-9-]+\.netlify\.app[^\s]*/,
        /https:\/\/[a-zA-Z0-9-]+\.github\.io[^\s]*/,
        /https:\/\/[a-zA-Z0-9-]+\.up\.railway\.app[^\s]*/,
        /https:\/\/[a-zA-Z0-9-]+\.onrender\.com[^\s]*/,
        /https:\/\/[^\s]+/
      ];

      for (const pattern of urlPatterns) {
        const match = text.match(pattern);
        if (match) {
          deployUrl = match[0].replace(/['")\]]+$/, ''); // Clean trailing chars
          break;
        }
      }
    });

    child.stderr.on('data', (data) => {
      const text = data.toString();
      output += text;
      process.stderr.write(text);
    });

    child.on('close', (code) => {
      resolve({
        success: code === 0,
        url: deployUrl,
        output,
        isProduction,
        timestamp: new Date().toISOString()
      });
    });

    child.on('error', (error) => {
      resolve({
        success: false,
        url: '',
        output: error.message,
        isProduction,
        timestamp: new Date().toISOString()
      });
    });
  });
}

/**
 * Save deployment info to history
 */
async function saveDeploymentInfo(cwd, platform, result) {
  const vibecodeDir = path.join(cwd, '.vibecode');
  const deploymentsPath = path.join(vibecodeDir, 'deployments.json');

  await fs.mkdir(vibecodeDir, { recursive: true });

  let deployments = [];
  try {
    const existing = await fs.readFile(deploymentsPath, 'utf-8');
    deployments = JSON.parse(existing);
  } catch {}

  deployments.unshift({
    platform,
    url: result.url,
    isProduction: result.isProduction,
    timestamp: result.timestamp,
    success: result.success
  });

  // Keep last 20 deployments
  deployments = deployments.slice(0, 20);

  await fs.writeFile(deploymentsPath, JSON.stringify(deployments, null, 2));
}

/**
 * Show deployment result
 */
function showDeploymentResult(result, platformConfig) {
  if (result.success) {
    const urlDisplay = result.url || 'Check console output above';
    const urlPadded = urlDisplay.length > 50 ? urlDisplay.substring(0, 47) + '...' : urlDisplay;

    console.log(chalk.green(`
╭────────────────────────────────────────────────────────────────────╮
│  ✅ DEPLOYMENT SUCCESSFUL                                          │
│                                                                    │
│  ${platformConfig.icon} Platform: ${platformConfig.name.padEnd(49)}│
│  🌐 URL: ${urlPadded.padEnd(53)}│
│  📅 Time: ${new Date().toLocaleString().padEnd(52)}│
│  🏷️  Type: ${(result.isProduction ? 'Production' : 'Preview').padEnd(52)}│
│                                                                    │
╰────────────────────────────────────────────────────────────────────╯
    `));

    if (result.url) {
      console.log(chalk.cyan(`  🔗 ${result.url}\n`));
    }
  } else {
    console.log(chalk.red(`
╭────────────────────────────────────────────────────────────────────╮
│  ❌ DEPLOYMENT FAILED                                              │
│                                                                    │
│  Check the error output above for details.                         │
│                                                                    │
│  Common fixes:                                                     │
│  • Run 'npm run build' to check for build errors                   │
│  • Check ${(platformConfig.configFile || 'configuration').padEnd(45)}│
│  • Verify authentication: ${platformConfig.loginCmd.padEnd(35)}│
│                                                                    │
╰────────────────────────────────────────────────────────────────────╯
    `));
  }
}

/**
 * Show deployment status
 */
async function showDeploymentStatus(cwd) {
  console.log(chalk.cyan(`
╭────────────────────────────────────────────────────────────────────╮
│  📊 DEPLOYMENT STATUS                                              │
╰────────────────────────────────────────────────────────────────────╯
  `));

  try {
    const deploymentsPath = path.join(cwd, '.vibecode', 'deployments.json');
    const deployments = JSON.parse(await fs.readFile(deploymentsPath, 'utf-8'));

    if (deployments.length === 0) {
      console.log(chalk.gray('  No deployments found.\n'));
      return;
    }

    const latest = deployments[0];
    const platformConfig = PLATFORMS[latest.platform];

    console.log(chalk.white.bold('  Latest Deployment:\n'));
    console.log(chalk.gray(`  Platform:  ${platformConfig?.icon || ''} ${latest.platform}`));
    console.log(chalk.gray(`  URL:       ${latest.url || 'N/A'}`));
    console.log(chalk.gray(`  Type:      ${latest.isProduction ? 'Production' : 'Preview'}`));
    console.log(chalk.gray(`  Time:      ${new Date(latest.timestamp).toLocaleString()}`));
    console.log(chalk.gray(`  Status:    ${latest.success ? chalk.green('Success') : chalk.red('Failed')}`));
    console.log('');

    if (latest.url) {
      console.log(chalk.cyan(`  🔗 ${latest.url}\n`));
    }

  } catch {
    console.log(chalk.gray('  No deployment history found.\n'));
    console.log(chalk.gray(`  Run ${chalk.cyan('vibecode deploy')} to deploy your project.\n`));
  }
}

/**
 * Show deployment history
 */
async function showDeploymentHistory(cwd) {
  console.log(chalk.cyan(`
╭────────────────────────────────────────────────────────────────────╮
│  📜 DEPLOYMENT HISTORY                                             │
╰────────────────────────────────────────────────────────────────────╯
  `));

  try {
    const deploymentsPath = path.join(cwd, '.vibecode', 'deployments.json');
    const deployments = JSON.parse(await fs.readFile(deploymentsPath, 'utf-8'));

    if (deployments.length === 0) {
      console.log(chalk.gray('  No deployments found.\n'));
      return;
    }

    console.log(chalk.gray('  Status  Platform      Type      Date'));
    console.log(chalk.gray('  ─────────────────────────────────────────────────────────'));

    for (const dep of deployments.slice(0, 10)) {
      const platformConfig = PLATFORMS[dep.platform];
      const status = dep.success ? chalk.green('  ✓') : chalk.red('  ✗');
      const type = dep.isProduction ? 'prod   ' : 'preview';
      const date = new Date(dep.timestamp).toLocaleDateString();
      const icon = platformConfig?.icon || ' ';

      console.log(`${status}     ${icon} ${dep.platform.padEnd(12)} ${type}   ${date}`);
      if (dep.url) {
        console.log(chalk.gray(`        ${dep.url}`));
      }
    }
    console.log('');

  } catch {
    console.log(chalk.gray('  No deployment history found.\n'));
    console.log(chalk.gray(`  Run ${chalk.cyan('vibecode deploy')} to deploy your project.\n`));
  }
}

/**
 * Auto-deploy for use in go command
 */
export async function autoDeploy(projectPath, options = {}) {
  const originalCwd = process.cwd();

  try {
    process.chdir(projectPath);

    return await deployCommand({
      vercel: options.platform !== 'netlify',
      netlify: options.platform === 'netlify',
      preview: options.preview || false,
      domain: options.domain
    });
  } catch (error) {
    console.log(chalk.yellow(`  ⚠️ Deploy failed: ${error.message}\n`));
    return { success: false };
  } finally {
    process.chdir(originalCwd);
  }
}
