// ═══════════════════════════════════════════════════════════════════════════════
// VIBECODE CLI - Workspace Management
// ═══════════════════════════════════════════════════════════════════════════════

import path from 'path';
import {
  WORKSPACE_DIR,
  CONFIG_FILE,
  STATE_FILE,
  SESSIONS_DIR,
  LIBRARY_DIR,
  LOGS_DIR,
  STATES
} from '../config/constants.js';
import {
  pathExists,
  ensureDir,
  readJson,
  writeJson,
  readYaml,
  writeYaml,
  getCurrentDirName
} from '../utils/files.js';

/**
 * Get workspace root path
 */
export function getWorkspacePath() {
  return path.join(process.cwd(), WORKSPACE_DIR);
}

/**
 * Check if workspace exists
 */
export async function workspaceExists() {
  return await pathExists(getWorkspacePath());
}

/**
 * Get config file path
 */
export function getConfigPath() {
  return path.join(getWorkspacePath(), CONFIG_FILE);
}

/**
 * Get state file path
 */
export function getStatePath() {
  return path.join(getWorkspacePath(), STATE_FILE);
}

/**
 * Get sessions directory path
 */
export function getSessionsPath() {
  return path.join(getWorkspacePath(), SESSIONS_DIR);
}

/**
 * Get specific session path
 */
export function getSessionPath(sessionId) {
  return path.join(getSessionsPath(), sessionId);
}

/**
 * Get logs directory path
 */
export function getLogsPath() {
  return path.join(getWorkspacePath(), LOGS_DIR);
}

/**
 * Create workspace structure
 */
export async function createWorkspace() {
  const workspacePath = getWorkspacePath();

  // Create directories
  await ensureDir(workspacePath);
  await ensureDir(path.join(workspacePath, SESSIONS_DIR));
  await ensureDir(path.join(workspacePath, LIBRARY_DIR));
  await ensureDir(path.join(workspacePath, LIBRARY_DIR, 'prompts'));
  await ensureDir(path.join(workspacePath, LOGS_DIR));

  // Create config file
  const config = {
    version: '1.0',
    created: new Date().toISOString(),
    project: {
      name: getCurrentDirName(),
      type: 'auto'
    },
    settings: {
      enforcement: 'strict',
      auto_backup: true,
      audit_log: true
    },
    provider: {
      default: 'claude-code'
    }
  };
  await writeYaml(getConfigPath(), config);

  // Create state file
  const state = {
    version: '1.0',
    current_state: STATES.INIT,
    current_session: null,
    spec_hash: null,
    history: [
      {
        state: STATES.INIT,
        timestamp: new Date().toISOString(),
        action: 'workspace_initialized'
      }
    ]
  };
  await writeJson(getStatePath(), state);

  return { config, state };
}

/**
 * Load config
 */
export async function loadConfig() {
  return await readYaml(getConfigPath());
}

/**
 * Load state
 */
export async function loadState() {
  return await readJson(getStatePath());
}

/**
 * Save state
 */
export async function saveState(state) {
  await writeJson(getStatePath(), state);
}

/**
 * Get project name from config
 */
export async function getProjectName() {
  const config = await loadConfig();
  return config.project?.name || getCurrentDirName();
}
