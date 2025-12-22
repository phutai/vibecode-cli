// ═══════════════════════════════════════════════════════════════════════════════
// VIBECODE CLI - Constants & Configuration
// Spec Hash: 0fe43335f5a325e3279a079ce616c052
// ═══════════════════════════════════════════════════════════════════════════════

export const VERSION = '1.0.1';
export const SPEC_HASH = '0fe43335f5a325e3279a079ce616c052';

// ─────────────────────────────────────────────────────────────────────────────
// State Machine - Phase A + B
// ─────────────────────────────────────────────────────────────────────────────

export const STATES = {
  // Phase A: Planning
  INIT: 'INIT',
  INTAKE_CAPTURED: 'INTAKE_CAPTURED',
  BLUEPRINT_DRAFTED: 'BLUEPRINT_DRAFTED',
  CONTRACT_DRAFTED: 'CONTRACT_DRAFTED',
  CONTRACT_LOCKED: 'CONTRACT_LOCKED',
  // Phase B: Execution
  PLAN_CREATED: 'PLAN_CREATED',
  BUILD_IN_PROGRESS: 'BUILD_IN_PROGRESS',
  BUILD_DONE: 'BUILD_DONE',
  REVIEW_PASSED: 'REVIEW_PASSED',
  REVIEW_FAILED: 'REVIEW_FAILED',
  SHIPPED: 'SHIPPED'
};

export const TRANSITIONS = {
  // Phase A transitions
  [STATES.INIT]: [STATES.INTAKE_CAPTURED],
  [STATES.INTAKE_CAPTURED]: [STATES.BLUEPRINT_DRAFTED],
  [STATES.BLUEPRINT_DRAFTED]: [STATES.CONTRACT_DRAFTED, STATES.INTAKE_CAPTURED],
  [STATES.CONTRACT_DRAFTED]: [STATES.CONTRACT_LOCKED, STATES.BLUEPRINT_DRAFTED],
  // Phase B transitions
  [STATES.CONTRACT_LOCKED]: [STATES.PLAN_CREATED],
  [STATES.PLAN_CREATED]: [STATES.BUILD_IN_PROGRESS],
  [STATES.BUILD_IN_PROGRESS]: [STATES.BUILD_DONE],
  [STATES.BUILD_DONE]: [STATES.REVIEW_PASSED, STATES.REVIEW_FAILED],
  [STATES.REVIEW_PASSED]: [STATES.SHIPPED],
  [STATES.REVIEW_FAILED]: [STATES.BUILD_IN_PROGRESS, STATES.PLAN_CREATED],
  [STATES.SHIPPED]: []
};

// ─────────────────────────────────────────────────────────────────────────────
// Progress Display Mapping (7 stages)
// ─────────────────────────────────────────────────────────────────────────────

export const PROGRESS_MAP = {
  [STATES.INIT]: { intake: '🔄', blueprint: '⬜', contract: '⬜', plan: '⬜', build: '⬜', review: '⬜', ship: '⬜' },
  [STATES.INTAKE_CAPTURED]: { intake: '✅', blueprint: '🔄', contract: '⬜', plan: '⬜', build: '⬜', review: '⬜', ship: '⬜' },
  [STATES.BLUEPRINT_DRAFTED]: { intake: '✅', blueprint: '✅', contract: '🔄', plan: '⬜', build: '⬜', review: '⬜', ship: '⬜' },
  [STATES.CONTRACT_DRAFTED]: { intake: '✅', blueprint: '✅', contract: '🔄', plan: '⬜', build: '⬜', review: '⬜', ship: '⬜' },
  [STATES.CONTRACT_LOCKED]: { intake: '✅', blueprint: '✅', contract: '✅', plan: '🔄', build: '⬜', review: '⬜', ship: '⬜' },
  [STATES.PLAN_CREATED]: { intake: '✅', blueprint: '✅', contract: '✅', plan: '✅', build: '🔄', review: '⬜', ship: '⬜' },
  [STATES.BUILD_IN_PROGRESS]: { intake: '✅', blueprint: '✅', contract: '✅', plan: '✅', build: '🔄', review: '⬜', ship: '⬜' },
  [STATES.BUILD_DONE]: { intake: '✅', blueprint: '✅', contract: '✅', plan: '✅', build: '✅', review: '🔄', ship: '⬜' },
  [STATES.REVIEW_PASSED]: { intake: '✅', blueprint: '✅', contract: '✅', plan: '✅', build: '✅', review: '✅', ship: '🔄' },
  [STATES.REVIEW_FAILED]: { intake: '✅', blueprint: '✅', contract: '✅', plan: '✅', build: '⚠️', review: '❌', ship: '⬜' },
  [STATES.SHIPPED]: { intake: '✅', blueprint: '✅', contract: '✅', plan: '✅', build: '✅', review: '✅', ship: '✅' }
};

// ─────────────────────────────────────────────────────────────────────────────
// File & Folder Names
// ─────────────────────────────────────────────────────────────────────────────

export const WORKSPACE_DIR = '.vibecode';
export const CONFIG_FILE = 'vibecode.yaml';
export const STATE_FILE = 'state.json';
export const SESSIONS_DIR = 'sessions';
export const LIBRARY_DIR = 'library';
export const LOGS_DIR = 'logs';
export const AUDIT_LOG = 'audit.log';

// ─────────────────────────────────────────────────────────────────────────────
// Contract Validation
// ─────────────────────────────────────────────────────────────────────────────

export const CONTRACT_REQUIRED_SECTIONS = [
  { key: 'goal', name: 'Goal', pattern: /##\s*🎯\s*Goal/i },
  { key: 'inscope', name: 'In-Scope', pattern: /##\s*✅\s*In-Scope/i },
  { key: 'outscope', name: 'Out-of-Scope', pattern: /##\s*❌\s*Out-of-Scope/i },
  { key: 'deliverables', name: 'Deliverables', pattern: /##\s*📦\s*Deliverables/i },
  { key: 'acceptance', name: 'Acceptance Criteria', pattern: /##\s*✔️\s*Acceptance Criteria/i }
];

// ─────────────────────────────────────────────────────────────────────────────
// UI Colors
// ─────────────────────────────────────────────────────────────────────────────

export const COLORS = {
  primary: 'cyan',
  success: 'green',
  warning: 'yellow',
  error: 'red',
  muted: 'gray',
  highlight: 'magenta',
  info: 'blue'
};
