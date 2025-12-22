// ═══════════════════════════════════════════════════════════════════════════════
// VIBECODE CLI - Error Analyzer
// Intelligent error analysis for iterative builds
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Analyze test results and extract actionable errors
 * @param {TestResults} testResult - Results from test runner
 * @returns {AnalyzedError[]}
 */
export function analyzeErrors(testResult) {
  const errors = [];

  for (const test of testResult.tests) {
    if (!test.passed) {
      const testErrors = test.errors || [];

      for (const error of testErrors) {
        errors.push({
          source: test.name,
          type: categorizeError(error),
          file: error.file || null,
          line: error.line || null,
          column: error.column || null,
          message: error.message,
          suggestion: generateSuggestion(error),
          priority: calculatePriority(error),
          raw: error.raw
        });
      }

      // If no specific errors but test failed, add generic error
      if (testErrors.length === 0) {
        errors.push({
          source: test.name,
          type: 'unknown',
          message: test.error || `${test.name} failed`,
          suggestion: `Check ${test.name} output for details`,
          priority: 'medium',
          raw: test.output
        });
      }
    }
  }

  // Sort by priority
  return errors.sort((a, b) => {
    const priorityOrder = { critical: 0, high: 1, medium: 2, low: 3 };
    return (priorityOrder[a.priority] || 2) - (priorityOrder[b.priority] || 2);
  });
}

/**
 * Categorize error type
 */
function categorizeError(error) {
  const message = (error.message || '').toLowerCase();
  const raw = (error.raw || '').toLowerCase();
  const combined = message + ' ' + raw;

  if (combined.includes('syntaxerror') || combined.includes('unexpected token')) {
    return 'syntax';
  }
  if (combined.includes('typeerror') || combined.includes('type error') || combined.includes('is not a function')) {
    return 'type';
  }
  if (combined.includes('referenceerror') || combined.includes('is not defined')) {
    return 'reference';
  }
  if (combined.includes('import') || combined.includes('require') || combined.includes('module not found')) {
    return 'import';
  }
  if (combined.includes('eslint') || combined.includes('lint')) {
    return 'lint';
  }
  if (combined.includes('test') || combined.includes('expect') || combined.includes('assert')) {
    return 'test';
  }
  if (combined.includes('typescript') || combined.includes('ts(')) {
    return 'typescript';
  }
  if (combined.includes('build') || combined.includes('compile')) {
    return 'build';
  }

  return 'unknown';
}

/**
 * Generate fix suggestion based on error type
 */
function generateSuggestion(error) {
  const type = categorizeError(error);
  const message = error.message || '';

  switch (type) {
    case 'syntax':
      return 'Check for missing brackets, semicolons, or typos near the error location';

    case 'type':
      if (message.includes('undefined')) {
        return 'Check if the variable/property is properly initialized';
      }
      if (message.includes('is not a function')) {
        return 'Verify the function exists and is properly imported';
      }
      return 'Check type compatibility and ensure proper type handling';

    case 'reference':
      return 'Ensure the variable/function is defined or imported before use';

    case 'import':
      if (message.includes('module not found')) {
        return 'Install missing package with npm install or fix import path';
      }
      return 'Check import path and ensure the module exports correctly';

    case 'lint':
      return 'Fix the linting issue as specified in the error message';

    case 'test':
      return 'Update the implementation to match expected behavior, or fix the test assertion';

    case 'typescript':
      return 'Fix type errors by adding proper types or type guards';

    case 'build':
      return 'Check build configuration and dependencies';

    default:
      return 'Review the error message and fix accordingly';
  }
}

/**
 * Calculate error priority
 */
function calculatePriority(error) {
  const type = categorizeError(error);

  // Critical - blocks everything
  if (type === 'syntax' || type === 'import') {
    return 'critical';
  }

  // High - likely causes cascading failures
  if (type === 'reference' || type === 'type') {
    return 'high';
  }

  // Medium - should be fixed
  if (type === 'typescript' || type === 'build' || type === 'test') {
    return 'medium';
  }

  // Low - nice to fix
  if (type === 'lint') {
    return 'low';
  }

  return 'medium';
}

/**
 * Group errors by file for better organization
 */
export function groupErrorsByFile(errors) {
  const grouped = {};

  for (const error of errors) {
    const file = error.file || 'unknown';
    if (!grouped[file]) {
      grouped[file] = [];
    }
    grouped[file].push(error);
  }

  return grouped;
}

/**
 * Get unique files with errors
 */
export function getAffectedFiles(errors) {
  const files = new Set();
  for (const error of errors) {
    if (error.file) {
      files.add(error.file);
    }
  }
  return Array.from(files);
}

/**
 * Format errors for display
 */
export function formatErrors(errors) {
  const lines = [];

  lines.push(`Found ${errors.length} error(s):`);
  lines.push('');

  const grouped = groupErrorsByFile(errors);

  for (const [file, fileErrors] of Object.entries(grouped)) {
    lines.push(`📄 ${file}`);
    for (const error of fileErrors) {
      const loc = error.line ? `:${error.line}` : '';
      const priority = error.priority === 'critical' ? '🔴' :
                       error.priority === 'high' ? '🟠' :
                       error.priority === 'medium' ? '🟡' : '🟢';
      lines.push(`   ${priority} ${error.type}: ${error.message?.substring(0, 60) || 'Unknown error'}`);
    }
  }

  return lines.join('\n');
}

/**
 * Create a summary of errors for logging
 */
export function createErrorSummary(errors) {
  const byType = {};
  const byPriority = { critical: 0, high: 0, medium: 0, low: 0 };

  for (const error of errors) {
    byType[error.type] = (byType[error.type] || 0) + 1;
    byPriority[error.priority] = (byPriority[error.priority] || 0) + 1;
  }

  return {
    total: errors.length,
    byType,
    byPriority,
    files: getAffectedFiles(errors)
  };
}
