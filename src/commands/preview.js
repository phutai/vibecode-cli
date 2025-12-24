// ═══════════════════════════════════════════════════════════════════════════════
// VIBECODE CLI - Preview Command
// Auto-start dev server and open browser
// ═══════════════════════════════════════════════════════════════════════════════

import { spawn, exec } from 'child_process';
import { promisify } from 'util';
import fs from 'fs/promises';
import path from 'path';
import chalk from 'chalk';
import net from 'net';
import os from 'os';

const execAsync = promisify(exec);

// Store running processes
const runningProcesses = new Map();

/**
 * Preview command entry point
 */
export async function previewCommand(options = {}) {
  const cwd = process.cwd();

  // Stop preview
  if (options.stop) {
    return stopPreview(cwd);
  }

  // Check if it's a valid project
  const projectType = await detectProjectType(cwd);

  if (!projectType) {
    console.log(chalk.red(`
╭────────────────────────────────────────────────────────────────────╮
│  ❌ NOT A VALID PROJECT                                            │
│                                                                    │
│  No package.json found or unsupported project type.               │
│                                                                    │
│  Supported: Next.js, React, Vue, Vite, Express                    │
╰────────────────────────────────────────────────────────────────────╯
    `));
    return;
  }

  // Find available port
  const requestedPort = parseInt(options.port) || 3000;
  const port = await findAvailablePort(requestedPort);

  console.log(chalk.cyan(`
╭────────────────────────────────────────────────────────────────────╮
│  🚀 VIBECODE PREVIEW                                               │
╰────────────────────────────────────────────────────────────────────╯
  `));

  console.log(chalk.gray(`  Project: ${path.basename(cwd)}`));
  console.log(chalk.gray(`  Type:    ${projectType.name}`));
  console.log(chalk.gray(`  Port:    ${port}\n`));

  // Step 1: Install dependencies if needed
  const needsInstall = await checkNeedsInstall(cwd);

  if (needsInstall) {
    console.log(chalk.yellow('  📦 Installing dependencies...\n'));
    try {
      await installDependencies(cwd);
      console.log(chalk.green('  ✅ Dependencies installed\n'));
    } catch (error) {
      console.log(chalk.red(`  ❌ Install failed: ${error.message}\n`));
      return;
    }
  }

  // Step 2: Start dev server
  console.log(chalk.yellow('  🔧 Starting dev server...\n'));

  let serverProcess;
  try {
    serverProcess = await startDevServer(cwd, projectType, port);
    runningProcesses.set(cwd, serverProcess);
  } catch (error) {
    console.log(chalk.red(`  ❌ Failed to start server: ${error.message}\n`));
    return;
  }

  // Step 3: Wait for server to be ready
  const isReady = await waitForServer(port);

  if (!isReady) {
    console.log(chalk.yellow('  ⚠️ Server may still be starting...\n'));
  }

  const url = `http://localhost:${port}`;

  // Step 4: Display success
  console.log(chalk.green(`
╭────────────────────────────────────────────────────────────────────╮
│  ✅ PREVIEW READY                                                  │
│                                                                    │
│  🌐 Local:   ${url.padEnd(49)}│
╰────────────────────────────────────────────────────────────────────╯
  `));

  // Step 5: Show QR code for mobile
  if (options.qr) {
    await showQRCode(port);
  }

  // Step 6: Open browser
  if (options.open !== false) {
    try {
      await openBrowser(url);
      console.log(chalk.green('  ✅ Opened in browser\n'));
    } catch (error) {
      console.log(chalk.yellow(`  ⚠️ Could not open browser: ${error.message}\n`));
      console.log(chalk.gray(`  Open manually: ${url}\n`));
    }
  }

  // Step 7: Show controls
  console.log(chalk.gray(`  Controls:
    ${chalk.cyan('vibecode preview --stop')}  Stop server
    ${chalk.cyan('Ctrl+C')}                   Stop server
  `));

  // Handle graceful shutdown
  process.on('SIGINT', () => {
    console.log(chalk.yellow('\n\n  Stopping server...'));
    if (serverProcess) {
      serverProcess.kill();
    }
    console.log(chalk.green('  ✅ Server stopped\n'));
    process.exit(0);
  });

  // Keep process running unless detached
  if (!options.detach) {
    await new Promise(() => {}); // Keep alive
  }
}

/**
 * Detect project type from package.json
 */
async function detectProjectType(cwd) {
  try {
    const pkgPath = path.join(cwd, 'package.json');
    const pkgContent = await fs.readFile(pkgPath, 'utf-8');
    const pkg = JSON.parse(pkgContent);
    const deps = { ...pkg.dependencies, ...pkg.devDependencies };
    const scripts = pkg.scripts || {};

    if (deps.next) {
      return {
        name: 'Next.js',
        devScript: 'dev',
        defaultPort: 3000,
        portFlag: '-p'
      };
    }

    if (deps.vite) {
      return {
        name: 'Vite',
        devScript: 'dev',
        defaultPort: 5173,
        portFlag: '--port'
      };
    }

    if (deps['react-scripts']) {
      return {
        name: 'Create React App',
        devScript: 'start',
        defaultPort: 3000,
        portEnv: 'PORT'
      };
    }

    if (deps.vue || deps['@vue/cli-service']) {
      return {
        name: 'Vue',
        devScript: scripts.dev ? 'dev' : 'serve',
        defaultPort: 8080,
        portFlag: '--port'
      };
    }

    if (deps.nuxt) {
      return {
        name: 'Nuxt',
        devScript: 'dev',
        defaultPort: 3000,
        portFlag: '--port'
      };
    }

    if (deps.svelte || deps['@sveltejs/kit']) {
      return {
        name: 'SvelteKit',
        devScript: 'dev',
        defaultPort: 5173,
        portFlag: '--port'
      };
    }

    if (deps.express || deps.fastify || deps.koa || deps.hono) {
      return {
        name: 'Node.js Server',
        devScript: scripts.dev ? 'dev' : 'start',
        defaultPort: 3000,
        portEnv: 'PORT'
      };
    }

    // Generic with dev script
    if (scripts.dev) {
      return {
        name: 'Generic',
        devScript: 'dev',
        defaultPort: 3000,
        portEnv: 'PORT'
      };
    }

    if (scripts.start) {
      return {
        name: 'Generic',
        devScript: 'start',
        defaultPort: 3000,
        portEnv: 'PORT'
      };
    }

    return null;
  } catch {
    return null;
  }
}

/**
 * Check if node_modules needs to be installed
 */
async function checkNeedsInstall(cwd) {
  const nodeModulesPath = path.join(cwd, 'node_modules');
  try {
    await fs.access(nodeModulesPath);
    // Check if node_modules has content
    const contents = await fs.readdir(nodeModulesPath);
    return contents.length < 5; // Likely incomplete install
  } catch {
    return true;
  }
}

/**
 * Install dependencies
 */
async function installDependencies(cwd) {
  return new Promise((resolve, reject) => {
    const spinner = ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏'];
    let i = 0;

    const interval = setInterval(() => {
      process.stdout.write(`\r  ${spinner[i++ % spinner.length]} Installing...`);
    }, 100);

    const child = spawn('npm', ['install'], {
      cwd,
      stdio: ['ignore', 'pipe', 'pipe'],
      shell: true
    });

    let stderr = '';
    child.stderr.on('data', (data) => {
      stderr += data.toString();
    });

    child.on('close', (code) => {
      clearInterval(interval);
      process.stdout.write('\r                              \r');

      if (code === 0) {
        resolve();
      } else {
        reject(new Error(stderr || `npm install failed with code ${code}`));
      }
    });

    child.on('error', (err) => {
      clearInterval(interval);
      reject(err);
    });
  });
}

/**
 * Start development server
 */
async function startDevServer(cwd, projectType, port) {
  const env = { ...process.env };

  // Set port via environment variable if needed
  if (projectType.portEnv) {
    env[projectType.portEnv] = String(port);
  }

  // Build the command
  const args = ['run', projectType.devScript];

  // Add port flag if supported
  if (projectType.portFlag) {
    args.push('--', projectType.portFlag, String(port));
  }

  const child = spawn('npm', args, {
    cwd,
    stdio: ['ignore', 'pipe', 'pipe'],
    shell: true,
    env,
    detached: false
  });

  // Log output for debugging
  child.stdout.on('data', (data) => {
    const output = data.toString().trim();
    // Show ready messages
    if (output.toLowerCase().includes('ready') ||
        output.toLowerCase().includes('started') ||
        output.toLowerCase().includes('listening') ||
        output.toLowerCase().includes('compiled')) {
      console.log(chalk.gray(`  ${output.substring(0, 60)}`));
    }
  });

  child.stderr.on('data', (data) => {
    const output = data.toString().trim();
    // Only show actual errors, not warnings
    if (output.toLowerCase().includes('error') &&
        !output.toLowerCase().includes('warning')) {
      console.log(chalk.red(`  ${output.substring(0, 60)}`));
    }
  });

  child.on('error', (error) => {
    console.log(chalk.red(`  Server error: ${error.message}`));
  });

  return child;
}

/**
 * Wait for server to be ready by checking port
 */
async function waitForServer(port, maxAttempts = 30) {
  const spinner = ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏'];
  let i = 0;

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    process.stdout.write(`\r  ${spinner[i++ % spinner.length]} Waiting for server...`);

    const isReady = await checkPort(port);

    if (isReady) {
      process.stdout.write('\r  ✅ Server ready              \n');
      return true;
    }

    await sleep(1000);
  }

  process.stdout.write('\r  ⚠️ Server taking longer than expected\n');
  return false;
}

/**
 * Check if a port is in use (server is running)
 */
function checkPort(port) {
  return new Promise((resolve) => {
    const socket = new net.Socket();

    socket.setTimeout(1000);

    socket.on('connect', () => {
      socket.destroy();
      resolve(true);
    });

    socket.on('timeout', () => {
      socket.destroy();
      resolve(false);
    });

    socket.on('error', () => {
      socket.destroy();
      resolve(false);
    });

    socket.connect(port, '127.0.0.1');
  });
}

/**
 * Find an available port starting from the given port
 */
async function findAvailablePort(startPort) {
  let port = startPort;

  while (port < startPort + 100) {
    const inUse = await checkPort(port);
    if (!inUse) {
      return port;
    }
    port++;
  }

  return startPort;
}

/**
 * Open URL in default browser
 */
async function openBrowser(url) {
  try {
    const open = (await import('open')).default;
    await open(url);
  } catch (error) {
    // Fallback for different OS
    const { platform } = process;
    const commands = {
      darwin: `open "${url}"`,
      win32: `start "" "${url}"`,
      linux: `xdg-open "${url}"`
    };

    if (commands[platform]) {
      await execAsync(commands[platform]);
    } else {
      throw new Error('Unsupported platform');
    }
  }
}

/**
 * Show QR code for mobile access
 */
async function showQRCode(port) {
  try {
    // Get local IP
    const nets = os.networkInterfaces();
    let localIP = 'localhost';

    for (const name of Object.keys(nets)) {
      for (const netInterface of nets[name]) {
        if (netInterface.family === 'IPv4' && !netInterface.internal) {
          localIP = netInterface.address;
          break;
        }
      }
      if (localIP !== 'localhost') break;
    }

    const networkUrl = `http://${localIP}:${port}`;

    // Try to generate QR code
    try {
      const QRCode = (await import('qrcode')).default;
      const qrString = await QRCode.toString(networkUrl, {
        type: 'terminal',
        small: true
      });

      console.log(chalk.cyan('\n  📱 Scan to open on mobile:\n'));
      // Indent QR code
      const indentedQR = qrString.split('\n').map(line => '  ' + line).join('\n');
      console.log(indentedQR);
      console.log(chalk.gray(`\n  Network: ${networkUrl}\n`));
    } catch {
      // QR code package not available, just show URL
      console.log(chalk.cyan('\n  📱 Mobile access:\n'));
      console.log(chalk.white(`  ${networkUrl}\n`));
      console.log(chalk.gray('  (Install qrcode for QR: npm i qrcode)\n'));
    }
  } catch (error) {
    console.log(chalk.yellow(`  ⚠️ Could not get network info: ${error.message}\n`));
  }
}

/**
 * Stop running preview server
 */
async function stopPreview(cwd) {
  const runningProcess = runningProcesses.get(cwd);

  if (runningProcess) {
    runningProcess.kill();
    runningProcesses.delete(cwd);
    console.log(chalk.green('\n  ✅ Preview server stopped\n'));
    return;
  }

  // Try to kill any process on common dev ports
  console.log(chalk.yellow('\n  Attempting to stop dev servers...\n'));

  try {
    const { platform } = process;

    if (platform === 'win32') {
      // Windows
      await execAsync('netstat -ano | findstr :3000 | findstr LISTENING').catch(() => {});
    } else {
      // Unix-like
      await execAsync('lsof -ti:3000 | xargs kill -9 2>/dev/null || true');
      await execAsync('lsof -ti:3001 | xargs kill -9 2>/dev/null || true');
      await execAsync('lsof -ti:5173 | xargs kill -9 2>/dev/null || true');
      await execAsync('lsof -ti:8080 | xargs kill -9 2>/dev/null || true');
    }

    console.log(chalk.green('  ✅ Dev servers stopped\n'));
  } catch {
    console.log(chalk.gray('  No running servers found.\n'));
  }
}

/**
 * Sleep helper
 */
function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Auto preview for use after builds
 * Called from go.js after successful build
 */
export async function autoPreview(projectPath, options = {}) {
  const originalCwd = process.cwd();

  try {
    process.chdir(projectPath);
    await previewCommand({
      open: true,
      qr: options.qr || false,
      port: options.port,
      detach: true, // Don't block in auto mode
      ...options
    });
  } catch (error) {
    console.log(chalk.yellow(`  ⚠️ Preview failed: ${error.message}\n`));
  } finally {
    process.chdir(originalCwd);
  }
}
