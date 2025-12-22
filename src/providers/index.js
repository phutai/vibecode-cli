// ═══════════════════════════════════════════════════════════════════════════════
// VIBECODE CLI - AI Provider Manager
// ═══════════════════════════════════════════════════════════════════════════════

export {
  spawnClaudeCode,
  isClaudeCodeAvailable,
  buildPromptWithContext,
  getProviderInfo,
  CLAUDE_CODE_CONFIG
} from './claude-code.js';

// Future providers:
// export { callAnthropicAPI } from './anthropic-api.js';
// export { spawnCursor } from './cursor.js';

/**
 * Available providers
 */
export const PROVIDERS = {
  'claude-code': {
    name: 'Claude Code',
    description: 'Official Claude CLI for coding',
    available: true
  },
  'anthropic-api': {
    name: 'Anthropic API',
    description: 'Direct API calls (coming soon)',
    available: false
  }
};

/**
 * Get provider by name
 */
export function getProvider(name) {
  return PROVIDERS[name] || null;
}

/**
 * Get default provider
 */
export function getDefaultProvider() {
  return 'claude-code';
}
