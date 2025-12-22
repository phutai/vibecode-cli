// ═══════════════════════════════════════════════════════════════════════════════
// VIBECODE CLI - Iteration Tracker
// Manage and track build-test-fix iterations
// ═══════════════════════════════════════════════════════════════════════════════

import path from 'path';
import { ensureDir, writeJson, readJson, pathExists, appendToFile } from '../utils/files.js';

/**
 * @typedef {Object} IterationRecord
 * @property {number} iteration - Iteration number
 * @property {string} timestamp - ISO timestamp
 * @property {boolean} passed - Whether tests passed
 * @property {number} errorCount - Number of errors
 * @property {string[]} errorTypes - Types of errors found
 * @property {string[]} affectedFiles - Files with errors
 * @property {number} duration - Duration in ms
 * @property {string} action - What action was taken (build/fix)
 */

/**
 * @typedef {Object} IterationState
 * @property {string} sessionId - Session identifier
 * @property {string} startTime - When iteration started
 * @property {number} currentIteration - Current iteration number
 * @property {number} maxIterations - Max allowed iterations
 * @property {IterationRecord[]} history - History of iterations
 * @property {boolean} completed - Whether iteration loop completed
 * @property {string} result - Final result (success/max_reached/error)
 */

/**
 * Create new iteration state
 * @param {string} sessionId - Session identifier
 * @param {number} maxIterations - Maximum iterations allowed
 * @returns {IterationState}
 */
export function createIterationState(sessionId, maxIterations = 3) {
  return {
    sessionId,
    startTime: new Date().toISOString(),
    currentIteration: 0,
    maxIterations,
    history: [],
    completed: false,
    result: null
  };
}

/**
 * Record an iteration result
 * @param {IterationState} state - Current iteration state
 * @param {Object} result - Iteration result
 * @returns {IterationState} - Updated state
 */
export function recordIteration(state, result) {
  const record = {
    iteration: state.currentIteration + 1,
    timestamp: new Date().toISOString(),
    passed: result.passed,
    errorCount: result.errorCount || 0,
    errorTypes: result.errorTypes || [],
    affectedFiles: result.affectedFiles || [],
    duration: result.duration || 0,
    action: result.action || 'build'
  };

  return {
    ...state,
    currentIteration: state.currentIteration + 1,
    history: [...state.history, record]
  };
}

/**
 * Check if can continue iterating
 * @param {IterationState} state - Current state
 * @returns {{canContinue: boolean, reason: string}}
 */
export function canContinue(state) {
  if (state.completed) {
    return { canContinue: false, reason: 'Iteration already completed' };
  }

  if (state.currentIteration >= state.maxIterations) {
    return { canContinue: false, reason: `Max iterations (${state.maxIterations}) reached` };
  }

  // Check if last iteration passed
  const lastRecord = state.history[state.history.length - 1];
  if (lastRecord && lastRecord.passed) {
    return { canContinue: false, reason: 'Tests passed - no more iterations needed' };
  }

  // Check for stuck loop (same errors repeated 3 times)
  if (state.history.length >= 3) {
    const last3 = state.history.slice(-3);
    const errorCounts = last3.map(r => r.errorCount);
    if (errorCounts.every(c => c === errorCounts[0]) && errorCounts[0] > 0) {
      return { canContinue: false, reason: 'Stuck in loop - same error count for 3 iterations' };
    }
  }

  return { canContinue: true, reason: '' };
}

/**
 * Finalize iteration state
 * @param {IterationState} state - Current state
 * @param {string} result - Result type (success/max_reached/error/stuck)
 * @returns {IterationState}
 */
export function finalizeIterationState(state, result) {
  return {
    ...state,
    completed: true,
    result,
    endTime: new Date().toISOString(),
    totalDuration: state.history.reduce((sum, r) => sum + r.duration, 0)
  };
}

/**
 * Save iteration state to session directory
 * @param {string} sessionDir - Session directory path
 * @param {IterationState} state - Iteration state
 */
export async function saveIterationState(sessionDir, state) {
  const iterationDir = path.join(sessionDir, 'iterations');
  await ensureDir(iterationDir);

  const stateFile = path.join(iterationDir, 'state.json');
  await writeJson(stateFile, state, { spaces: 2 });

  // Also write individual iteration files for evidence
  for (const record of state.history) {
    const recordFile = path.join(iterationDir, `iteration-${record.iteration}.json`);
    if (!await pathExists(recordFile)) {
      await writeJson(recordFile, record, { spaces: 2 });
    }
  }
}

/**
 * Load iteration state from session directory
 * @param {string} sessionDir - Session directory path
 * @returns {Promise<IterationState|null>}
 */
export async function loadIterationState(sessionDir) {
  const stateFile = path.join(sessionDir, 'iterations', 'state.json');
  if (await pathExists(stateFile)) {
    return await readJson(stateFile);
  }
  return null;
}

/**
 * Format iteration summary for display
 * @param {IterationState} state - Iteration state
 * @returns {string}
 */
export function formatIterationSummary(state) {
  const lines = [];

  lines.push(`Iteration Summary (${state.sessionId})`);
  lines.push('═'.repeat(50));
  lines.push(`Total Iterations: ${state.currentIteration}/${state.maxIterations}`);
  lines.push(`Result: ${state.result || 'In Progress'}`);
  lines.push('');

  if (state.history.length > 0) {
    lines.push('History:');
    for (const record of state.history) {
      const status = record.passed ? '✅' : '❌';
      const errors = record.errorCount > 0 ? ` (${record.errorCount} errors)` : '';
      lines.push(`  ${record.iteration}. ${status} ${record.action}${errors} - ${formatDuration(record.duration)}`);
    }
  }

  if (state.totalDuration) {
    lines.push('');
    lines.push(`Total Duration: ${formatDuration(state.totalDuration)}`);
  }

  return lines.join('\n');
}

/**
 * Format duration in human readable format
 */
function formatDuration(ms) {
  if (ms < 1000) return `${ms}ms`;
  if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
  return `${Math.floor(ms / 60000)}m ${Math.round((ms % 60000) / 1000)}s`;
}

/**
 * Write iteration log entry
 */
export async function logIteration(logPath, iteration, message) {
  const timestamp = new Date().toISOString();
  const entry = `[${timestamp}] [Iteration ${iteration}] ${message}\n`;
  await appendToFile(logPath, entry);
}

/**
 * Get progress percentage
 */
export function getProgressPercent(state) {
  if (state.completed && state.result === 'success') {
    return 100;
  }
  return Math.round((state.currentIteration / state.maxIterations) * 100);
}

/**
 * Check if errors are improving (decreasing)
 */
export function isImproving(state) {
  if (state.history.length < 2) return true;

  const last = state.history[state.history.length - 1];
  const prev = state.history[state.history.length - 2];

  return last.errorCount < prev.errorCount;
}
