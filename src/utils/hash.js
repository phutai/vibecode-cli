// ═══════════════════════════════════════════════════════════════════════════════
// VIBECODE CLI - Hash Utilities
// ═══════════════════════════════════════════════════════════════════════════════

import crypto from 'crypto';

/**
 * Generate SHA256 hash (first 32 chars)
 */
export function generateHash(content) {
  return crypto
    .createHash('sha256')
    .update(content)
    .digest('hex')
    .substring(0, 32);
}

/**
 * Generate spec hash from contract content
 */
export function generateSpecHash(contractContent, timestamp) {
  const hashInput = `${contractContent}_${timestamp}`;
  return generateHash(hashInput);
}

/**
 * Generate session ID
 */
export function generateSessionId() {
  const now = new Date();
  const timestamp = now.toISOString().replace(/[:.]/g, '-').substring(0, 19);
  const random = Math.random().toString(36).substring(2, 6);
  return `${timestamp}_session-${random}`;
}
