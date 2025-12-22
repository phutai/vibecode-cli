// ═══════════════════════════════════════════════════════════════════════════════
// VIBECODE CLI - Main Exports
// Spec Hash: 0fe43335f5a325e3279a079ce616c052
// ═══════════════════════════════════════════════════════════════════════════════

// Phase A Commands
export { initCommand } from './commands/init.js';
export { startCommand } from './commands/start.js';
export { statusCommand } from './commands/status.js';
export { lockCommand } from './commands/lock.js';
export { doctorCommand } from './commands/doctor.js';

// Phase B Commands
export { planCommand } from './commands/plan.js';
export { buildCommand } from './commands/build.js';
export { reviewCommand } from './commands/review.js';
export { snapshotCommand } from './commands/snapshot.js';

// Phase C Commands
export { configCommand } from './commands/config.js';

// Phase E Commands - Magic Mode
export { goCommand } from './commands/go.js';

// Phase F Commands - Agent Mode
export { agentCommand } from './commands/agent.js';

// Phase G Commands - Debug Mode
export { debugCommand } from './commands/debug.js';
export { assistCommand } from './commands/assist.js';

// Phase H Commands - Smart Defaults
export { wizardCommand } from './commands/wizard.js';

// Phase H4 Commands - Undo/Rollback
export { undoCommand } from './commands/undo.js';
export { BackupManager, withBackup, createBackupManager } from './core/backup.js';

// Phase H5 Commands - Learning Mode
export { learnCommand } from './commands/learn.js';
export { askFeedback, showLearningSuggestion } from './commands/learn.js';
export { LearningEngine, getLearningEngine, createLearningEngine } from './core/learning.js';

// Phase I Commands - Git Integration
export { gitCommand, autoCommit } from './commands/git.js';

// Phase I2 Commands - File Watcher
export { watchCommand } from './commands/watch.js';

// Phase I3 Commands - Shell Mode
export { shellCommand } from './commands/shell.js';

// Phase K Commands - Maximize Claude Code
export { testCommand } from './commands/test.js';
export { docsCommand } from './commands/docs.js';
export { refactorCommand } from './commands/refactor.js';
export { securityCommand } from './commands/security.js';
export { askCommand } from './commands/ask.js';
export { migrateCommand } from './commands/migrate.js';

// UI exports (Phase H2: Dashboard)
export {
  ProgressDashboard,
  StepProgress,
  renderInlineProgress,
  updateProgress,
  completeProgress
} from './ui/dashboard.js';

// UI exports (Phase H3: Error Translator)
export {
  translateError,
  formatTranslatedError,
  showError,
  inlineError,
  getErrorCategory,
  isErrorCategory
} from './ui/error-translator.js';

// Debug exports
export {
  DebugEngine,
  createDebugEngine,
  EvidenceCollector,
  RootCauseAnalyzer,
  FixGenerator,
  FixVerifier
} from './debug/index.js';

// Image Analysis exports (Phase I4)
export { ImageAnalyzer, analyzeScreenshot } from './debug/image-analyzer.js';
export {
  saveClipboardImage,
  imageToBase64,
  getImageInfo,
  isValidImage,
  cleanupTempImages
} from './utils/image.js';

// Agent exports
export {
  VibecodeAgent,
  createAgent,
  agentBuild,
  DecompositionEngine,
  MemoryEngine,
  SelfHealingEngine,
  Orchestrator
} from './agent/index.js';

// Constants
export { VERSION, SPEC_HASH, STATES } from './config/constants.js';

// Providers
export { PROVIDERS, getProvider, getDefaultProvider } from './providers/index.js';
