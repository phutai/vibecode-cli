// ═══════════════════════════════════════════════════════════════════════════════
// VIBECODE CLI - Claude Code Provider
// "Claude/LLM là PIPELINE, là KIẾN TRÚC SƯ"
// ═══════════════════════════════════════════════════════════════════════════════

import { spawn } from 'child_process';
import path from 'path';
import { pathExists, appendToFile } from '../utils/files.js';

/**
 * Claude Code optimal configuration
 * Contract LOCKED = License to build (không cần hỏi thêm)
 */
export const CLAUDE_CODE_CONFIG = {
  command: 'claude',
  flags: [
    '--dangerously-skip-permissions',  // Trust the AI - Contract đã locked
    '--print',                          // Non-interactive mode (no TTY required)
  ],
  timeout: 30 * 60 * 1000, // 30 minutes max
};

/**
 * Check if Claude Code CLI is available
 */
export async function isClaudeCodeAvailable() {
  return new Promise((resolve) => {
    const proc = spawn('which', ['claude'], { shell: true });
    proc.on('close', (code) => {
      resolve(code === 0);
    });
    proc.on('error', () => {
      resolve(false);
    });
  });
}

/**
 * Spawn Claude Code with optimal settings
 *
 * @param {string} prompt - The coder pack / prompt to send
 * @param {object} options - Configuration options
 * @param {string} options.cwd - Working directory
 * @param {string} options.logPath - Path to write build logs
 * @param {function} options.onOutput - Callback for output
 * @returns {Promise<{success: boolean, code: number}>}
 */
export async function spawnClaudeCode(prompt, options = {}) {
  const { cwd, logPath, onOutput } = options;
  const fs = await import('fs-extra');
  const os = await import('os');

  // Check if Claude Code is available
  const available = await isClaudeCodeAvailable();
  if (!available) {
    throw new Error('Claude Code CLI not found. Install with: npm install -g @anthropic/claude-code');
  }

  // Write prompt to temp file to avoid shell escaping issues
  const tempDir = os.default.tmpdir();
  const promptFile = path.join(tempDir, `vibecode-prompt-${Date.now()}.md`);
  await fs.default.writeFile(promptFile, prompt, 'utf-8');

  return new Promise((resolve, reject) => {
    // Build command with --print mode and -p for prompt file
    const args = [
      ...CLAUDE_CODE_CONFIG.flags,
      '-p', promptFile
    ];
    const command = `claude ${args.map(a => `"${a}"`).join(' ')}`;

    // Log the command being run
    if (logPath) {
      appendToFile(logPath, `\n[${new Date().toISOString()}] Running: claude --print -p ${promptFile}\n`);
    }

    const proc = spawn('claude', args, {
      cwd: cwd || process.cwd(),
      stdio: 'inherit', // Stream directly to terminal
      shell: false,     // No shell needed, safer
    });

    let timeoutId = setTimeout(() => {
      proc.kill();
      // Cleanup temp file
      fs.default.remove(promptFile).catch(() => {});
      reject(new Error('Claude Code process timed out'));
    }, CLAUDE_CODE_CONFIG.timeout);

    proc.on('close', async (code) => {
      clearTimeout(timeoutId);

      // Cleanup temp file
      await fs.default.remove(promptFile).catch(() => {});

      const result = {
        success: code === 0,
        code: code || 0,
        timestamp: new Date().toISOString()
      };

      if (logPath) {
        const status = result.success ? 'SUCCESS' : 'FAILED';
        appendToFile(logPath, `\n[${result.timestamp}] Claude Code ${status} (exit code: ${code})\n`);
      }

      resolve(result);
    });

    proc.on('error', async (error) => {
      clearTimeout(timeoutId);
      // Cleanup temp file
      await fs.default.remove(promptFile).catch(() => {});

      if (logPath) {
        appendToFile(logPath, `\n[${new Date().toISOString()}] ERROR: ${error.message}\n`);
      }
      reject(error);
    });
  });
}

/**
 * Build prompt with optional CLAUDE.md injection
 *
 * @param {string} coderPackContent - Content of coder_pack.md
 * @param {string} projectRoot - Project root directory
 * @returns {Promise<string>} - Final prompt
 */
export async function buildPromptWithContext(coderPackContent, projectRoot) {
  let fullPrompt = coderPackContent;

  // Check for CLAUDE.md in project root
  const claudeMdPath = path.join(projectRoot, 'CLAUDE.md');
  if (await pathExists(claudeMdPath)) {
    const fs = await import('fs-extra');
    const claudeMd = await fs.default.readFile(claudeMdPath, 'utf-8');

    // Inject CLAUDE.md rules before coder pack
    fullPrompt = `# PROJECT RULES (from CLAUDE.md)

${claudeMd}

---

# BUILD INSTRUCTIONS

${coderPackContent}`;
  }

  return fullPrompt;
}

/**
 * Get provider info for status display
 */
export function getProviderInfo() {
  return {
    name: 'Claude Code',
    command: CLAUDE_CODE_CONFIG.command,
    mode: '--dangerously-skip-permissions --print',
    description: 'AI coding in non-interactive mode (contract-approved)'
  };
}
