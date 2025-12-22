// ═══════════════════════════════════════════════════════════════════════════════
// VIBECODE CLI - Contract Validation & Locking
// ═══════════════════════════════════════════════════════════════════════════════

import { CONTRACT_REQUIRED_SECTIONS } from '../config/constants.js';
import { readSessionFile, writeSessionFile, sessionFileExists } from './session.js';
import { loadState, saveState } from './workspace.js';
import { generateSpecHash } from '../utils/hash.js';
import { logAudit } from './state-machine.js';

/**
 * Validate contract content
 */
export function validateContract(content) {
  const errors = [];
  const warnings = [];

  for (const section of CONTRACT_REQUIRED_SECTIONS) {
    if (!section.pattern.test(content)) {
      errors.push(`Missing required section: ${section.name}`);
    } else {
      // Check if section has content (not just header)
      const sectionMatch = content.match(new RegExp(`${section.pattern.source}[\\s\\S]*?(?=##|$)`, 'i'));
      if (sectionMatch) {
        const sectionContent = sectionMatch[0].replace(section.pattern, '').trim();
        if (sectionContent.length < 10) {
          warnings.push(`Section "${section.name}" appears to be empty or too short`);
        }
      }
    }
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings
  };
}

/**
 * Lock contract and generate spec hash
 */
export async function lockContract() {
  // Check contract exists
  if (!await sessionFileExists('contract.md')) {
    throw new Error('Contract file not found. Create contract first.');
  }

  // Read contract
  const content = await readSessionFile('contract.md');

  // Validate
  const validation = validateContract(content);
  if (!validation.valid) {
    return {
      success: false,
      errors: validation.errors,
      warnings: validation.warnings
    };
  }

  // Generate spec hash
  const timestamp = new Date().toISOString();
  const specHash = generateSpecHash(content, timestamp);

  // Update contract with spec hash and locked status
  const updatedContent = content
    .replace(/## Status: DRAFT/i, '## Status: LOCKED')
    .replace(/## Spec Hash: \[hash when locked\]/i, `## Spec Hash: ${specHash}`);

  await writeSessionFile('contract.md', updatedContent);

  // Update state
  const stateData = await loadState();
  stateData.spec_hash = specHash;
  await saveState(stateData);

  // Log
  await logAudit(`Contract locked with spec hash: ${specHash}`);

  return {
    success: true,
    specHash,
    timestamp,
    warnings: validation.warnings
  };
}

/**
 * Get current spec hash
 */
export async function getSpecHash() {
  const stateData = await loadState();
  return stateData.spec_hash;
}

/**
 * Check if contract is locked
 */
export async function isContractLocked() {
  const specHash = await getSpecHash();
  return specHash !== null;
}
