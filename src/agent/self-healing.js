// ═══════════════════════════════════════════════════════════════════════════════
// VIBECODE AGENT - Self-Healing Engine
// Automatic error analysis, fix generation, and recovery
// ═══════════════════════════════════════════════════════════════════════════════

import { analyzeErrors } from '../core/error-analyzer.js';
import { generateFixPrompt } from '../core/fix-generator.js';

/**
 * Error categories for intelligent handling
 */
const ERROR_CATEGORIES = {
  SYNTAX: {
    patterns: [/SyntaxError/, /Unexpected token/, /Parse error/],
    strategy: 'syntax_fix',
    canAutoFix: true
  },
  IMPORT: {
    patterns: [/Cannot find module/, /Module not found/, /import.*from/],
    strategy: 'import_fix',
    canAutoFix: true
  },
  TYPE: {
    patterns: [/TypeError/, /is not a function/, /undefined is not/],
    strategy: 'type_fix',
    canAutoFix: true
  },
  REFERENCE: {
    patterns: [/ReferenceError/, /is not defined/],
    strategy: 'reference_fix',
    canAutoFix: true
  },
  DEPENDENCY: {
    patterns: [/peer dep/, /ERESOLVE/, /npm ERR!/, /dependency/],
    strategy: 'dependency_fix',
    canAutoFix: true
  },
  BUILD: {
    patterns: [/Build failed/, /Compilation error/, /webpack/],
    strategy: 'build_fix',
    canAutoFix: true
  },
  TEST: {
    patterns: [/test failed/i, /Tests failed/i, /expect\(/, /AssertionError/, /FAIL/i],
    strategy: 'test_fix',
    canAutoFix: true
  },
  RUNTIME: {
    patterns: [/at runtime/, /ENOENT/, /EACCES/, /ECONNREFUSED/],
    strategy: 'runtime_fix',
    canAutoFix: false
  },
  UNKNOWN: {
    patterns: [],
    strategy: 'generic_fix',
    canAutoFix: false
  }
};

/**
 * Self-Healing Engine Class
 * Analyzes errors and generates fixes automatically
 */
export class SelfHealingEngine {
  constructor(memoryEngine = null) {
    this.memory = memoryEngine;
    this.healingHistory = [];
    this.maxRetries = 3;
  }

  /**
   * Set memory engine for learning
   */
  setMemoryEngine(memoryEngine) {
    this.memory = memoryEngine;
  }

  /**
   * Analyze an error and determine fix strategy
   */
  analyzeError(error) {
    const errorStr = typeof error === 'string' ? error : error.message || String(error);
    const errorLower = errorStr.toLowerCase();

    // Determine category
    let category = 'UNKNOWN';
    for (const [cat, config] of Object.entries(ERROR_CATEGORIES)) {
      if (config.patterns.some(p => p.test(errorStr))) {
        category = cat;
        break;
      }
    }

    const config = ERROR_CATEGORIES[category];

    // Extract file and line info if present
    const fileMatch = errorStr.match(/(?:at |in |file:?\s*)([^\s:]+):(\d+)/i);
    const file = fileMatch ? fileMatch[1] : null;
    const line = fileMatch ? parseInt(fileMatch[2]) : null;

    return {
      original: errorStr,
      category,
      strategy: config.strategy,
      canAutoFix: config.canAutoFix,
      file,
      line,
      severity: this.calculateSeverity(category, errorStr),
      suggestedActions: this.suggestActions(category, errorStr)
    };
  }

  /**
   * Calculate error severity
   */
  calculateSeverity(category, errorStr) {
    // Critical: blocks all builds
    if (['SYNTAX', 'IMPORT', 'DEPENDENCY'].includes(category)) {
      return 'critical';
    }

    // High: blocks module build
    if (['TYPE', 'REFERENCE', 'BUILD'].includes(category)) {
      return 'high';
    }

    // Medium: can continue but needs fixing
    if (category === 'TEST') {
      return 'medium';
    }

    // Low: warning-level
    return 'low';
  }

  /**
   * Suggest actions based on error type
   */
  suggestActions(category, errorStr) {
    const actions = [];

    switch (category) {
      case 'SYNTAX':
        actions.push('Check for missing brackets, semicolons, or quotes');
        actions.push('Verify JSX syntax if using React');
        break;

      case 'IMPORT':
        actions.push('Install missing package with npm install');
        actions.push('Check import path is correct');
        actions.push('Verify file exists at specified path');
        break;

      case 'TYPE':
        actions.push('Check if variable is properly initialized');
        actions.push('Verify function exists before calling');
        actions.push('Add null/undefined checks');
        break;

      case 'REFERENCE':
        actions.push('Declare variable before using');
        actions.push('Check for typos in variable names');
        actions.push('Verify import statement');
        break;

      case 'DEPENDENCY':
        actions.push('Run npm install to install dependencies');
        actions.push('Check for version conflicts');
        actions.push('Try npm install --legacy-peer-deps');
        break;

      case 'BUILD':
        actions.push('Check build configuration');
        actions.push('Verify all source files are valid');
        actions.push('Check for circular dependencies');
        break;

      case 'TEST':
        actions.push('Review test expectations');
        actions.push('Check mock data and fixtures');
        actions.push('Verify component behavior');
        break;

      default:
        actions.push('Review error message for details');
        actions.push('Check logs for more context');
    }

    return actions;
  }

  /**
   * Generate a fix for the error
   */
  async generateFix(error, context = {}) {
    const analysis = this.analyzeError(error);

    // Check memory for similar past fixes
    let historicalFix = null;
    if (this.memory) {
      const similar = this.memory.findSimilarErrors(analysis.original);
      if (similar.length > 0 && similar[0].fix) {
        historicalFix = similar[0];
      }
    }

    // Use existing fix-generator for detailed prompt
    const fixPrompt = generateFixPrompt([{
      type: (analysis?.category || 'unknown').toLowerCase(),
      message: analysis?.original || String(error),
      file: analysis?.file,
      line: analysis?.line,
      priority: analysis?.severity || 'medium'
    }], context.files || []);

    return {
      analysis,
      historicalFix,
      prompt: this.enhanceFixPrompt(fixPrompt, analysis, context),
      canAutoFix: analysis.canAutoFix,
      estimatedDifficulty: this.estimateDifficulty(analysis)
    };
  }

  /**
   * Enhance fix prompt with additional context
   */
  enhanceFixPrompt(basePrompt, analysis, context) {
    let enhanced = basePrompt;

    // Add category-specific instructions
    switch (analysis?.category) {
      case 'IMPORT':
        enhanced += `\n\n## Import Fix Guidelines
- If package is missing, create a minimal implementation or use a different approach
- If path is wrong, check the actual file structure
- Consider if the import should be a devDependency`;
        break;

      case 'TYPE':
        enhanced += `\n\n## Type Fix Guidelines
- Add proper type checking before operations
- Initialize variables with appropriate default values
- Consider using optional chaining (?.) for nested access`;
        break;

      case 'TEST':
        enhanced += `\n\n## Test Fix Guidelines
- Match implementation behavior, not the other way around
- Update test expectations if implementation is correct
- Ensure mocks return appropriate data`;
        break;
    }

    // Add context from previous modules
    if (context.completedModules && context.completedModules.length > 0) {
      enhanced += `\n\n## Context from Previous Modules
The following modules are already built and should be referenced:
${context.completedModules.map(m => `- ${m}`).join('\n')}`;
    }

    // Add historical fix info if available
    if (context.historicalFix) {
      enhanced += `\n\n## Similar Error Fixed Before
Previous fix: ${context.historicalFix}
Apply similar approach if applicable.`;
    }

    return enhanced;
  }

  /**
   * Estimate fix difficulty
   */
  estimateDifficulty(analysis) {
    if (analysis.severity === 'critical') return 'complex';
    if (analysis.severity === 'high') return 'moderate';
    if (!analysis.canAutoFix) return 'complex';
    return 'simple';
  }

  /**
   * Attempt to heal (fix and retry)
   */
  async heal(error, moduleId, context = {}) {
    const fix = await this.generateFix(error, context);

    const healingRecord = {
      id: `heal_${Date.now()}`,
      moduleId,
      error: fix.analysis,
      fix,
      attempt: (context.attempt || 0) + 1,
      timestamp: new Date().toISOString(),
      status: 'pending'
    };

    this.healingHistory.push(healingRecord);

    // Record in memory
    if (this.memory && fix?.analysis) {
      await this.memory.recordError({
        message: fix.analysis.original || String(error),
        type: fix.analysis.category || 'UNKNOWN',
        moduleId,
        file: fix.analysis.file,
        line: fix.analysis.line,
        severity: fix.analysis.severity || 'medium'
      });
    }

    return {
      ...healingRecord,
      shouldRetry: fix.canAutoFix && healingRecord.attempt <= this.maxRetries,
      prompt: fix.prompt
    };
  }

  /**
   * Report successful fix
   */
  async reportSuccess(healingId) {
    const record = this.healingHistory.find(h => h.id === healingId);
    if (record) {
      record.status = 'success';
      record.completedAt = new Date().toISOString();

      // Record in memory
      if (this.memory && record.error) {
        await this.memory.recordLearning({
          type: 'fix_success',
          errorType: record.error?.category || 'UNKNOWN',
          module: record.moduleId,
          outcome: 'success',
          details: `Fixed ${record.error?.category || 'unknown'} error in ${record.error?.file || 'unknown file'}`
        });
      }
    }
    return record;
  }

  /**
   * Report failed fix
   */
  async reportFailure(healingId, reason) {
    const record = this.healingHistory.find(h => h.id === healingId);
    if (record) {
      record.status = 'failed';
      record.failureReason = reason;
      record.completedAt = new Date().toISOString();

      // Record in memory
      if (this.memory) {
        await this.memory.recordLearning({
          type: 'fix_failure',
          errorType: record.error?.category,
          module: record.moduleId,
          outcome: 'failure',
          reason
        });
      }
    }
    return record;
  }

  /**
   * Batch analyze multiple errors
   */
  batchAnalyze(errors) {
    const analyzed = errors.map(e => this.analyzeError(e));

    // Sort by severity and group by category
    const grouped = {};
    for (const error of analyzed) {
      const cat = error?.category || 'UNKNOWN';
      if (!grouped[cat]) {
        grouped[cat] = [];
      }
      grouped[cat].push(error);
    }

    // Prioritize fixes
    const priority = ['SYNTAX', 'IMPORT', 'DEPENDENCY', 'REFERENCE', 'TYPE', 'BUILD', 'TEST', 'RUNTIME', 'UNKNOWN'];
    const ordered = [];
    for (const cat of priority) {
      if (grouped[cat]) {
        ordered.push(...grouped[cat]);
      }
    }

    return {
      total: errors.length,
      byCategory: grouped,
      prioritized: ordered,
      criticalCount: analyzed.filter(e => e.severity === 'critical').length,
      canAutoFixCount: analyzed.filter(e => e.canAutoFix).length
    };
  }

  /**
   * Generate combined fix prompt for multiple errors
   */
  generateCombinedFixPrompt(errors, context = {}) {
    const batchAnalysis = this.batchAnalyze(errors);

    let prompt = `# Fix Multiple Errors\n\n`;
    prompt += `Found ${batchAnalysis.total} errors (${batchAnalysis.criticalCount} critical)\n\n`;

    // Group by file for efficient fixing
    const byFile = {};
    for (const error of batchAnalysis.prioritized) {
      const file = error.file || 'unknown';
      if (!byFile[file]) {
        byFile[file] = [];
      }
      byFile[file].push(error);
    }

    for (const [file, fileErrors] of Object.entries(byFile)) {
      prompt += `## File: ${file}\n\n`;
      for (const error of fileErrors) {
        const cat = error?.category || 'UNKNOWN';
        prompt += `### ${cat} Error${error?.line ? ` (line ${error.line})` : ''}\n`;
        prompt += `${error?.original || 'Unknown error'}\n\n`;
        prompt += `Actions:\n${(error?.suggestedActions || ['Review error']).map(a => `- ${a}`).join('\n')}\n\n`;
      }
    }

    prompt += `## Fix Instructions\n`;
    prompt += `1. Start with SYNTAX and IMPORT errors (they often cause other errors)\n`;
    prompt += `2. Fix one file at a time, top to bottom\n`;
    prompt += `3. Verify each fix before moving to the next\n`;
    prompt += `4. Run tests after all fixes\n`;

    return prompt;
  }

  /**
   * Get healing statistics
   */
  getStats() {
    const total = this.healingHistory.length;
    const successful = this.healingHistory.filter(h => h.status === 'success').length;
    const failed = this.healingHistory.filter(h => h.status === 'failed').length;

    const byCategory = {};
    for (const record of this.healingHistory) {
      const cat = record.error?.category || 'UNKNOWN';
      if (!byCategory[cat]) {
        byCategory[cat] = { total: 0, success: 0, failed: 0 };
      }
      byCategory[cat].total++;
      if (record.status === 'success') byCategory[cat].success++;
      if (record.status === 'failed') byCategory[cat].failed++;
    }

    return {
      total,
      successful,
      failed,
      pending: total - successful - failed,
      successRate: total > 0 ? (successful / total * 100).toFixed(1) + '%' : 'N/A',
      byCategory
    };
  }

  /**
   * Check if module should be skipped due to repeated failures
   */
  shouldSkipModule(moduleId) {
    const moduleRecords = this.healingHistory.filter(h => h.moduleId === moduleId);
    const failures = moduleRecords.filter(h => h.status === 'failed').length;
    return failures >= this.maxRetries;
  }

  /**
   * Get recovery suggestions for a stuck module
   */
  getRecoverySuggestions(moduleId) {
    const moduleRecords = this.healingHistory.filter(h => h.moduleId === moduleId);

    if (moduleRecords.length === 0) {
      return ['No healing attempts recorded for this module'];
    }

    const suggestions = [];
    const categories = [...new Set(moduleRecords.map(r => r.error?.category))];

    if (categories.includes('DEPENDENCY')) {
      suggestions.push('Try running: npm install --legacy-peer-deps');
      suggestions.push('Check package.json for version conflicts');
    }

    if (categories.includes('IMPORT')) {
      suggestions.push('Verify all import paths match actual file structure');
      suggestions.push('Consider using relative imports instead of aliases');
    }

    if (moduleRecords.length >= this.maxRetries) {
      suggestions.push('Consider simplifying the module requirements');
      suggestions.push('Split the module into smaller, more focused components');
      suggestions.push('Manual intervention may be required');
    }

    return suggestions;
  }
}

/**
 * Create self-healing engine instance
 */
export function createSelfHealingEngine(memoryEngine = null) {
  return new SelfHealingEngine(memoryEngine);
}

export { ERROR_CATEGORIES };
