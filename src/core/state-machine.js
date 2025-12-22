// ═══════════════════════════════════════════════════════════════════════════════
// VIBECODE CLI - State Machine
// ═══════════════════════════════════════════════════════════════════════════════

import { STATES, TRANSITIONS } from '../config/constants.js';
import { loadState, saveState, getLogsPath } from './workspace.js';
import { appendToFile } from '../utils/files.js';
import path from 'path';

/**
 * Get current state
 */
export async function getCurrentState() {
  const stateData = await loadState();
  return stateData.current_state;
}

/**
 * Check if transition is valid
 */
export function isValidTransition(fromState, toState) {
  const allowedTransitions = TRANSITIONS[fromState] || [];
  return allowedTransitions.includes(toState);
}

/**
 * Get allowed transitions from current state
 */
export function getAllowedTransitions(currentState) {
  return TRANSITIONS[currentState] || [];
}

/**
 * Transition to new state
 */
export async function transitionTo(newState, action = 'manual_transition') {
  const stateData = await loadState();
  const currentState = stateData.current_state;

  if (!isValidTransition(currentState, newState)) {
    throw new Error(
      `Invalid transition: ${currentState} → ${newState}. ` +
      `Allowed: ${getAllowedTransitions(currentState).join(', ') || 'none'}`
    );
  }

  // Update state
  stateData.current_state = newState;
  stateData.history.push({
    state: newState,
    timestamp: new Date().toISOString(),
    action: action,
    from: currentState
  });

  await saveState(stateData);

  // Log to audit trail
  await logAudit(`State transition: ${currentState} → ${newState} (${action})`);

  return stateData;
}

/**
 * Log to audit file
 */
export async function logAudit(message) {
  const timestamp = new Date().toISOString();
  const logLine = `[${timestamp}] ${message}`;
  const logPath = path.join(getLogsPath(), 'audit.log');

  try {
    await appendToFile(logPath, logLine);
  } catch (error) {
    // Silently fail if logs dir doesn't exist yet
  }
}

/**
 * Get state history
 */
export async function getStateHistory() {
  const stateData = await loadState();
  return stateData.history;
}

/**
 * Check if state is at or past a certain point
 */
export function isStateAtLeast(currentState, targetState) {
  const stateOrder = Object.values(STATES);
  const currentIndex = stateOrder.indexOf(currentState);
  const targetIndex = stateOrder.indexOf(targetState);
  return currentIndex >= targetIndex;
}
