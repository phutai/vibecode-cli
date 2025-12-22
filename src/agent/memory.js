// ═══════════════════════════════════════════════════════════════════════════════
// VIBECODE AGENT - Memory Engine
// Persistent context and learning across module builds
// ═══════════════════════════════════════════════════════════════════════════════

import fs from 'fs-extra';
import path from 'path';

/**
 * Memory categories for organization
 */
const MEMORY_CATEGORIES = {
  DECISIONS: 'decisions',      // Architectural/design decisions made
  PATTERNS: 'patterns',        // Code patterns discovered/used
  ERRORS: 'errors',            // Errors encountered and how they were fixed
  FILES: 'files',              // Files created/modified
  CONTEXT: 'context',          // Project context and requirements
  LEARNINGS: 'learnings'       // What worked/didn't work
};

/**
 * Memory Engine Class
 * Maintains persistent context across module builds
 */
export class MemoryEngine {
  constructor(memoryPath) {
    this.memoryPath = memoryPath;
    this.memory = {
      version: '1.0.0',
      created: new Date().toISOString(),
      updated: new Date().toISOString(),
      projectContext: {},
      modules: {},
      decisions: [],
      patterns: [],
      errors: [],
      files: {},
      learnings: [],
      globalContext: ''
    };
    this.loaded = false;
  }

  /**
   * Initialize memory storage
   */
  async initialize() {
    await fs.ensureDir(path.dirname(this.memoryPath));

    if (await fs.pathExists(this.memoryPath)) {
      await this.load();
    } else {
      await this.save();
    }

    this.loaded = true;
    return this;
  }

  /**
   * Load memory from disk
   */
  async load() {
    try {
      const data = await fs.readJson(this.memoryPath);
      this.memory = { ...this.memory, ...data };
      this.loaded = true;
    } catch (error) {
      console.warn(`Could not load memory: ${error.message}`);
    }
    return this.memory;
  }

  /**
   * Save memory to disk
   */
  async save() {
    this.memory.updated = new Date().toISOString();
    await fs.writeJson(this.memoryPath, this.memory, { spaces: 2 });
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // PROJECT CONTEXT
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * Set project context
   */
  setProjectContext(context) {
    this.memory.projectContext = {
      ...this.memory.projectContext,
      ...context,
      updatedAt: new Date().toISOString()
    };
    return this.save();
  }

  /**
   * Get project context
   */
  getProjectContext() {
    return this.memory.projectContext;
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // MODULE MEMORY
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * Start tracking a module
   */
  startModule(moduleId, moduleData) {
    this.memory.modules[moduleId] = {
      ...moduleData,
      startedAt: new Date().toISOString(),
      status: 'in_progress',
      attempts: 0,
      files: [],
      errors: [],
      decisions: []
    };
    return this.save();
  }

  /**
   * Update module status
   */
  async updateModule(moduleId, updates) {
    if (this.memory.modules[moduleId]) {
      this.memory.modules[moduleId] = {
        ...this.memory.modules[moduleId],
        ...updates,
        updatedAt: new Date().toISOString()
      };
      await this.save();
    }
    return this.memory.modules[moduleId];
  }

  /**
   * Complete a module
   */
  async completeModule(moduleId, result) {
    return this.updateModule(moduleId, {
      status: 'completed',
      completedAt: new Date().toISOString(),
      result
    });
  }

  /**
   * Fail a module
   */
  async failModule(moduleId, error) {
    const mod = this.memory.modules[moduleId];
    if (mod) {
      mod.attempts = (mod.attempts || 0) + 1;
      mod.errors.push({
        error: error.message || error,
        timestamp: new Date().toISOString()
      });
      mod.status = 'failed';
      await this.save();
    }
    return mod;
  }

  /**
   * Get module memory
   */
  getModule(moduleId) {
    return this.memory.modules[moduleId];
  }

  /**
   * Get all completed modules
   */
  getCompletedModules() {
    return Object.entries(this.memory.modules)
      .filter(([_, mod]) => mod.status === 'completed')
      .map(([id, mod]) => ({ id, ...mod }));
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // DECISIONS
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * Record a decision
   */
  async recordDecision(decision) {
    this.memory.decisions.push({
      ...decision,
      id: `dec_${Date.now()}`,
      timestamp: new Date().toISOString()
    });
    await this.save();
    return decision;
  }

  /**
   * Get decisions by category
   */
  getDecisions(category = null) {
    if (!category) return this.memory.decisions;
    return this.memory.decisions.filter(d => d.category === category);
  }

  /**
   * Get decisions for a specific module
   */
  getModuleDecisions(moduleId) {
    return this.memory.decisions.filter(d => d.moduleId === moduleId);
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // PATTERNS
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * Record a code pattern
   */
  async recordPattern(pattern) {
    // Check if similar pattern exists
    const existing = this.memory.patterns.find(p =>
      p.name === pattern.name || p.pattern === pattern.pattern
    );

    if (existing) {
      existing.usageCount = (existing.usageCount || 1) + 1;
      existing.lastUsed = new Date().toISOString();
    } else {
      this.memory.patterns.push({
        ...pattern,
        id: `pat_${Date.now()}`,
        usageCount: 1,
        discoveredAt: new Date().toISOString(),
        lastUsed: new Date().toISOString()
      });
    }

    await this.save();
    return pattern;
  }

  /**
   * Get patterns by type
   */
  getPatterns(type = null) {
    if (!type) return this.memory.patterns;
    return this.memory.patterns.filter(p => p.type === type);
  }

  /**
   * Get most used patterns
   */
  getPopularPatterns(limit = 5) {
    return [...this.memory.patterns]
      .sort((a, b) => (b.usageCount || 0) - (a.usageCount || 0))
      .slice(0, limit);
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // ERRORS & FIXES
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * Record an error and its fix
   */
  async recordError(error) {
    this.memory.errors.push({
      ...error,
      id: `err_${Date.now()}`,
      timestamp: new Date().toISOString()
    });
    await this.save();
    return error;
  }

  /**
   * Record a fix for an error
   */
  async recordFix(errorId, fix) {
    const error = this.memory.errors.find(e => e.id === errorId);
    if (error) {
      error.fix = fix;
      error.fixed = true;
      error.fixedAt = new Date().toISOString();
      await this.save();
    }
    return error;
  }

  /**
   * Find similar errors from history
   */
  findSimilarErrors(errorMessage) {
    const keywords = errorMessage.toLowerCase().split(/\s+/).filter(w => w.length > 3);

    return this.memory.errors
      .filter(e => e.fixed && e.fix)
      .map(e => {
        const errorText = (e.message || '').toLowerCase();
        const matchCount = keywords.filter(kw => errorText.includes(kw)).length;
        return { error: e, matchScore: matchCount / keywords.length };
      })
      .filter(item => item.matchScore > 0.3)
      .sort((a, b) => b.matchScore - a.matchScore)
      .map(item => item.error);
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // FILES
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * Record a file creation/modification
   */
  async recordFile(filePath, metadata) {
    this.memory.files[filePath] = {
      ...metadata,
      path: filePath,
      updatedAt: new Date().toISOString()
    };
    await this.save();
    return this.memory.files[filePath];
  }

  /**
   * Get all recorded files
   */
  getFiles() {
    return this.memory.files;
  }

  /**
   * Get files by module
   */
  getFilesByModule(moduleId) {
    return Object.values(this.memory.files)
      .filter(f => f.moduleId === moduleId);
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // LEARNINGS
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * Record a learning (what worked/didn't work)
   */
  async recordLearning(learning) {
    this.memory.learnings.push({
      ...learning,
      id: `learn_${Date.now()}`,
      timestamp: new Date().toISOString()
    });
    await this.save();
    return learning;
  }

  /**
   * Get positive learnings (what worked)
   */
  getPositiveLearnings() {
    return this.memory.learnings.filter(l => l.outcome === 'success');
  }

  /**
   * Get negative learnings (what didn't work)
   */
  getNegativeLearnings() {
    return this.memory.learnings.filter(l => l.outcome === 'failure');
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // CONTEXT GENERATION
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * Generate context summary for Claude Code
   */
  generateContextSummary() {
    const completed = this.getCompletedModules();
    const patterns = this.getPopularPatterns(3);
    const recentDecisions = this.memory.decisions.slice(-5);

    let summary = `# Agent Memory Context\n\n`;

    // Project Context
    if (this.memory.projectContext.description) {
      summary += `## Project\n${this.memory.projectContext.description}\n\n`;
    }

    // Completed Modules
    if (completed.length > 0) {
      summary += `## Completed Modules (${completed.length})\n`;
      for (const mod of completed) {
        summary += `- **${mod.name || mod.id}**: ${mod.files?.length || 0} files\n`;
      }
      summary += '\n';
    }

    // Key Patterns
    if (patterns.length > 0) {
      summary += `## Established Patterns\n`;
      for (const pat of patterns) {
        summary += `- **${pat.name}**: ${pat.description || pat.pattern}\n`;
      }
      summary += '\n';
    }

    // Recent Decisions
    if (recentDecisions.length > 0) {
      summary += `## Recent Decisions\n`;
      for (const dec of recentDecisions) {
        summary += `- ${dec.decision}: ${dec.reason || ''}\n`;
      }
      summary += '\n';
    }

    // File Structure
    const files = Object.keys(this.memory.files);
    if (files.length > 0) {
      summary += `## Created Files (${files.length})\n`;
      summary += '```\n';
      summary += files.slice(0, 20).join('\n');
      if (files.length > 20) {
        summary += `\n... and ${files.length - 20} more`;
      }
      summary += '\n```\n';
    }

    return summary;
  }

  /**
   * Get condensed context for prompts (shorter version)
   */
  getCondensedContext() {
    const completed = this.getCompletedModules();
    const files = Object.keys(this.memory.files);

    return {
      projectType: this.memory.projectContext.type,
      completedModules: completed.map(m => m.id),
      fileCount: files.length,
      recentFiles: files.slice(-10),
      patterns: this.getPopularPatterns(3).map(p => p.name),
      errorCount: this.memory.errors.length,
      fixedCount: this.memory.errors.filter(e => e.fixed).length
    };
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // UTILITIES
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * Get memory statistics
   */
  getStats() {
    return {
      modulesTotal: Object.keys(this.memory.modules).length,
      modulesCompleted: Object.values(this.memory.modules).filter(m => m.status === 'completed').length,
      modulesFailed: Object.values(this.memory.modules).filter(m => m.status === 'failed').length,
      decisionsCount: this.memory.decisions.length,
      patternsCount: this.memory.patterns.length,
      errorsTotal: this.memory.errors.length,
      errorsFixed: this.memory.errors.filter(e => e.fixed).length,
      filesCreated: Object.keys(this.memory.files).length,
      learningsCount: this.memory.learnings.length
    };
  }

  /**
   * Clear all memory (reset)
   */
  async clear() {
    this.memory = {
      version: '1.0.0',
      created: new Date().toISOString(),
      updated: new Date().toISOString(),
      projectContext: {},
      modules: {},
      decisions: [],
      patterns: [],
      errors: [],
      files: {},
      learnings: [],
      globalContext: ''
    };
    await this.save();
  }

  /**
   * Export memory to markdown report
   */
  exportToMarkdown() {
    let md = `# Vibecode Agent Memory Report\n\n`;
    md += `Generated: ${new Date().toISOString()}\n\n`;

    // Stats
    const stats = this.getStats();
    md += `## Statistics\n`;
    md += `| Metric | Value |\n|--------|-------|\n`;
    for (const [key, value] of Object.entries(stats)) {
      md += `| ${key} | ${value} |\n`;
    }
    md += '\n';

    // Context Summary
    md += this.generateContextSummary();

    // Errors and Fixes
    if (this.memory.errors.length > 0) {
      md += `## Error History\n\n`;
      for (const err of this.memory.errors.slice(-10)) {
        md += `### ${err.type || 'Error'}\n`;
        md += `- Message: ${err.message}\n`;
        md += `- Module: ${err.moduleId || 'N/A'}\n`;
        if (err.fix) {
          md += `- Fix: ${err.fix}\n`;
        }
        md += '\n';
      }
    }

    return md;
  }
}

/**
 * Create memory engine instance
 */
export async function createMemoryEngine(projectPath) {
  const memoryPath = path.join(projectPath, '.vibecode', 'agent', 'memory.json');
  const engine = new MemoryEngine(memoryPath);
  await engine.initialize();
  return engine;
}

export { MEMORY_CATEGORIES };
