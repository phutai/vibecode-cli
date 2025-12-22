// ═══════════════════════════════════════════════════════════════════════════════
// VIBECODE DEBUG - Evidence Collector
// Gathers error information from multiple sources
// ═══════════════════════════════════════════════════════════════════════════════

import { exec } from 'child_process';
import { promisify } from 'util';
import fs from 'fs-extra';
import path from 'path';

const execAsync = promisify(exec);

/**
 * Evidence Collector Class
 * Gathers and parses error information from various sources
 */
export class EvidenceCollector {
  constructor(projectPath) {
    this.projectPath = projectPath;
  }

  /**
   * Collect evidence from all available sources
   */
  async collect(input) {
    const evidence = {
      type: 'unknown',
      category: 'RUNTIME',
      description: input.description || '',
      message: '',
      stackTrace: [],
      files: [],
      lines: [],
      logs: [],
      hasImage: false,
      imagePath: null,
      timestamp: new Date().toISOString()
    };

    // From description
    if (input.description) {
      this.parseDescription(evidence, input.description);
    }

    // From log paste
    if (input.log) {
      this.parseLog(evidence, input.log);
    }

    // From image (note for future OCR)
    if (input.image) {
      await this.parseImage(evidence, input.image);
    }

    // Auto-scan mode
    if (input.auto) {
      await this.autoScan(evidence);
    }

    // Categorize error
    evidence.category = this.categorizeError(evidence);

    return evidence;
  }

  /**
   * Parse error description text
   */
  parseDescription(evidence, description) {
    const desc = description.toLowerCase();

    // Detect error type from description
    if (desc.includes('typeerror')) evidence.type = 'TypeError';
    else if (desc.includes('syntaxerror')) evidence.type = 'SyntaxError';
    else if (desc.includes('referenceerror')) evidence.type = 'ReferenceError';
    else if (desc.includes('cannot find module')) evidence.type = 'ImportError';
    else if (desc.includes('undefined')) evidence.type = 'UndefinedError';
    else if (desc.includes('cannot read properties')) evidence.type = 'TypeError';

    // Extract file references
    const fileMatches = description.match(/[\w\/\-\.]+\.(js|ts|tsx|jsx|json|mjs|cjs)/gi);
    if (fileMatches) {
      evidence.files = [...new Set(fileMatches)];
    }

    // Extract line numbers
    const lineMatches = description.match(/:(\d+)(?::\d+)?/g);
    if (lineMatches) {
      evidence.lines = lineMatches.map(m => parseInt(m.split(':')[1]));
    }

    // Extract error message
    const errorMatch = description.match(/(Error|TypeError|SyntaxError|ReferenceError):\s*(.+?)(?:\n|$)/i);
    if (errorMatch) {
      evidence.type = errorMatch[1];
      evidence.message = errorMatch[2].trim();
    }
  }

  /**
   * Parse error log text
   */
  parseLog(evidence, log) {
    evidence.logs.push(log);

    // Parse stack trace
    const stackLines = log.split('\n').filter(line =>
      line.trim().startsWith('at ') || line.includes('Error:')
    );
    evidence.stackTrace = stackLines.slice(0, 15);

    // Extract error message
    const errorMatch = log.match(/(Error|TypeError|SyntaxError|ReferenceError|RangeError):\s*(.+?)(?:\n|$)/i);
    if (errorMatch) {
      evidence.type = errorMatch[1];
      evidence.message = errorMatch[2].trim();
    }

    // Extract files from stack trace
    const fileMatches = log.match(/(?:at\s+)?(?:\w+\s+)?\(?([^\s()]+\.(js|ts|tsx|jsx)):(\d+)(?::\d+)?\)?/gi);
    if (fileMatches) {
      for (const match of fileMatches) {
        const fileMatch = match.match(/([^\s()]+\.(js|ts|tsx|jsx)):(\d+)/i);
        if (fileMatch) {
          evidence.files.push(fileMatch[1]);
          evidence.lines.push(parseInt(fileMatch[3]));
        }
      }
      evidence.files = [...new Set(evidence.files)];
    }
  }

  /**
   * Parse image evidence (placeholder for OCR/Vision)
   */
  async parseImage(evidence, imagePath) {
    if (await fs.pathExists(imagePath)) {
      evidence.hasImage = true;
      evidence.imagePath = imagePath;
      // Future: OCR or Claude Vision API
    }
  }

  /**
   * Auto-scan project for errors
   */
  async autoScan(evidence) {
    const checks = [
      { name: 'npm test', cmd: 'npm test', softFail: true },
      { name: 'npm build', cmd: 'npm run build', softFail: false },
      { name: 'npm lint', cmd: 'npm run lint', softFail: true },
      { name: 'tsc', cmd: 'npx tsc --noEmit', softFail: true }
    ];

    // Check if package.json exists
    const pkgPath = path.join(this.projectPath, 'package.json');
    if (!await fs.pathExists(pkgPath)) {
      evidence.logs.push({ source: 'auto-scan', error: 'No package.json found' });
      return;
    }

    const pkg = await fs.readJson(pkgPath);

    for (const check of checks) {
      // Skip if script doesn't exist
      const scriptName = check.cmd.replace('npm run ', '').replace('npm ', '');
      if (check.cmd.startsWith('npm') && scriptName !== 'test' && !pkg.scripts?.[scriptName]) {
        continue;
      }

      try {
        await execAsync(check.cmd, {
          cwd: this.projectPath,
          timeout: 60000,
          maxBuffer: 10 * 1024 * 1024
        });
      } catch (error) {
        const errorOutput = error.stderr || error.stdout || error.message;
        evidence.logs.push({
          source: check.name,
          error: errorOutput.substring(0, 5000), // Limit size
          exitCode: error.code
        });

        // Parse errors from output
        this.parseLog(evidence, errorOutput);
      }
    }
  }

  /**
   * Categorize error by type
   */
  categorizeError(evidence) {
    const type = (evidence.type || '').toLowerCase();
    const msg = (evidence.message || evidence.description || '').toLowerCase();

    if (type.includes('syntax') || msg.includes('unexpected token')) return 'SYNTAX';
    if (type.includes('type') || msg.includes('cannot read properties')) return 'TYPE';
    if (type.includes('reference') || msg.includes('is not defined')) return 'REFERENCE';
    if (msg.includes('cannot find module') || msg.includes('module not found')) return 'IMPORT';
    if (msg.includes('enoent') || msg.includes('no such file')) return 'FILE';
    if (msg.includes('eslint') || msg.includes('lint')) return 'LINT';
    if (msg.includes('test') || msg.includes('expect') || msg.includes('assert')) return 'TEST';
    if (msg.includes('client component') || msg.includes('server component')) return 'NEXTJS';
    if (msg.includes('prisma') || msg.includes('database')) return 'DATABASE';

    return 'RUNTIME';
  }

  /**
   * Get evidence summary
   */
  getSummary(evidence) {
    return {
      type: evidence.type,
      category: evidence.category,
      message: evidence.message || evidence.description?.substring(0, 100),
      fileCount: evidence.files.length,
      hasStackTrace: evidence.stackTrace.length > 0,
      logSources: evidence.logs.length
    };
  }
}

export function createEvidenceCollector(projectPath) {
  return new EvidenceCollector(projectPath);
}
