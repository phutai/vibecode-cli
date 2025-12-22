// ═══════════════════════════════════════════════════════════════════════════════
// VIBECODE DEBUG - Root Cause Analyzer
// Analyzes evidence to determine root cause and generate hypotheses
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Root Cause Analyzer Class
 * Uses pattern matching and heuristics to identify bug sources
 */
export class RootCauseAnalyzer {
  constructor() {
    this.patterns = this.initPatterns();
  }

  /**
   * Analyze evidence to find root cause
   */
  async analyze(evidence) {
    const analysis = {
      category: evidence.category,
      rootCause: null,
      suggestedFix: null,
      relatedFiles: evidence.files || [],
      confidence: 0,
      patterns: []
    };

    // Match against known patterns
    for (const pattern of this.patterns) {
      if (this.matchesPattern(evidence, pattern)) {
        analysis.patterns.push(pattern.name);

        if (pattern.confidence > analysis.confidence) {
          analysis.rootCause = pattern.rootCause;
          analysis.suggestedFix = pattern.fix;
          analysis.confidence = pattern.confidence;
        }
      }
    }

    // If no pattern matched, use generic analysis
    if (!analysis.rootCause) {
      analysis.rootCause = this.inferRootCause(evidence);
      analysis.confidence = 0.3;
    }

    return analysis;
  }

  /**
   * Build hypotheses from analysis
   */
  buildHypotheses(analysis) {
    const hypotheses = [];

    // Primary hypothesis from analysis
    if (analysis.suggestedFix) {
      hypotheses.push({
        description: analysis.suggestedFix,
        confidence: analysis.confidence,
        category: analysis.category,
        rootCause: analysis.rootCause
      });
    }

    // Add category-specific hypotheses
    const categoryFixes = this.getCategoryFixes(analysis.category);
    for (const fix of categoryFixes) {
      if (!hypotheses.find(h => h.description === fix.description)) {
        hypotheses.push({
          ...fix,
          category: analysis.category
        });
      }
    }

    // Sort by confidence
    return hypotheses.sort((a, b) => b.confidence - a.confidence);
  }

  /**
   * Initialize pattern database
   */
  initPatterns() {
    return [
      // Next.js specific
      {
        name: 'nextjs-server-client-boundary',
        match: (e) => {
          const msg = (e.message || e.description || '').toLowerCase();
          return msg.includes('functions cannot be passed directly to client components') ||
                 msg.includes('client component') && msg.includes('server');
        },
        rootCause: 'Server/Client Component boundary violation in Next.js',
        fix: 'Convert function props to serializable format (e.g., use formatType string instead of formatValue function). Or mark the function with "use server".',
        confidence: 0.95
      },
      {
        name: 'nextjs-hydration',
        match: (e) => {
          const msg = (e.message || e.description || '').toLowerCase();
          return msg.includes('hydration') || msg.includes('text content does not match');
        },
        rootCause: 'Hydration mismatch between server and client render',
        fix: 'Ensure server and client render identical content. Use useEffect for client-only code.',
        confidence: 0.85
      },

      // Type errors
      {
        name: 'undefined-property-access',
        match: (e) => {
          const msg = (e.message || '').toLowerCase();
          return msg.includes('cannot read properties of undefined') ||
                 msg.includes('cannot read property') && msg.includes('undefined');
        },
        rootCause: 'Accessing property on undefined object',
        fix: 'Add null check or optional chaining (?.) before property access',
        confidence: 0.85
      },
      {
        name: 'null-property-access',
        match: (e) => {
          const msg = (e.message || '').toLowerCase();
          return msg.includes('cannot read properties of null');
        },
        rootCause: 'Accessing property on null value',
        fix: 'Add null check before property access. Check if data is loaded before accessing.',
        confidence: 0.85
      },

      // Import errors
      {
        name: 'module-not-found',
        match: (e) => {
          const msg = (e.message || e.description || '').toLowerCase();
          return msg.includes('cannot find module') || msg.includes('module not found');
        },
        rootCause: 'Missing import or incorrect module path',
        fix: 'Install missing package with npm install, or fix import path',
        confidence: 0.9
      },
      {
        name: 'export-not-found',
        match: (e) => {
          const msg = (e.message || '').toLowerCase();
          return msg.includes('does not provide an export named') ||
                 msg.includes('is not exported from');
        },
        rootCause: 'Importing non-existent export',
        fix: 'Check export name in source module. Use correct named or default import.',
        confidence: 0.9
      },

      // Syntax errors
      {
        name: 'unexpected-token',
        match: (e) => {
          const msg = (e.message || '').toLowerCase();
          return msg.includes('unexpected token') || e.type === 'SyntaxError';
        },
        rootCause: 'Syntax error in JavaScript/TypeScript code',
        fix: 'Fix syntax error at indicated line. Check for missing brackets, semicolons, or incorrect syntax.',
        confidence: 0.9
      },
      {
        name: 'jsx-syntax',
        match: (e) => {
          const msg = (e.message || '').toLowerCase();
          return msg.includes('jsx') && (msg.includes('unexpected') || msg.includes('syntax'));
        },
        rootCause: 'JSX syntax error',
        fix: 'Check JSX syntax. Ensure proper closing tags and valid JSX expressions.',
        confidence: 0.85
      },

      // Reference errors
      {
        name: 'undefined-variable',
        match: (e) => {
          const msg = (e.message || '').toLowerCase();
          return msg.includes('is not defined') || e.type === 'ReferenceError';
        },
        rootCause: 'Using undefined variable',
        fix: 'Define the variable before use, or import it from the correct module',
        confidence: 0.85
      },

      // Database errors
      {
        name: 'prisma-client',
        match: (e) => {
          const msg = (e.message || '').toLowerCase();
          return msg.includes('prisma') || msg.includes('@prisma/client');
        },
        rootCause: 'Prisma database client error',
        fix: 'Run npx prisma generate and npx prisma db push. Check DATABASE_URL.',
        confidence: 0.8
      },

      // Auth errors
      {
        name: 'nextauth-error',
        match: (e) => {
          const msg = (e.message || '').toLowerCase();
          return msg.includes('next-auth') || msg.includes('nextauth');
        },
        rootCause: 'NextAuth configuration error',
        fix: 'Check NEXTAUTH_URL and NEXTAUTH_SECRET in .env. Verify auth provider config.',
        confidence: 0.8
      },

      // ESLint/Lint errors
      {
        name: 'eslint-error',
        match: (e) => e.category === 'LINT' || (e.message || '').toLowerCase().includes('eslint'),
        rootCause: 'ESLint code style violation',
        fix: 'Fix the linting error or add eslint-disable comment if intentional',
        confidence: 0.75
      },

      // Test failures
      {
        name: 'test-assertion',
        match: (e) => {
          const msg = (e.message || '').toLowerCase();
          return msg.includes('expect') || msg.includes('assertion') || e.category === 'TEST';
        },
        rootCause: 'Test assertion failure',
        fix: 'Review test expectations and implementation. Update test or fix code.',
        confidence: 0.7
      }
    ];
  }

  /**
   * Check if evidence matches a pattern
   */
  matchesPattern(evidence, pattern) {
    try {
      return pattern.match(evidence);
    } catch {
      return false;
    }
  }

  /**
   * Infer root cause when no pattern matches
   */
  inferRootCause(evidence) {
    const parts = [];

    if (evidence.type && evidence.type !== 'unknown') {
      parts.push(evidence.type);
    }

    if (evidence.files.length > 0) {
      parts.push(`in ${evidence.files[0]}`);
    }

    if (evidence.lines.length > 0) {
      parts.push(`at line ${evidence.lines[0]}`);
    }

    if (parts.length === 0) {
      return 'Unknown error - manual investigation needed';
    }

    return parts.join(' ');
  }

  /**
   * Get category-specific fixes
   */
  getCategoryFixes(category) {
    const fixes = {
      SYNTAX: [
        { description: 'Check for missing brackets, parentheses, or semicolons', confidence: 0.6 },
        { description: 'Verify JSX syntax and proper tag closing', confidence: 0.5 }
      ],
      TYPE: [
        { description: 'Add null/undefined check before property access', confidence: 0.6 },
        { description: 'Use optional chaining (?.) for nested access', confidence: 0.6 },
        { description: 'Verify variable types match expected types', confidence: 0.5 }
      ],
      REFERENCE: [
        { description: 'Import or define the missing variable', confidence: 0.6 },
        { description: 'Check for typos in variable names', confidence: 0.5 }
      ],
      IMPORT: [
        { description: 'Install missing package: npm install <package>', confidence: 0.7 },
        { description: 'Fix import path to correct location', confidence: 0.6 },
        { description: 'Check if export exists in source module', confidence: 0.5 }
      ],
      FILE: [
        { description: 'Create missing file or directory', confidence: 0.6 },
        { description: 'Fix file path in configuration', confidence: 0.5 }
      ],
      LINT: [
        { description: 'Fix code style violation', confidence: 0.6 },
        { description: 'Add eslint-disable comment if intentional', confidence: 0.4 }
      ],
      TEST: [
        { description: 'Update test expectations to match implementation', confidence: 0.5 },
        { description: 'Fix implementation to pass test', confidence: 0.5 }
      ],
      NEXTJS: [
        { description: 'Check Server/Client Component boundaries', confidence: 0.7 },
        { description: 'Move client-only code to useEffect', confidence: 0.6 }
      ],
      DATABASE: [
        { description: 'Run prisma generate and db push', confidence: 0.7 },
        { description: 'Check DATABASE_URL environment variable', confidence: 0.6 }
      ],
      RUNTIME: [
        { description: 'Debug runtime error with console.log', confidence: 0.3 },
        { description: 'Check error stack trace for source', confidence: 0.4 }
      ]
    };

    return fixes[category] || [
      { description: 'Investigate error message and stack trace', confidence: 0.2 }
    ];
  }
}

export function createRootCauseAnalyzer() {
  return new RootCauseAnalyzer();
}
