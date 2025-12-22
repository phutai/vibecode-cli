// ═══════════════════════════════════════════════════════════════════════════════
// VIBECODE CLI - Error Translator Test Suite
// Comprehensive tests for pattern matching
// ═══════════════════════════════════════════════════════════════════════════════

import { translateError, getErrorCategory } from '../error-translator.js';

/**
 * Test cases for error translation
 * Each test case has:
 * - input: The error string to translate
 * - expectedTitle: Expected Vietnamese title (partial match)
 * - expectedCategory: Expected category
 */
const TEST_CASES = [
  // ─────────────────────────────────────────────────────────────────────────────
  // TypeError - undefined property (CRITICAL: Must handle both quote types)
  // ─────────────────────────────────────────────────────────────────────────────
  {
    input: 'TypeError: Cannot read properties of undefined (reading "call")',
    expectedTitle: 'Biến chưa được định nghĩa',
    expectedCategory: 'RUNTIME'
  },
  {
    input: "TypeError: Cannot read properties of undefined (reading 'map')",
    expectedTitle: 'Biến chưa được định nghĩa',
    expectedCategory: 'RUNTIME'
  },
  {
    input: 'Cannot read property "foo" of undefined',
    expectedTitle: 'Biến chưa được định nghĩa',
    expectedCategory: 'RUNTIME'
  },
  {
    input: 'Cannot read properties of null (reading "bar")',
    expectedTitle: 'Biến là null',
    expectedCategory: 'RUNTIME'
  },

  // ─────────────────────────────────────────────────────────────────────────────
  // Module not found
  // ─────────────────────────────────────────────────────────────────────────────
  {
    input: "Cannot find module 'react'",
    expectedTitle: 'Không tìm thấy module',
    expectedCategory: 'MODULE'
  },
  {
    input: 'Error: Cannot find module "@/components/Button"',
    expectedTitle: 'Không tìm thấy module',
    expectedCategory: 'MODULE'
  },
  {
    input: "Module not found: Can't resolve 'lodash'",
    expectedTitle: 'Module không tìm thấy khi build',
    expectedCategory: 'BUILD'
  },

  // ─────────────────────────────────────────────────────────────────────────────
  // Syntax errors
  // ─────────────────────────────────────────────────────────────────────────────
  {
    input: 'SyntaxError: Unexpected token }',
    expectedTitle: 'Lỗi cú pháp',
    expectedCategory: 'SYNTAX'
  },
  {
    input: 'SyntaxError: Unexpected end of input',
    expectedTitle: 'Lỗi cú pháp - Thiếu đóng ngoặc',
    expectedCategory: 'SYNTAX'
  },

  // ─────────────────────────────────────────────────────────────────────────────
  // Reference errors
  // ─────────────────────────────────────────────────────────────────────────────
  {
    input: 'ReferenceError: foo is not defined',
    expectedTitle: 'Biến chưa được khai báo',
    expectedCategory: 'REFERENCE'
  },

  // ─────────────────────────────────────────────────────────────────────────────
  // Type errors - function
  // ─────────────────────────────────────────────────────────────────────────────
  {
    input: 'TypeError: callback is not a function',
    expectedTitle: 'Không phải hàm',
    expectedCategory: 'TYPE'
  },
  {
    input: 'TypeError: arr is not iterable',
    expectedTitle: 'Không thể lặp qua dữ liệu',
    expectedCategory: 'TYPE'
  },

  // ─────────────────────────────────────────────────────────────────────────────
  // File system errors
  // ─────────────────────────────────────────────────────────────────────────────
  {
    input: "ENOENT: no such file or directory, open '/path/to/file.js'",
    expectedTitle: 'File không tồn tại',
    expectedCategory: 'FILE'
  },
  {
    input: 'ENOENT: no such file or directory /path/to/file.js',
    expectedTitle: 'File không tồn tại',
    expectedCategory: 'FILE'
  },
  {
    input: 'Error: ENOENT',
    expectedTitle: 'File không tồn tại',
    expectedCategory: 'FILE'
  },
  {
    input: 'EACCES: permission denied',
    expectedTitle: 'Không có quyền truy cập',
    expectedCategory: 'PERMISSION'
  },

  // ─────────────────────────────────────────────────────────────────────────────
  // Network errors
  // ─────────────────────────────────────────────────────────────────────────────
  {
    input: 'EADDRINUSE: address already in use :::3000',
    expectedTitle: 'Port đang được sử dụng',
    expectedCategory: 'NETWORK'
  },
  {
    input: 'ECONNREFUSED 127.0.0.1:3000',
    expectedTitle: 'Không thể kết nối',
    expectedCategory: 'NETWORK'
  },

  // ─────────────────────────────────────────────────────────────────────────────
  // NPM errors
  // ─────────────────────────────────────────────────────────────────────────────
  {
    input: 'npm ERR! code ERESOLVE',
    expectedTitle: 'Xung đột phiên bản dependency',
    expectedCategory: 'NPM'
  },
  {
    input: 'npm ERR! ERESOLVE could not resolve',
    expectedTitle: 'Xung đột phiên bản dependency',
    expectedCategory: 'NPM'
  },
  {
    input: 'npm ERR! code E404',
    expectedTitle: 'Lỗi npm registry',
    expectedCategory: 'NPM'
  },
  {
    input: 'npm ERR! peer dependency missing',
    expectedTitle: 'Thiếu peer dependency',
    expectedCategory: 'NPM'
  },

  // ─────────────────────────────────────────────────────────────────────────────
  // Next.js / React errors
  // ─────────────────────────────────────────────────────────────────────────────
  {
    input: 'Functions cannot be passed directly to Client Components',
    expectedTitle: 'Lỗi Server/Client Component (Next.js)',
    expectedCategory: 'NEXTJS'
  },
  {
    input: 'Hydration failed because the initial UI does not match',
    expectedTitle: 'Lỗi Hydration (React/Next.js)',
    expectedCategory: 'REACT'
  },
  {
    input: 'Text content does not match server-rendered HTML',
    expectedTitle: 'Lỗi Hydration (React/Next.js)',
    expectedCategory: 'REACT'
  },
  {
    input: 'Invalid hook call. Hooks can only be called inside',
    expectedTitle: 'Lỗi React Hook',
    expectedCategory: 'REACT'
  },

  // ─────────────────────────────────────────────────────────────────────────────
  // TypeScript errors
  // ─────────────────────────────────────────────────────────────────────────────
  {
    input: "error TS2339: Property 'foo' does not exist on type 'Bar'",
    expectedTitle: 'Lỗi TypeScript (TS2339)',
    expectedCategory: 'TYPESCRIPT'
  },
  {
    input: "Type 'string' is not assignable to type 'number'",
    expectedTitle: 'Lỗi TypeScript - Type không khớp',
    expectedCategory: 'TYPESCRIPT'
  },
  {
    input: "Property 'onClick' does not exist on type 'IntrinsicAttributes'",
    expectedTitle: 'Lỗi TypeScript - Property không tồn tại',
    expectedCategory: 'TYPESCRIPT'
  },
  {
    input: "Argument of type 'string' is not assignable to parameter",
    expectedTitle: 'Lỗi TypeScript - Argument không khớp',
    expectedCategory: 'TYPESCRIPT'
  },

  // ─────────────────────────────────────────────────────────────────────────────
  // Database errors
  // ─────────────────────────────────────────────────────────────────────────────
  {
    input: 'PrismaClientKnownRequestError: P2002',
    expectedTitle: 'Lỗi Prisma Database',
    expectedCategory: 'DATABASE'
  },
  {
    input: "Invalid `prisma.user.findMany()` invocation",
    expectedTitle: 'Lỗi Prisma Query',
    expectedCategory: 'DATABASE'
  },
  {
    input: 'ER_ACCESS_DENIED_ERROR: Access denied for user',
    expectedTitle: 'Lỗi truy cập Database',
    expectedCategory: 'DATABASE'
  },
  {
    input: 'SQLITE_ERROR: no such table: users',
    expectedTitle: 'Lỗi SQLite',
    expectedCategory: 'DATABASE'
  },
  {
    input: 'ECONNREFUSED 127.0.0.1:5432',
    expectedTitle: 'Database không chạy',
    expectedCategory: 'DATABASE'
  },

  // ─────────────────────────────────────────────────────────────────────────────
  // Git errors
  // ─────────────────────────────────────────────────────────────────────────────
  {
    input: 'fatal: not a git repository',
    expectedTitle: 'Không phải Git repository',
    expectedCategory: 'GIT'
  },
  {
    input: 'error: failed to push some refs',
    expectedTitle: 'Không thể push lên remote',
    expectedCategory: 'GIT'
  },
  {
    input: 'CONFLICT (content): Merge conflict in src/app.js',
    expectedTitle: 'Git Merge Conflict',
    expectedCategory: 'GIT'
  },

  // ─────────────────────────────────────────────────────────────────────────────
  // Build errors
  // ─────────────────────────────────────────────────────────────────────────────
  {
    input: 'Module build failed (from ./node_modules/babel-loader)',
    expectedTitle: 'Build module thất bại',
    expectedCategory: 'BUILD'
  },

  // ─────────────────────────────────────────────────────────────────────────────
  // Memory errors
  // ─────────────────────────────────────────────────────────────────────────────
  {
    input: 'FATAL ERROR: JavaScript heap out of memory',
    expectedTitle: 'Hết bộ nhớ',
    expectedCategory: 'MEMORY'
  },
  {
    input: 'RangeError: Maximum call stack size exceeded',
    expectedTitle: 'Stack Overflow',
    expectedCategory: 'RUNTIME'
  }
];

/**
 * Run all tests
 */
export function runTests(options = {}) {
  const verbose = options.verbose || false;
  let passed = 0;
  let failed = 0;
  const failures = [];

  console.log('\n═══════════════════════════════════════════════════════════════');
  console.log('  🧪 ERROR TRANSLATOR TEST SUITE');
  console.log('═══════════════════════════════════════════════════════════════\n');

  for (const testCase of TEST_CASES) {
    const result = translateError(testCase.input);
    const category = getErrorCategory(testCase.input);

    // Check if title matches (partial match for flexibility)
    const titleMatch = result.title === testCase.expectedTitle ||
                       result.title.includes(testCase.expectedTitle) ||
                       testCase.expectedTitle.includes(result.title);
    const categoryMatch = category === testCase.expectedCategory;

    if (titleMatch && categoryMatch) {
      passed++;
      if (verbose) {
        console.log(`  ✅ ${testCase.input.substring(0, 50)}...`);
        console.log(`     → ${result.title} (${category})`);
      } else {
        console.log(`  ✅ ${result.title}`);
      }
    } else {
      failed++;
      failures.push({
        input: testCase.input,
        expected: { title: testCase.expectedTitle, category: testCase.expectedCategory },
        actual: { title: result.title, category }
      });
      console.log(`  ❌ ${testCase.input.substring(0, 50)}...`);
      console.log(`     Expected: ${testCase.expectedTitle} (${testCase.expectedCategory})`);
      console.log(`     Actual:   ${result.title} (${category})`);
    }
  }

  console.log('\n───────────────────────────────────────────────────────────────');
  console.log(`  📊 Results: ${passed}/${TEST_CASES.length} passed (${(passed/TEST_CASES.length*100).toFixed(1)}%)`);
  console.log('───────────────────────────────────────────────────────────────\n');

  if (failures.length > 0) {
    console.log('  ❌ Failures Summary:');
    for (const f of failures) {
      console.log(`     • ${f.input.substring(0, 50)}...`);
      console.log(`       Expected: ${f.expected.title}`);
      console.log(`       Got: ${f.actual.title}`);
    }
    console.log('');
  }

  // Return results
  return {
    passed,
    failed,
    total: TEST_CASES.length,
    success: failed === 0,
    failures
  };
}

/**
 * Debug a specific error pattern
 */
export function debugError(errorString) {
  console.log('\n═══════════════════════════════════════════════════════════════');
  console.log('  🔍 DEBUG MODE');
  console.log('═══════════════════════════════════════════════════════════════\n');

  const result = translateError(errorString, { debug: true });

  console.log('\n───────────────────────────────────────────────────────────────');
  console.log('  Result:');
  console.log(`  Title: ${result.title}`);
  console.log(`  Category: ${result.category}`);
  console.log(`  Description: ${result.description}`);
  console.log('───────────────────────────────────────────────────────────────\n');

  return result;
}

// Run if executed directly
const args = process.argv.slice(2);

if (args.includes('--debug')) {
  const errorIndex = args.indexOf('--debug') + 1;
  const errorString = args[errorIndex] || 'TypeError: Cannot read properties of undefined (reading "test")';
  debugError(errorString);
} else if (args.includes('--help')) {
  console.log(`
Usage: node error-translator.test.js [options]

Options:
  --verbose    Show detailed output for each test
  --debug <error>  Debug a specific error string
  --help       Show this help message

Examples:
  node error-translator.test.js
  node error-translator.test.js --verbose
  node error-translator.test.js --debug "TypeError: foo is not a function"
`);
} else {
  const result = runTests({ verbose: args.includes('--verbose') });
  process.exit(result.success ? 0 : 1);
}
