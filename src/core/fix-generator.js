// ═══════════════════════════════════════════════════════════════════════════════
// VIBECODE CLI - Fix Generator
// Generate fix prompts for iterative builds
// ═══════════════════════════════════════════════════════════════════════════════

import { formatErrors, createErrorSummary } from './error-analyzer.js';

/**
 * Generate a fix prompt based on errors from previous iteration
 * @param {AnalyzedError[]} errors - Analyzed errors from test runner
 * @param {string} originalPack - Original coder pack content
 * @param {number} iteration - Current iteration number
 * @returns {string} - Fix prompt for Claude Code
 */
export function generateFixPrompt(errors, originalPack, iteration = 1) {
  const summary = createErrorSummary(errors);

  const sections = [
    '# 🔧 FIX REQUIRED - Iteration ' + iteration,
    '',
    `The previous build had **${errors.length} error(s)**. Please fix them.`,
    '',
    '---',
    '',
    '## 📋 Error Summary',
    '',
    `- **Total Errors:** ${summary.total}`,
    `- **Critical:** ${summary.byPriority.critical}`,
    `- **High:** ${summary.byPriority.high}`,
    `- **Medium:** ${summary.byPriority.medium}`,
    `- **Low:** ${summary.byPriority.low}`,
    '',
    `**Affected Files:** ${summary.files.length > 0 ? summary.files.join(', ') : 'Unknown'}`,
    '',
    '---',
    '',
    '## 🚨 Errors to Fix',
    '',
  ];

  // Add detailed errors grouped by priority
  const byPriority = groupByPriority(errors);

  for (const [priority, priorityErrors] of Object.entries(byPriority)) {
    if (priorityErrors.length === 0) continue;

    const emoji = priority === 'critical' ? '🔴' :
                  priority === 'high' ? '🟠' :
                  priority === 'medium' ? '🟡' : '🟢';

    sections.push(`### ${emoji} ${priority.toUpperCase()} Priority`);
    sections.push('');

    for (const error of priorityErrors) {
      const location = error.file
        ? `\`${error.file}${error.line ? ':' + error.line : ''}\``
        : 'Unknown location';

      sections.push(`**${error.type}** at ${location}`);
      sections.push(`- Message: ${error.message}`);
      sections.push(`- Suggestion: ${error.suggestion}`);
      if (error.raw && error.raw !== error.message) {
        sections.push(`- Raw output: \`${truncate(error.raw, 200)}\``);
      }
      sections.push('');
    }
  }

  sections.push('---');
  sections.push('');
  sections.push('## 📝 Original Task Reference');
  sections.push('');
  sections.push('<details>');
  sections.push('<summary>Click to expand original task</summary>');
  sections.push('');
  sections.push(originalPack);
  sections.push('');
  sections.push('</details>');
  sections.push('');
  sections.push('---');
  sections.push('');
  sections.push('## ⚡ Fix Instructions');
  sections.push('');
  sections.push('1. **Fix ONLY the errors listed above** - Do not refactor or change working code');
  sections.push('2. **Start with CRITICAL errors** - They likely cause cascading failures');
  sections.push('3. **Run tests after each fix** - Verify the error is resolved');
  sections.push('4. **Keep changes minimal** - Focus on the specific issue');
  sections.push('');
  sections.push('When all errors are fixed, the build will be validated again.');
  sections.push('');

  return sections.join('\n');
}

/**
 * Generate a minimal fix prompt for single error
 */
export function generateSingleFixPrompt(error) {
  const location = error.file
    ? `${error.file}${error.line ? ':' + error.line : ''}`
    : 'unknown location';

  return `# Fix Required

**Error Type:** ${error.type}
**Location:** ${location}
**Message:** ${error.message}

**Suggestion:** ${error.suggestion}

Please fix this specific error. Keep the change minimal and focused.`;
}

/**
 * Generate iteration context for logging
 */
export function generateIterationContext(iteration, errors, duration) {
  return {
    iteration,
    timestamp: new Date().toISOString(),
    errorCount: errors.length,
    errorTypes: [...new Set(errors.map(e => e.type))],
    affectedFiles: [...new Set(errors.filter(e => e.file).map(e => e.file))],
    duration
  };
}

/**
 * Group errors by priority
 */
function groupByPriority(errors) {
  const grouped = {
    critical: [],
    high: [],
    medium: [],
    low: []
  };

  for (const error of errors) {
    const priority = error.priority || 'medium';
    if (grouped[priority]) {
      grouped[priority].push(error);
    } else {
      grouped.medium.push(error);
    }
  }

  return grouped;
}

/**
 * Truncate string with ellipsis
 */
function truncate(str, maxLen) {
  if (!str) return '';
  if (str.length <= maxLen) return str;
  return str.substring(0, maxLen - 3) + '...';
}

/**
 * Check if errors are fixable (not system/config errors)
 */
export function areErrorsFixable(errors) {
  // If all errors are unknown type with no file info, might be config issue
  const unknownWithoutFile = errors.filter(e => e.type === 'unknown' && !e.file);

  if (unknownWithoutFile.length === errors.length) {
    return {
      fixable: false,
      reason: 'All errors are unstructured with no file information. This may indicate a configuration or environment issue.'
    };
  }

  return { fixable: true };
}

/**
 * Estimate fix complexity
 */
export function estimateFixComplexity(errors) {
  let score = 0;

  for (const error of errors) {
    switch (error.priority) {
      case 'critical': score += 3; break;
      case 'high': score += 2; break;
      case 'medium': score += 1; break;
      case 'low': score += 0.5; break;
    }
  }

  if (score <= 3) return 'simple';
  if (score <= 8) return 'moderate';
  return 'complex';
}
