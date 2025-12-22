// ═══════════════════════════════════════════════════════════════════════════════
// VIBECODE CLI - Learning Engine
// Phase H5: AI learns from user feedback
// ═══════════════════════════════════════════════════════════════════════════════

import fs from 'fs/promises';
import path from 'path';
import os from 'os';

const LEARNING_DIR = '.vibecode/learning';
const GLOBAL_LEARNING_DIR = path.join(os.homedir(), '.vibecode/learning');

/**
 * Learning Engine - Records and retrieves learning data
 *
 * Features:
 * - Records fix attempts and outcomes
 * - Stores user preferences
 * - Provides suggestions based on past successes
 * - Anonymizes data for global storage
 */
export class LearningEngine {
  constructor(projectPath = process.cwd()) {
    this.projectPath = projectPath;
    this.localPath = path.join(projectPath, LEARNING_DIR);
    this.globalPath = GLOBAL_LEARNING_DIR;
  }

  /**
   * Initialize learning directories
   */
  async init() {
    await fs.mkdir(this.localPath, { recursive: true });
    await fs.mkdir(this.globalPath, { recursive: true });
  }

  /**
   * Record a fix attempt and its outcome
   */
  async recordFix(fixData) {
    await this.init();

    const record = {
      id: Date.now().toString(36),
      timestamp: new Date().toISOString(),
      errorType: fixData.errorType,
      errorMessage: fixData.errorMessage?.substring(0, 200),
      errorCategory: fixData.errorCategory,
      fixApplied: fixData.fixApplied?.substring(0, 500),
      success: fixData.success,
      userFeedback: fixData.userFeedback,
      userCorrection: fixData.userCorrection,
      projectType: await this.detectProjectType(),
      tags: fixData.tags || []
    };

    // Save to local project
    const localFile = path.join(this.localPath, 'fixes.json');
    const localFixes = await this.loadJson(localFile, []);
    localFixes.push(record);
    await this.saveJson(localFile, localFixes.slice(-100)); // Keep last 100

    // Save to global (anonymized)
    const globalFile = path.join(this.globalPath, 'fixes.json');
    const globalFixes = await this.loadJson(globalFile, []);
    globalFixes.push({
      ...record,
      errorMessage: this.anonymize(record.errorMessage),
      fixApplied: this.anonymize(record.fixApplied)
    });
    await this.saveJson(globalFile, globalFixes.slice(-500)); // Keep last 500

    return record.id;
  }

  /**
   * Record user preference
   */
  async recordPreference(key, value, context = {}) {
    await this.init();

    const prefsFile = path.join(this.localPath, 'preferences.json');
    const prefs = await this.loadJson(prefsFile, {});

    if (!prefs[key]) {
      prefs[key] = { values: [], contexts: [] };
    }

    prefs[key].values.push(value);
    prefs[key].contexts.push(context);
    prefs[key].lastUsed = new Date().toISOString();

    // Keep only recent values
    prefs[key].values = prefs[key].values.slice(-20);
    prefs[key].contexts = prefs[key].contexts.slice(-20);

    await this.saveJson(prefsFile, prefs);
  }

  /**
   * Get suggestion based on learnings
   */
  async getSuggestion(errorType, errorCategory) {
    const localFixes = await this.loadJson(
      path.join(this.localPath, 'fixes.json'),
      []
    );
    const globalFixes = await this.loadJson(
      path.join(this.globalPath, 'fixes.json'),
      []
    );

    // Find similar successful fixes
    const allFixes = [...localFixes, ...globalFixes];
    const similarFixes = allFixes.filter(f =>
      f.success &&
      (f.errorType === errorType || f.errorCategory === errorCategory)
    );

    if (similarFixes.length === 0) {
      return null;
    }

    // Calculate confidence based on success rate
    const totalSimilar = allFixes.filter(f =>
      f.errorType === errorType || f.errorCategory === errorCategory
    ).length;

    const successRate = similarFixes.length / totalSimilar;

    // Get most recent successful fix
    const recentFix = similarFixes.sort((a, b) =>
      new Date(b.timestamp) - new Date(a.timestamp)
    )[0];

    return {
      suggestion: recentFix.fixApplied,
      confidence: successRate,
      basedOn: similarFixes.length,
      lastUsed: recentFix.timestamp
    };
  }

  /**
   * Get user preference
   */
  async getPreference(key, defaultValue = null) {
    const prefsFile = path.join(this.localPath, 'preferences.json');
    const prefs = await this.loadJson(prefsFile, {});

    if (!prefs[key] || prefs[key].values.length === 0) {
      return defaultValue;
    }

    // Return most common value
    const counts = {};
    for (const v of prefs[key].values) {
      counts[v] = (counts[v] || 0) + 1;
    }

    const sorted = Object.entries(counts).sort((a, b) => b[1] - a[1]);
    return sorted[0][0];
  }

  /**
   * Get learning statistics
   */
  async getStats() {
    const localFixes = await this.loadJson(
      path.join(this.localPath, 'fixes.json'),
      []
    );
    const globalFixes = await this.loadJson(
      path.join(this.globalPath, 'fixes.json'),
      []
    );
    const prefs = await this.loadJson(
      path.join(this.localPath, 'preferences.json'),
      {}
    );

    const localSuccess = localFixes.filter(f => f.success).length;
    const globalSuccess = globalFixes.filter(f => f.success).length;

    // Group by error category
    const byCategory = {};
    for (const fix of localFixes) {
      const cat = fix.errorCategory || 'unknown';
      if (!byCategory[cat]) {
        byCategory[cat] = { total: 0, success: 0 };
      }
      byCategory[cat].total++;
      if (fix.success) byCategory[cat].success++;
    }

    return {
      local: {
        total: localFixes.length,
        success: localSuccess,
        rate: localFixes.length > 0 ? (localSuccess / localFixes.length * 100).toFixed(1) : '0'
      },
      global: {
        total: globalFixes.length,
        success: globalSuccess,
        rate: globalFixes.length > 0 ? (globalSuccess / globalFixes.length * 100).toFixed(1) : '0'
      },
      byCategory,
      preferences: Object.keys(prefs).length,
      lastLearning: localFixes[localFixes.length - 1]?.timestamp || null
    };
  }

  /**
   * Detect project type
   */
  async detectProjectType() {
    try {
      const pkgPath = path.join(this.projectPath, 'package.json');
      const pkg = JSON.parse(await fs.readFile(pkgPath, 'utf-8'));

      if (pkg.dependencies?.next) return 'nextjs';
      if (pkg.dependencies?.react) return 'react';
      if (pkg.dependencies?.vue) return 'vue';
      if (pkg.dependencies?.express) return 'express';
      if (pkg.dependencies?.['@prisma/client']) return 'prisma';

      return 'node';
    } catch {
      return 'unknown';
    }
  }

  /**
   * Anonymize sensitive data for global storage
   */
  anonymize(text) {
    if (!text) return text;
    return text
      .replace(/\/Users\/[^\/\s]+/g, '/Users/***')
      .replace(/\/home\/[^\/\s]+/g, '/home/***')
      .replace(/C:\\Users\\[^\\]+/g, 'C:\\Users\\***')
      .replace(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g, '***@***.***')
      .replace(/\b\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}\b/g, '***.***.***.***')
      .replace(/api[_-]?key[=:]\s*["']?[\w-]+["']?/gi, 'api_key=***')
      .replace(/token[=:]\s*["']?[\w-]+["']?/gi, 'token=***')
      .replace(/password[=:]\s*["']?[^"'\s]+["']?/gi, 'password=***');
  }

  /**
   * Clear all local learnings
   */
  async clearLocal() {
    await this.saveJson(path.join(this.localPath, 'fixes.json'), []);
    await this.saveJson(path.join(this.localPath, 'preferences.json'), {});
  }

  /**
   * Load JSON file
   */
  async loadJson(filePath, defaultValue) {
    try {
      const content = await fs.readFile(filePath, 'utf-8');
      return JSON.parse(content);
    } catch {
      return defaultValue;
    }
  }

  /**
   * Save JSON file
   */
  async saveJson(filePath, data) {
    await fs.writeFile(filePath, JSON.stringify(data, null, 2));
  }
}

// Singleton instance
let learningEngine = null;

/**
 * Get or create LearningEngine instance
 */
export function getLearningEngine(projectPath = process.cwd()) {
  if (!learningEngine || learningEngine.projectPath !== projectPath) {
    learningEngine = new LearningEngine(projectPath);
  }
  return learningEngine;
}

/**
 * Create a new LearningEngine instance
 */
export function createLearningEngine(projectPath = process.cwd()) {
  return new LearningEngine(projectPath);
}
