// ═══════════════════════════════════════════════════════════════════════════════
// VIBECODE CLI - Test Runner
// Automated test execution for iterative builds
// ═══════════════════════════════════════════════════════════════════════════════

import { exec } from 'child_process';
import { promisify } from 'util';
import path from 'path';
import { pathExists, readJson } from '../utils/files.js';

const execAsync = promisify(exec);

/**
 * Run all available tests for a project
 * @param {string} projectPath - Path to the project
 * @returns {Promise<TestResults>}
 */
export async function runTests(projectPath) {
  const results = {
    passed: true,
    tests: [],
    errors: [],
    summary: {
      total: 0,
      passed: 0,
      failed: 0
    },
    duration: 0
  };

  const startTime = Date.now();

  // 1. Check if package.json exists
  const packageJsonPath = path.join(projectPath, 'package.json');
  const hasPackageJson = await pathExists(packageJsonPath);

  if (hasPackageJson) {
    const pkg = await readJson(packageJsonPath);

    // 2. Run npm test (if script exists)
    if (pkg.scripts?.test && !pkg.scripts.test.includes('no test specified')) {
      const npmTest = await runCommand('npm test', projectPath, 'npm test');
      results.tests.push(npmTest);
    }

    // 3. Run npm run lint (if script exists) - soft fail (warnings only)
    if (pkg.scripts?.lint) {
      const npmLint = await runCommand('npm run lint', projectPath, 'npm lint');
      npmLint.softFail = true; // Lint errors are warnings, don't block build
      results.tests.push(npmLint);
    }

    // 4. Run npm run build (if script exists) - check for build errors
    if (pkg.scripts?.build) {
      const npmBuild = await runCommand('npm run build', projectPath, 'npm build');
      results.tests.push(npmBuild);
    }

    // 5. Run TypeScript check if tsconfig exists
    const tsconfigPath = path.join(projectPath, 'tsconfig.json');
    if (await pathExists(tsconfigPath)) {
      const tscCheck = await runCommand('npx tsc --noEmit', projectPath, 'typescript');
      results.tests.push(tscCheck);
    }
  }

  // 6. Check for syntax errors in JS files
  const syntaxCheck = await checkJsSyntax(projectPath);
  if (syntaxCheck.ran) {
    results.tests.push(syntaxCheck);
  }

  // 7. Aggregate results
  // Separate hard tests from soft-fail tests (like lint)
  const hardTests = results.tests.filter(t => !t.softFail);
  const softTests = results.tests.filter(t => t.softFail);

  results.summary.total = results.tests.length;
  results.summary.passed = results.tests.filter(t => t.passed).length;
  results.summary.failed = results.tests.filter(t => !t.passed).length;
  results.summary.warnings = softTests.filter(t => !t.passed).length;

  // Only hard tests determine pass/fail
  results.passed = hardTests.length === 0 || hardTests.every(t => t.passed);

  // Collect errors, but mark soft-fail errors as warnings
  results.errors = results.tests.filter(t => !t.passed && !t.softFail).flatMap(t => t.errors || []);
  results.warnings = softTests.filter(t => !t.passed).flatMap(t => t.errors || []);
  results.duration = Date.now() - startTime;

  return results;
}

/**
 * Run a single command and capture results
 */
async function runCommand(command, cwd, name) {
  const result = {
    name,
    command,
    passed: false,
    ran: true,
    output: '',
    errors: [],
    duration: 0
  };

  const startTime = Date.now();

  try {
    const { stdout, stderr } = await execAsync(command, {
      cwd,
      timeout: 120000, // 2 minute timeout
      maxBuffer: 10 * 1024 * 1024
    });

    result.passed = true;
    result.output = stdout + stderr;
    result.duration = Date.now() - startTime;

  } catch (error) {
    result.passed = false;
    result.output = error.stdout || '';
    result.error = error.stderr || error.message;
    result.exitCode = error.code;
    result.duration = Date.now() - startTime;

    // Parse errors from output
    result.errors = parseErrors(error.stderr || error.stdout || error.message, name);
  }

  return result;
}

/**
 * Check JavaScript syntax errors
 */
async function checkJsSyntax(projectPath) {
  const result = {
    name: 'syntax-check',
    passed: true,
    ran: false,
    errors: []
  };

  try {
    // Find JS/TS files (limited to src/ to avoid node_modules)
    const { stdout } = await execAsync(
      'find src -name "*.js" -o -name "*.ts" -o -name "*.jsx" -o -name "*.tsx" 2>/dev/null | head -20',
      { cwd: projectPath }
    );

    const files = stdout.trim().split('\n').filter(f => f);
    if (files.length === 0) return result;

    result.ran = true;

    // Check each file for syntax errors using node --check
    for (const file of files) {
      if (file.endsWith('.ts') || file.endsWith('.tsx')) continue; // Skip TS files

      try {
        await execAsync(`node --check "${file}"`, { cwd: projectPath });
      } catch (error) {
        result.passed = false;
        result.errors.push({
          file,
          message: error.message,
          type: 'syntax'
        });
      }
    }
  } catch (error) {
    // find command failed, skip syntax check
  }

  return result;
}

/**
 * Parse error messages into structured format
 */
function parseErrors(errorOutput, source) {
  const errors = [];
  const lines = errorOutput.split('\n');

  for (const line of lines) {
    // Match common error patterns
    // Pattern: file.js:10:5: error message
    const fileLineMatch = line.match(/([^\s:]+):(\d+):(\d+)?:?\s*(.+)/);
    if (fileLineMatch) {
      errors.push({
        source,
        file: fileLineMatch[1],
        line: parseInt(fileLineMatch[2]),
        column: fileLineMatch[3] ? parseInt(fileLineMatch[3]) : null,
        message: fileLineMatch[4].trim(),
        raw: line
      });
      continue;
    }

    // Pattern: Error: message
    const errorMatch = line.match(/^(Error|TypeError|SyntaxError|ReferenceError):\s*(.+)/);
    if (errorMatch) {
      errors.push({
        source,
        type: errorMatch[1],
        message: errorMatch[2].trim(),
        raw: line
      });
      continue;
    }

    // Pattern: ✖ or ✗ or FAIL
    if (line.includes('✖') || line.includes('✗') || line.includes('FAIL')) {
      errors.push({
        source,
        message: line.trim(),
        raw: line
      });
    }
  }

  // If no structured errors found, add the whole output
  if (errors.length === 0 && errorOutput.trim()) {
    errors.push({
      source,
      message: errorOutput.substring(0, 500),
      raw: errorOutput
    });
  }

  return errors;
}

/**
 * Format test results for display
 */
export function formatTestResults(results) {
  const lines = [];

  lines.push(`Tests: ${results.summary.passed}/${results.summary.total} passed`);
  if (results.summary.warnings > 0) {
    lines.push(`Warnings: ${results.summary.warnings} (lint)`);
  }
  lines.push(`Duration: ${(results.duration / 1000).toFixed(1)}s`);

  // Show hard failures
  const hardFailures = results.tests.filter(t => !t.passed && !t.softFail);
  if (hardFailures.length > 0) {
    lines.push('');
    lines.push('Failed tests:');
    for (const test of hardFailures) {
      lines.push(`  ❌ ${test.name}`);
      for (const error of test.errors || []) {
        const loc = error.file ? `${error.file}:${error.line || '?'}` : '';
        lines.push(`     ${loc} ${error.message?.substring(0, 80) || ''}`);
      }
    }
  }

  // Show soft failures (warnings)
  const softFailures = results.tests.filter(t => !t.passed && t.softFail);
  if (softFailures.length > 0) {
    lines.push('');
    lines.push('Warnings (non-blocking):');
    for (const test of softFailures) {
      lines.push(`  ⚠️  ${test.name}`);
      for (const error of (test.errors || []).slice(0, 3)) {
        const loc = error.file ? `${error.file}:${error.line || '?'}` : '';
        lines.push(`     ${loc} ${error.message?.substring(0, 80) || ''}`);
      }
      if ((test.errors?.length || 0) > 3) {
        lines.push(`     ... and ${test.errors.length - 3} more`);
      }
    }
  }

  return lines.join('\n');
}
