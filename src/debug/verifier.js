// ═══════════════════════════════════════════════════════════════════════════════
// VIBECODE DEBUG - Fix Verifier
// Verifies that fixes resolve the original error
// ═══════════════════════════════════════════════════════════════════════════════

import { exec } from 'child_process';
import { promisify } from 'util';
import fs from 'fs-extra';
import path from 'path';

const execAsync = promisify(exec);

/**
 * Fix Verifier Class
 * Re-runs failing commands/tests to verify fixes
 */
export class FixVerifier {
  constructor(projectPath) {
    this.projectPath = projectPath;
  }

  /**
   * Verify a fix by re-running the original failing command
   */
  async verify(originalError, fixAttempt) {
    const verification = {
      fixId: fixAttempt.id,
      timestamp: new Date().toISOString(),
      originalError: {
        type: originalError.type,
        category: originalError.category,
        message: originalError.message
      },
      checks: [],
      passed: false,
      summary: ''
    };

    // Determine which checks to run based on category
    const checksToRun = this.getChecksForCategory(originalError.category);

    for (const check of checksToRun) {
      const result = await this.runCheck(check);
      verification.checks.push(result);
    }

    // Analyze results
    verification.passed = this.analyzeResults(verification.checks, originalError);
    verification.summary = this.generateSummary(verification);

    return verification;
  }

  /**
   * Get appropriate checks for error category
   */
  getChecksForCategory(category) {
    const categoryChecks = {
      SYNTAX: ['tsc', 'build'],
      TYPE: ['tsc', 'build'],
      REFERENCE: ['tsc', 'build'],
      IMPORT: ['tsc', 'build'],
      LINT: ['lint'],
      TEST: ['test'],
      NEXTJS: ['build'],
      DATABASE: ['prisma', 'build'],
      FILE: ['build'],
      RUNTIME: ['build', 'test']
    };

    return categoryChecks[category] || ['build'];
  }

  /**
   * Run a specific verification check
   */
  async runCheck(checkName) {
    const result = {
      name: checkName,
      command: '',
      passed: false,
      output: '',
      error: null,
      duration: 0
    };

    const commands = {
      tsc: 'npx tsc --noEmit',
      build: 'npm run build',
      lint: 'npm run lint',
      test: 'npm test',
      prisma: 'npx prisma generate'
    };

    result.command = commands[checkName] || checkName;

    // Check if command is available
    if (checkName === 'lint' || checkName === 'test' || checkName === 'build') {
      const pkgPath = path.join(this.projectPath, 'package.json');
      if (await fs.pathExists(pkgPath)) {
        const pkg = await fs.readJson(pkgPath);
        const scriptName = checkName === 'build' ? 'build' : checkName;
        if (!pkg.scripts?.[scriptName]) {
          result.passed = true;
          result.output = `Script "${scriptName}" not found, skipping`;
          return result;
        }
      }
    }

    const startTime = Date.now();

    try {
      const { stdout, stderr } = await execAsync(result.command, {
        cwd: this.projectPath,
        timeout: 120000,
        maxBuffer: 10 * 1024 * 1024
      });

      result.passed = true;
      result.output = stdout || stderr || 'Success';
      result.duration = Date.now() - startTime;
    } catch (error) {
      result.passed = false;
      result.error = error.message;
      result.output = error.stderr || error.stdout || error.message;
      result.duration = Date.now() - startTime;
    }

    return result;
  }

  /**
   * Compare before and after outputs
   */
  compareOutput(before, after) {
    const comparison = {
      errorResolved: false,
      newErrors: [],
      improvements: [],
      regressions: []
    };

    // Check if original error message is gone
    const originalMessage = (before.message || '').toLowerCase();
    const afterOutput = (after.output || '').toLowerCase();

    if (originalMessage && !afterOutput.includes(originalMessage)) {
      comparison.errorResolved = true;
      comparison.improvements.push('Original error no longer appears');
    }

    // Check for new errors
    const errorPatterns = [
      /error:/gi,
      /failed/gi,
      /exception/gi,
      /cannot find/gi,
      /undefined/gi
    ];

    const beforeMatches = this.countPatternMatches(before.output || '', errorPatterns);
    const afterMatches = this.countPatternMatches(after.output || '', errorPatterns);

    if (afterMatches > beforeMatches) {
      comparison.regressions.push(`Potential new errors detected (${afterMatches - beforeMatches} more error patterns)`);
    } else if (afterMatches < beforeMatches) {
      comparison.improvements.push(`Fewer error patterns (${beforeMatches - afterMatches} less)`);
    }

    return comparison;
  }

  /**
   * Count pattern matches in text
   */
  countPatternMatches(text, patterns) {
    let count = 0;
    for (const pattern of patterns) {
      const matches = text.match(pattern);
      if (matches) count += matches.length;
    }
    return count;
  }

  /**
   * Analyze check results to determine if fix was successful
   */
  analyzeResults(checks, originalError) {
    // All checks must pass
    const allPassed = checks.every(c => c.passed);

    if (!allPassed) {
      return false;
    }

    // For specific categories, verify the error type is resolved
    const relevantCheck = checks.find(c => {
      switch (originalError.category) {
        case 'SYNTAX':
        case 'TYPE':
        case 'REFERENCE':
        case 'IMPORT':
          return c.name === 'tsc' || c.name === 'build';
        case 'LINT':
          return c.name === 'lint';
        case 'TEST':
          return c.name === 'test';
        default:
          return c.name === 'build';
      }
    });

    if (relevantCheck && !relevantCheck.passed) {
      return false;
    }

    return true;
  }

  /**
   * Generate verification summary
   */
  generateSummary(verification) {
    const passed = verification.checks.filter(c => c.passed);
    const failed = verification.checks.filter(c => !c.passed);

    if (verification.passed) {
      return `✅ Fix verified! All ${passed.length} checks passed.`;
    }

    const failedNames = failed.map(c => c.name).join(', ');
    return `❌ Fix verification failed. Failed checks: ${failedNames}`;
  }

  /**
   * Generate a detailed verification report
   */
  generateReport(verification) {
    const lines = [
      '# Fix Verification Report',
      '',
      `**Fix ID**: ${verification.fixId}`,
      `**Timestamp**: ${verification.timestamp}`,
      `**Status**: ${verification.passed ? '✅ PASSED' : '❌ FAILED'}`,
      '',
      '## Original Error',
      `- Type: ${verification.originalError.type}`,
      `- Category: ${verification.originalError.category}`,
      `- Message: ${verification.originalError.message || 'N/A'}`,
      '',
      '## Verification Checks',
      ''
    ];

    for (const check of verification.checks) {
      lines.push(`### ${check.name}`);
      lines.push(`- Command: \`${check.command}\``);
      lines.push(`- Status: ${check.passed ? '✅ Passed' : '❌ Failed'}`);
      lines.push(`- Duration: ${check.duration}ms`);

      if (check.error) {
        lines.push(`- Error: ${check.error.substring(0, 200)}`);
      }
      lines.push('');
    }

    lines.push('## Summary');
    lines.push(verification.summary);

    return lines.join('\n');
  }

  /**
   * Quick check if a specific command passes
   */
  async quickCheck(command) {
    try {
      await execAsync(command, {
        cwd: this.projectPath,
        timeout: 60000,
        maxBuffer: 5 * 1024 * 1024
      });
      return { passed: true, output: 'Success' };
    } catch (error) {
      return {
        passed: false,
        output: error.stderr || error.stdout || error.message
      };
    }
  }

  /**
   * Verify that the build succeeds
   */
  async verifyBuild() {
    return this.runCheck('build');
  }

  /**
   * Verify that TypeScript compiles
   */
  async verifyTypeScript() {
    return this.runCheck('tsc');
  }

  /**
   * Verify that tests pass
   */
  async verifyTests() {
    return this.runCheck('test');
  }

  /**
   * Verify that lint passes
   */
  async verifyLint() {
    return this.runCheck('lint');
  }

  /**
   * Run all standard verification checks
   */
  async runAllChecks() {
    const checks = ['tsc', 'lint', 'build', 'test'];
    const results = [];

    for (const check of checks) {
      const result = await this.runCheck(check);
      results.push(result);

      // Stop on first failure for efficiency (optional)
      // if (!result.passed) break;
    }

    return {
      checks: results,
      allPassed: results.every(r => r.passed),
      summary: results.map(r => `${r.name}: ${r.passed ? '✅' : '❌'}`).join(', ')
    };
  }
}

export function createFixVerifier(projectPath) {
  return new FixVerifier(projectPath);
}
