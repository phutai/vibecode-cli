// ═══════════════════════════════════════════════════════════════════════════════
// VIBECODE CLI - Session Management
// ═══════════════════════════════════════════════════════════════════════════════

import path from 'path';
import {
  getSessionsPath,
  getSessionPath,
  loadState,
  saveState
} from './workspace.js';
import { ensureDir, pathExists, writeMarkdown, readMarkdown } from '../utils/files.js';
import { generateSessionId } from '../utils/hash.js';
import { getIntakeTemplate, getBlueprintTemplate, getContractTemplate } from '../config/templates.js';

/**
 * Create new session
 */
export async function createSession(projectName) {
  const sessionId = generateSessionId();
  const sessionPath = getSessionPath(sessionId);

  // Create session directory
  await ensureDir(sessionPath);
  await ensureDir(path.join(sessionPath, 'evidence'));

  // Update state with current session
  const stateData = await loadState();
  stateData.current_session = sessionId;
  await saveState(stateData);

  return sessionId;
}

/**
 * Get current session ID
 */
export async function getCurrentSessionId() {
  const stateData = await loadState();
  return stateData.current_session;
}

/**
 * Get current session path
 */
export async function getCurrentSessionPath() {
  const sessionId = await getCurrentSessionId();
  if (!sessionId) return null;
  return getSessionPath(sessionId);
}

/**
 * Check if file exists in current session
 */
export async function sessionFileExists(filename) {
  const sessionPath = await getCurrentSessionPath();
  if (!sessionPath) return false;
  return await pathExists(path.join(sessionPath, filename));
}

/**
 * Write file to current session
 */
export async function writeSessionFile(filename, content) {
  const sessionPath = await getCurrentSessionPath();
  if (!sessionPath) throw new Error('No active session');
  await writeMarkdown(path.join(sessionPath, filename), content);
}

/**
 * Read file from current session
 */
export async function readSessionFile(filename) {
  const sessionPath = await getCurrentSessionPath();
  if (!sessionPath) throw new Error('No active session');
  return await readMarkdown(path.join(sessionPath, filename));
}

/**
 * Get session files status
 */
export async function getSessionFilesStatus() {
  const sessionPath = await getCurrentSessionPath();
  if (!sessionPath) return null;

  return {
    // Phase A files
    intake: await pathExists(path.join(sessionPath, 'intake.md')),
    blueprint: await pathExists(path.join(sessionPath, 'blueprint.md')),
    contract: await pathExists(path.join(sessionPath, 'contract.md')),
    // Phase B files
    plan: await pathExists(path.join(sessionPath, 'plan.md')),
    coderPack: await pathExists(path.join(sessionPath, 'coder_pack.md')),
    buildReport: await pathExists(path.join(sessionPath, 'build_report.md')),
    reviewReport: await pathExists(path.join(sessionPath, 'review_report.md')),
    manifest: await pathExists(path.join(sessionPath, 'manifest.json'))
  };
}

/**
 * Create intake file from description
 */
export async function createIntake(projectName, description, sessionId) {
  const template = getIntakeTemplate(projectName, description, sessionId);
  await writeSessionFile('intake.md', template);
}

/**
 * Create blueprint file
 */
export async function createBlueprint(projectName, sessionId) {
  const template = getBlueprintTemplate(projectName, sessionId);
  await writeSessionFile('blueprint.md', template);
}

/**
 * Create contract file from intake and blueprint
 */
export async function createContract(projectName, sessionId) {
  // Read intake and blueprint to extract real content
  let intakeContent = '';
  let blueprintContent = '';

  try {
    intakeContent = await readSessionFile('intake.md');
  } catch (e) {
    // Intake not found, use empty
  }

  try {
    blueprintContent = await readSessionFile('blueprint.md');
  } catch (e) {
    // Blueprint not found, use empty
  }

  const template = getContractTemplate(projectName, sessionId, intakeContent, blueprintContent);
  await writeSessionFile('contract.md', template);
}
