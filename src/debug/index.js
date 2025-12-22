// ═══════════════════════════════════════════════════════════════════════════════
// VIBECODE DEBUG - Main Debug Engine
// Orchestrates the 9-step intelligent debugging workflow
// ═══════════════════════════════════════════════════════════════════════════════
//
// The 9-Step Debug Protocol:
// 1. EVIDENCE    - Gather error information
// 2. REPRODUCE   - Confirm the error exists
// 3. ANALYZE     - Identify root cause
// 4. HYPOTHESIZE - Generate fix hypotheses
// 5. TEST        - Test hypothesis validity
// 6. FIX         - Apply the fix via Claude Code
// 7. VERIFY      - Confirm the fix works
// 8. DOCUMENT    - Log the fix for future reference
// 9. PREVENT     - Add prevention rules to CLAUDE.md
//
// ═══════════════════════════════════════════════════════════════════════════════

import { exec } from 'child_process';
import { promisify } from 'util';
import fs from 'fs-extra';
import path from 'path';
import chalk from 'chalk';

import { EvidenceCollector } from './evidence.js';
import { RootCauseAnalyzer } from './analyzer.js';
import { FixGenerator } from './fixer.js';
import { FixVerifier } from './verifier.js';
import { spawnClaudeCode, isClaudeCodeAvailable } from '../providers/index.js';
import { translateError, formatTranslatedError } from '../ui/error-translator.js';
import { getLearningEngine } from '../core/learning.js';
import { askFeedback, showLearningSuggestion } from '../commands/learn.js';

const execAsync = promisify(exec);

/**
 * Debug Engine Class
 * Main orchestrator for the debugging workflow
 */
export class DebugEngine {
  constructor(projectPath, options = {}) {
    this.projectPath = projectPath;
    this.options = {
      autoFix: options.autoFix || false,
      maxAttempts: options.maxAttempts || 3,
      verbose: options.verbose || false,
      interactive: options.interactive !== false,
      ...options
    };

    // Initialize components
    this.evidence = new EvidenceCollector(projectPath);
    this.analyzer = new RootCauseAnalyzer();
    this.fixer = new FixGenerator(projectPath);
    this.verifier = new FixVerifier(projectPath);

    // Debug session state
    this.session = {
      id: `debug-${Date.now()}`,
      startTime: new Date().toISOString(),
      steps: [],
      attempts: 0,
      resolved: false
    };
  }

  /**
   * Run the full debug workflow
   */
  async debug(input) {
    console.log(chalk.cyan.bold('\n🔍 VIBECODE DEBUG - Intelligent Bug Fixing\n'));

    try {
      // Step 1: EVIDENCE - Gather error information
      this.logStep(1, 'EVIDENCE', 'Gathering error information...');
      const evidence = await this.evidence.collect(input);
      this.session.steps.push({ step: 'EVIDENCE', data: evidence });
      this.logEvidence(evidence);

      // Step 2: REPRODUCE - Confirm error exists (if auto mode)
      if (input.auto) {
        this.logStep(2, 'REPRODUCE', 'Confirming error exists...');
        const reproduced = await this.reproduce(evidence);
        this.session.steps.push({ step: 'REPRODUCE', data: reproduced });

        if (!reproduced.errorFound) {
          console.log(chalk.green('  ✓ No errors found during reproduction check'));
          return this.createResult('no_error', 'No errors found to fix');
        }
      }

      // Step 3: ANALYZE - Identify root cause
      this.logStep(3, 'ANALYZE', 'Analyzing root cause...');
      const analysis = await this.analyzer.analyze(evidence);
      this.session.steps.push({ step: 'ANALYZE', data: analysis });
      this.logAnalysis(analysis);

      // Step 4: HYPOTHESIZE - Generate fix hypotheses
      this.logStep(4, 'HYPOTHESIZE', 'Generating fix hypotheses...');
      const hypotheses = this.analyzer.buildHypotheses(analysis);
      this.session.steps.push({ step: 'HYPOTHESIZE', data: hypotheses });
      this.logHypotheses(hypotheses);

      if (hypotheses.length === 0) {
        console.log(chalk.yellow('  ⚠ No fix hypotheses generated'));
        return this.createResult('no_hypothesis', 'Could not generate fix hypotheses');
      }

      // Check for learning-based suggestions
      await showLearningSuggestion(evidence.type, evidence.category);

      // Step 5-7: TEST, FIX, VERIFY - Attempt fixes
      let fixResult = null;
      for (let attempt = 0; attempt < this.options.maxAttempts && !this.session.resolved; attempt++) {
        this.session.attempts = attempt + 1;

        const hypothesis = hypotheses[attempt % hypotheses.length];
        console.log(chalk.cyan(`\n  Attempt ${attempt + 1}/${this.options.maxAttempts}:`));

        // Step 5: TEST - Generate fix prompt
        this.logStep(5, 'TEST', 'Preparing fix...');
        const fixPrompt = this.fixer.generateFixPrompt(evidence, hypothesis);
        const fixAttempt = this.fixer.createFixAttempt(evidence, hypothesis);

        // Step 6: FIX - Apply fix via Claude Code
        this.logStep(6, 'FIX', 'Applying fix via Claude Code...');
        fixResult = await this.applyFix(fixPrompt);
        fixAttempt.status = fixResult.success ? 'applied' : 'failed';

        if (!fixResult.success) {
          console.log(chalk.yellow(`  ⚠ Fix application failed: ${fixResult.error}`));
          continue;
        }

        // Step 7: VERIFY - Confirm fix works
        this.logStep(7, 'VERIFY', 'Verifying fix...');
        const verification = await this.verifier.verify(evidence, fixAttempt);
        this.session.steps.push({ step: 'VERIFY', data: verification });

        if (verification.passed) {
          console.log(chalk.green('  ✓ Fix verified successfully!'));
          this.session.resolved = true;
          fixAttempt.verified = true;

          // Step 8: DOCUMENT - Log the fix
          this.logStep(8, 'DOCUMENT', 'Documenting fix...');
          await this.fixer.documentFix(fixAttempt);

          // Step 9: PREVENT - Add prevention rules
          this.logStep(9, 'PREVENT', 'Adding prevention rules...');
          await this.fixer.updateClaudeMd(fixAttempt);

          console.log(chalk.green.bold('\n✅ Bug fixed and documented!\n'));

          // Ask for feedback to improve future suggestions
          if (this.options.interactive) {
            await askFeedback({
              errorType: evidence.type,
              errorMessage: evidence.message,
              errorCategory: evidence.category,
              fixApplied: fixAttempt.description || hypothesis.description
            });
          }
        } else {
          console.log(chalk.yellow('  ⚠ Verification failed, trying next approach...'));
        }
      }

      return this.createResult(
        this.session.resolved ? 'resolved' : 'unresolved',
        this.session.resolved ? 'Bug fixed successfully' : 'Could not resolve after max attempts',
        fixResult
      );

    } catch (error) {
      console.log(chalk.red(`\n❌ Debug error: ${error.message}\n`));
      return this.createResult('error', error.message);
    }
  }

  /**
   * Quick debug mode - minimal interaction
   */
  async quickDebug(description) {
    return this.debug({
      description,
      auto: false
    });
  }

  /**
   * Auto scan and fix mode
   */
  async autoDebug() {
    console.log(chalk.cyan('🔄 Auto-scanning project for errors...\n'));

    return this.debug({
      auto: true
    });
  }

  /**
   * Reproduce the error to confirm it exists
   */
  async reproduce(evidence) {
    const result = {
      errorFound: false,
      output: ''
    };

    // Try to reproduce based on category
    try {
      const checks = {
        SYNTAX: 'npx tsc --noEmit',
        TYPE: 'npx tsc --noEmit',
        IMPORT: 'npx tsc --noEmit',
        BUILD: 'npm run build',
        LINT: 'npm run lint',
        TEST: 'npm test'
      };

      const command = checks[evidence.category] || 'npm run build';

      await execAsync(command, {
        cwd: this.projectPath,
        timeout: 60000
      });

      result.output = 'Command succeeded';
    } catch (error) {
      result.errorFound = true;
      result.output = error.stderr || error.stdout || error.message;
    }

    return result;
  }

  /**
   * Apply a fix using Claude Code
   */
  async applyFix(prompt) {
    const result = {
      success: false,
      output: '',
      error: null
    };

    try {
      // Check if Claude Code is available
      const available = await isClaudeCodeAvailable();
      if (!available) {
        throw new Error('Claude Code CLI not found. Install with: npm install -g @anthropic-ai/claude-code');
      }

      // Save prompt to debug folder for reference
      const promptFile = path.join(this.projectPath, '.vibecode', 'debug', 'current-fix.md');
      await fs.ensureDir(path.dirname(promptFile));
      await fs.writeFile(promptFile, prompt);

      if (this.options.verbose) {
        console.log(chalk.gray(`  Running Claude Code with fix prompt...`));
      }

      // Use spawnClaudeCode which handles temp file properly
      const spawnResult = await spawnClaudeCode(prompt, {
        cwd: this.projectPath
      });

      result.success = spawnResult.success;
      result.output = `Exit code: ${spawnResult.code}`;

    } catch (error) {
      result.error = error.message;
      result.output = '';
    }

    return result;
  }

  /**
   * Log a debug step
   */
  logStep(number, name, message) {
    const stepLabel = chalk.cyan(`[${number}/9 ${name}]`);
    console.log(`${stepLabel} ${message}`);
  }

  /**
   * Log evidence summary
   */
  logEvidence(evidence) {
    console.log(chalk.gray(`  Type: ${evidence.type || 'Unknown'}`));
    console.log(chalk.gray(`  Category: ${evidence.category}`));

    if (evidence.message) {
      // Translate error for human-friendly display
      const translated = translateError(evidence.message);
      console.log(chalk.yellow(`  Error: ${translated.title}`));
      console.log(chalk.gray(`  → ${translated.description.substring(0, 80)}${translated.description.length > 80 ? '...' : ''}`));

      // Show suggestions
      if (translated.suggestions && translated.suggestions.length > 0) {
        console.log(chalk.gray(`  Suggestions:`));
        for (const s of translated.suggestions.slice(0, 2)) {
          console.log(chalk.gray(`    • ${s}`));
        }
      }
    }

    if (evidence.files.length > 0) {
      console.log(chalk.gray(`  Files: ${evidence.files.slice(0, 3).join(', ')}${evidence.files.length > 3 ? '...' : ''}`));
    }
  }

  /**
   * Log analysis results
   */
  logAnalysis(analysis) {
    console.log(chalk.gray(`  Root cause: ${analysis.rootCause || 'Unknown'}`));
    console.log(chalk.gray(`  Confidence: ${Math.round(analysis.confidence * 100)}%`));
    if (analysis.patterns.length > 0) {
      console.log(chalk.gray(`  Patterns: ${analysis.patterns.join(', ')}`));
    }
  }

  /**
   * Log hypotheses
   */
  logHypotheses(hypotheses) {
    console.log(chalk.gray(`  Generated ${hypotheses.length} hypothesis(es):`));
    for (const h of hypotheses.slice(0, 3)) {
      console.log(chalk.gray(`  - ${h.description.substring(0, 60)}... (${Math.round(h.confidence * 100)}%)`));
    }
  }

  /**
   * Create result object
   */
  createResult(status, message, fixResult = null) {
    return {
      status,
      message,
      session: {
        id: this.session.id,
        attempts: this.session.attempts,
        resolved: this.session.resolved,
        steps: this.session.steps.length
      },
      fixResult
    };
  }

  /**
   * Get debug session summary
   */
  getSessionSummary() {
    return {
      id: this.session.id,
      startTime: this.session.startTime,
      attempts: this.session.attempts,
      resolved: this.session.resolved,
      stepsCompleted: this.session.steps.map(s => s.step)
    };
  }
}

/**
 * Create a new debug engine instance
 */
export function createDebugEngine(projectPath, options = {}) {
  return new DebugEngine(projectPath, options);
}

// Re-export components
export { EvidenceCollector } from './evidence.js';
export { RootCauseAnalyzer } from './analyzer.js';
export { FixGenerator } from './fixer.js';
export { FixVerifier } from './verifier.js';
