// ═══════════════════════════════════════════════════════════════════════════════
// VIBECODE DEBUG - Fix Generator
// Generates fix prompts and documents applied fixes
// ═══════════════════════════════════════════════════════════════════════════════

import fs from 'fs-extra';
import path from 'path';

/**
 * Fix Generator Class
 * Creates targeted fix prompts and maintains fix documentation
 */
export class FixGenerator {
  constructor(projectPath) {
    this.projectPath = projectPath;
    this.debugDir = path.join(projectPath, '.vibecode', 'debug');
  }

  /**
   * Generate a fix prompt for Claude Code
   */
  generateFixPrompt(evidence, hypothesis) {
    const parts = [];

    // Header with context
    parts.push('# Debug Fix Request');
    parts.push('');
    parts.push('## Error Information');
    parts.push(`- **Type**: ${evidence.type || 'Unknown'}`);
    parts.push(`- **Category**: ${evidence.category}`);

    if (evidence.message) {
      parts.push(`- **Message**: ${evidence.message}`);
    }

    // Files involved
    if (evidence.files.length > 0) {
      parts.push('');
      parts.push('## Affected Files');
      for (const file of evidence.files.slice(0, 5)) {
        parts.push(`- ${file}`);
      }
    }

    // Line numbers
    if (evidence.lines.length > 0) {
      parts.push('');
      parts.push('## Line Numbers');
      parts.push(`Lines: ${evidence.lines.slice(0, 10).join(', ')}`);
    }

    // Stack trace (condensed)
    if (evidence.stackTrace.length > 0) {
      parts.push('');
      parts.push('## Stack Trace (top 5 frames)');
      parts.push('```');
      for (const line of evidence.stackTrace.slice(0, 5)) {
        parts.push(line);
      }
      parts.push('```');
    }

    // Hypothesis and fix
    parts.push('');
    parts.push('## Diagnosis');
    parts.push(`**Root Cause**: ${hypothesis.rootCause}`);
    parts.push('');
    parts.push(`**Suggested Fix**: ${hypothesis.description}`);
    parts.push(`**Confidence**: ${Math.round(hypothesis.confidence * 100)}%`);

    // Category-specific instructions
    parts.push('');
    parts.push('## Fix Instructions');
    parts.push(this.getCategoryInstructions(evidence.category, evidence));

    // Verification requirement
    parts.push('');
    parts.push('## Verification');
    parts.push('After fixing, ensure:');
    parts.push('1. The original error no longer occurs');
    parts.push('2. No new errors are introduced');
    parts.push('3. Related tests pass (if applicable)');

    return parts.join('\n');
  }

  /**
   * Get category-specific fix instructions
   */
  getCategoryInstructions(category, evidence) {
    const instructions = {
      SYNTAX: `
1. Navigate to the file(s) with syntax errors
2. Check the indicated line numbers for:
   - Missing or extra brackets, parentheses, braces
   - Missing semicolons or commas
   - Incorrect JSX syntax (unclosed tags, invalid expressions)
3. Fix the syntax errors
4. Run the linter/compiler to verify`,

      TYPE: `
1. Locate the code accessing ${evidence.message?.match(/property '(\w+)'/)?.[1] || 'the property'}
2. Add null/undefined check before access:
   - Use optional chaining: \`obj?.property\`
   - Or guard clause: \`if (obj) { ... }\`
3. Consider why the value might be undefined:
   - Is data not loaded yet?
   - Is there a race condition?
   - Is the property name correct?`,

      REFERENCE: `
1. Find where the undefined variable is used
2. Either:
   - Import it from the correct module
   - Define it before use
   - Check for typos in the variable name
3. If it's a function/class, ensure it's exported from the source`,

      IMPORT: `
1. Check if the module/package exists:
   - For npm packages: \`npm install <package>\`
   - For local files: verify the path is correct
2. If the export doesn't exist:
   - Check the source module for available exports
   - Use default vs named import correctly
3. Verify the file extension if needed`,

      FILE: `
1. Check if the referenced file/directory exists
2. Either:
   - Create the missing file/directory
   - Fix the path in the code/config
3. Verify permissions if needed`,

      LINT: `
1. Review the specific linting rule violation
2. Either:
   - Fix the code to comply with the rule
   - Add eslint-disable comment if intentional (with explanation)
3. Consider if the rule should be configured differently`,

      TEST: `
1. Review the failing test assertion
2. Determine if:
   - The test expectation is wrong (update test)
   - The implementation is wrong (fix code)
   - The test is testing the wrong thing
3. Ensure the fix doesn't break other tests`,

      NEXTJS: `
1. Identify the Server/Client Component boundary issue
2. Common fixes:
   - Don't pass functions as props to Client Components
   - Use "use client" directive where needed
   - Move client-only code to useEffect
   - Use serializable props (strings, numbers, objects)
3. Check if component should be client or server`,

      DATABASE: `
1. For Prisma issues:
   - Run: \`npx prisma generate\`
   - Run: \`npx prisma db push\` or \`npx prisma migrate dev\`
2. Check DATABASE_URL in .env
3. Verify database connection and permissions
4. Check schema matches database state`,

      RUNTIME: `
1. Add console.log statements to trace the issue
2. Check the error stack trace for the source
3. Look for:
   - Async/await issues
   - State management bugs
   - Race conditions
4. Use debugger breakpoints if available`
    };

    return instructions[category] || `
1. Review the error message and stack trace
2. Locate the source of the error
3. Apply the suggested fix
4. Test to verify the fix works`;
  }

  /**
   * Document a fix in the debug log
   */
  async documentFix(fixInfo) {
    await fs.ensureDir(this.debugDir);

    const fixesFile = path.join(this.debugDir, 'fixes.md');
    const timestamp = new Date().toISOString();

    const entry = `
## Fix Applied - ${timestamp}

**Error Type**: ${fixInfo.errorType || 'Unknown'}
**Category**: ${fixInfo.category}
**Confidence**: ${Math.round((fixInfo.confidence || 0) * 100)}%

### Root Cause
${fixInfo.rootCause || 'Not determined'}

### Fix Applied
${fixInfo.description || 'Manual fix'}

### Files Modified
${(fixInfo.files || []).map(f => `- ${f}`).join('\n') || '- Unknown'}

### Verification
- Status: ${fixInfo.verified ? '✅ Verified' : '⏳ Pending verification'}
${fixInfo.verificationOutput ? `- Output: ${fixInfo.verificationOutput}` : ''}

---
`;

    // Append to fixes log
    let content = '';
    if (await fs.pathExists(fixesFile)) {
      content = await fs.readFile(fixesFile, 'utf-8');
    } else {
      content = `# Vibecode Debug - Fix History

This file tracks all fixes applied through the Vibecode debug system.

---
`;
    }

    await fs.writeFile(fixesFile, content + entry);
    return fixesFile;
  }

  /**
   * Update CLAUDE.md with prevention rules
   */
  async updateClaudeMd(fix) {
    const claudeMdPath = path.join(this.projectPath, 'CLAUDE.md');
    let content = '';

    if (await fs.pathExists(claudeMdPath)) {
      content = await fs.readFile(claudeMdPath, 'utf-8');
    } else {
      content = `# CLAUDE.md - Project Guidelines

This file contains project-specific guidelines and lessons learned.

`;
    }

    // Check if we already have a debugging section
    const debugSection = '## Debugging History & Prevention';
    if (!content.includes(debugSection)) {
      content += `\n${debugSection}\n\n`;
    }

    // Generate prevention rule
    const preventionRule = this.generatePreventionRule(fix);

    // Add to the debugging section
    const sectionIndex = content.indexOf(debugSection);
    const insertPoint = content.indexOf('\n\n', sectionIndex + debugSection.length);

    if (insertPoint !== -1) {
      content = content.slice(0, insertPoint) +
                '\n' + preventionRule +
                content.slice(insertPoint);
    } else {
      content += preventionRule + '\n';
    }

    await fs.writeFile(claudeMdPath, content);
    return claudeMdPath;
  }

  /**
   * Generate a prevention rule from a fix
   */
  generatePreventionRule(fix) {
    const rules = {
      SYNTAX: `- ⚠️ Check syntax carefully: ${fix.message || 'brackets, semicolons, JSX tags'}`,
      TYPE: `- ⚠️ Always use optional chaining (?.) when accessing: ${fix.files?.[0] || 'nested properties'}`,
      REFERENCE: `- ⚠️ Ensure imports exist before using: ${fix.message?.match(/'(\w+)'/)?.[1] || 'variables'}`,
      IMPORT: `- ⚠️ Verify module paths and exports: ${fix.files?.[0] || 'check imports'}`,
      NEXTJS: `- ⚠️ Never pass functions to Client Components - use formatType strings instead`,
      DATABASE: `- ⚠️ Run prisma generate after schema changes`,
      TEST: `- ⚠️ Keep tests in sync with implementation`,
      LINT: `- ⚠️ Follow linting rules: ${fix.message || 'check ESLint config'}`,
      FILE: `- ⚠️ Verify file paths before referencing`,
      RUNTIME: `- ⚠️ Handle edge cases: ${fix.rootCause || 'check for null/undefined'}`
    };

    const timestamp = new Date().toISOString().split('T')[0];
    const rule = rules[fix.category] || `- ⚠️ Avoid: ${fix.rootCause || fix.description}`;

    return `### [${timestamp}] ${fix.category} Fix
${rule}
`;
  }

  /**
   * Generate a minimal fix prompt (for auto-fix mode)
   */
  generateMinimalPrompt(evidence, hypothesis) {
    const parts = [
      `Fix this ${evidence.category} error:`,
      '',
      `Error: ${evidence.message || evidence.description}`,
      ''
    ];

    if (evidence.files.length > 0) {
      parts.push(`File: ${evidence.files[0]}`);
    }

    if (evidence.lines.length > 0) {
      parts.push(`Line: ${evidence.lines[0]}`);
    }

    parts.push('');
    parts.push(`Fix: ${hypothesis.description}`);

    return parts.join('\n');
  }

  /**
   * Create a fix attempt record
   */
  createFixAttempt(evidence, hypothesis) {
    return {
      id: `fix-${Date.now()}`,
      timestamp: new Date().toISOString(),
      errorType: evidence.type,
      category: evidence.category,
      message: evidence.message,
      files: evidence.files,
      lines: evidence.lines,
      rootCause: hypothesis.rootCause,
      description: hypothesis.description,
      confidence: hypothesis.confidence,
      status: 'pending',
      verified: false
    };
  }
}

export function createFixGenerator(projectPath) {
  return new FixGenerator(projectPath);
}
