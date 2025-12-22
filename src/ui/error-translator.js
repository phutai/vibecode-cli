// ═══════════════════════════════════════════════════════════════════════════════
// VIBECODE CLI - Error Translator
// Phase H3: Human-Friendly Error Messages
// Technical errors → Vietnamese explanations + fix suggestions
// ═══════════════════════════════════════════════════════════════════════════════

import chalk from 'chalk';

/**
 * Error patterns and their Vietnamese translations
 * Each pattern has:
 * - pattern: RegExp to match error
 * - translate: Function that returns translated error info
 *
 * IMPORTANT: Patterns should handle variations:
 * - Quote types: single ('), double ("), escaped (\"), or none
 * - Case variations
 * - Prefix variations (TypeError:, Error:, etc.)
 */
const ERROR_PATTERNS = [
  // ─────────────────────────────────────────────────────────────────────────────
  // JavaScript/Node.js Runtime Errors
  // ─────────────────────────────────────────────────────────────────────────────

  // Cannot read properties of undefined/null - handles both quote types (new style)
  {
    pattern: /Cannot read propert(?:y|ies) of (undefined|null)(?: \(reading ['"]?(\w+)['"]?\))?/i,
    translate: (match) => ({
      title: match[1] === 'null' ? 'Biến là null' : 'Biến chưa được định nghĩa',
      description: `Code đang cố truy cập thuộc tính '${match[2] || 'unknown'}' của một biến ${match[1]}`,
      suggestions: [
        'Kiểm tra biến có được khởi tạo trước khi sử dụng',
        'Thêm optional chaining (?.) khi truy cập thuộc tính',
        'Kiểm tra null/undefined với if statement'
      ],
      category: 'RUNTIME'
    })
  },

  // Cannot read property X of undefined (old style - Node < 16)
  {
    pattern: /Cannot read property ['"]?(\w+)['"]? of (undefined|null)/i,
    translate: (match) => ({
      title: match[2] === 'null' ? 'Biến là null' : 'Biến chưa được định nghĩa',
      description: `Code đang cố truy cập thuộc tính '${match[1]}' của một biến ${match[2]}`,
      suggestions: [
        'Kiểm tra biến có được khởi tạo trước khi sử dụng',
        'Thêm optional chaining (?.) khi truy cập thuộc tính',
        'Kiểm tra null/undefined với if statement'
      ],
      category: 'RUNTIME'
    })
  },

  // Module not found: Can't resolve (webpack/bundler - BUILD error)
  // MUST come before generic "Cannot find module" pattern
  {
    pattern: /Module not found:?\s*Can'?t resolve ['"]?([^'">\s]+)['"]?/i,
    translate: (match) => ({
      title: 'Module không tìm thấy khi build',
      description: `Bundler không thể resolve: '${match[1]}'`,
      suggestions: [
        'Kiểm tra path import có đúng không',
        'Chạy npm install nếu thiếu package',
        'Kiểm tra tsconfig paths nếu dùng alias'
      ],
      category: 'BUILD'
    })
  },

  // Cannot find module - handles quotes and various formats (runtime error)
  {
    pattern: /(?:Cannot find module|Module not found)[:\s]+['"]?([^'">\s]+)['"]?/i,
    translate: (match) => ({
      title: 'Không tìm thấy module',
      description: `Module '${match[1]}' không tồn tại hoặc chưa được cài đặt`,
      suggestions: [
        match[1].startsWith('.') || match[1].startsWith('@/')
          ? 'Kiểm tra đường dẫn import có chính xác'
          : `Chạy: npm install ${match[1]}`,
        'Kiểm tra file có tồn tại không',
        'Kiểm tra tsconfig paths nếu dùng alias'
      ],
      category: 'MODULE'
    })
  },

  // SyntaxError: Unexpected token - handles various formats
  {
    pattern: /SyntaxError:?\s*Unexpected token\s*['"]?(.{1,10})['"]?/i,
    translate: (match) => ({
      title: 'Lỗi cú pháp',
      description: `Có lỗi cú pháp trong code - token không mong đợi: '${match[1] || 'unknown'}'`,
      suggestions: [
        'Kiểm tra dấu ngoặc đóng/mở có đủ không',
        'Kiểm tra dấu phẩy, chấm phẩy',
        'Kiểm tra cú pháp arrow function, object'
      ],
      category: 'SYNTAX'
    })
  },

  // SyntaxError: Unexpected end of input
  {
    pattern: /SyntaxError:?\s*Unexpected end of/i,
    translate: () => ({
      title: 'Lỗi cú pháp - Thiếu đóng ngoặc',
      description: 'Code kết thúc đột ngột, có thể thiếu dấu ngoặc hoặc dấu quote',
      suggestions: [
        'Kiểm tra tất cả dấu { } ( ) [ ] có đủ cặp',
        'Kiểm tra string có đóng quote đúng không',
        'Sử dụng editor có highlight để tìm lỗi'
      ],
      category: 'SYNTAX'
    })
  },

  // ReferenceError: X is not defined
  {
    pattern: /ReferenceError:?\s*(\w+) is not defined/i,
    translate: (match) => ({
      title: 'Biến chưa được khai báo',
      description: `Biến '${match[1]}' được sử dụng nhưng chưa được khai báo`,
      suggestions: [
        `Khai báo biến: const ${match[1]} = ...`,
        'Kiểm tra import có đúng không',
        'Kiểm tra scope của biến'
      ],
      category: 'REFERENCE'
    })
  },

  // TypeError: X is not a function
  {
    pattern: /TypeError:?\s*['"]?(\w+)['"]? is not a function/i,
    translate: (match) => ({
      title: 'Không phải hàm',
      description: `'${match[1]}' không phải là một function, không thể gọi được`,
      suggestions: [
        'Kiểm tra import có đúng không',
        'Kiểm tra tên function có chính xác',
        'Kiểm tra object có method này không'
      ],
      category: 'TYPE'
    })
  },

  // TypeError: X is not iterable
  {
    pattern: /TypeError:?\s*(.+?) is not iterable/i,
    translate: (match) => ({
      title: 'Không thể lặp qua dữ liệu',
      description: `'${match[1]}' không phải là array hoặc iterable object`,
      suggestions: [
        'Kiểm tra data có phải array không',
        'Thêm Array.isArray() check trước khi loop',
        'Kiểm tra API response format'
      ],
      category: 'TYPE'
    })
  },

  // Maximum call stack size exceeded
  {
    pattern: /Maximum call stack size exceeded/i,
    translate: () => ({
      title: 'Stack Overflow',
      description: 'Có recursion vô hạn hoặc quá sâu trong code',
      suggestions: [
        'Kiểm tra recursive function có base case',
        'Kiểm tra circular dependency',
        'Sử dụng iteration thay vì recursion'
      ],
      category: 'RUNTIME'
    })
  },

  // ─────────────────────────────────────────────────────────────────────────────
  // File System Errors
  // ─────────────────────────────────────────────────────────────────────────────

  // ENOENT - handles with or without quotes
  {
    pattern: /ENOENT:?\s*no such file or directory[,:]?\s*(?:open\s+)?['"]?([^'">\s]+)['"]?/i,
    translate: (match) => ({
      title: 'File không tồn tại',
      description: `Không tìm thấy file hoặc thư mục: '${match[1] || 'unknown'}'`,
      suggestions: [
        'Kiểm tra đường dẫn file có chính xác',
        'Tạo file/thư mục nếu cần',
        'Kiểm tra quyền truy cập'
      ],
      category: 'FILE'
    })
  },

  // ENOENT - simple format fallback
  {
    pattern: /ENOENT/i,
    translate: () => ({
      title: 'File không tồn tại',
      description: 'Không tìm thấy file hoặc thư mục được yêu cầu',
      suggestions: [
        'Kiểm tra đường dẫn file có chính xác',
        'Tạo file/thư mục nếu cần',
        'Kiểm tra quyền truy cập'
      ],
      category: 'FILE'
    })
  },

  // EACCES
  {
    pattern: /EACCES:?\s*permission denied/i,
    translate: () => ({
      title: 'Không có quyền truy cập',
      description: 'Không có quyền để thực hiện thao tác này',
      suggestions: [
        'Chạy với sudo (cẩn thận!)',
        'Kiểm tra quyền của file/thư mục',
        'Đổi ownership: chown -R $USER:$USER .'
      ],
      category: 'PERMISSION'
    })
  },

  // EADDRINUSE
  {
    pattern: /EADDRINUSE.*?:?(\d+)/i,
    translate: (match) => ({
      title: 'Port đang được sử dụng',
      description: `Port ${match[1]} đã có process khác đang chạy`,
      suggestions: [
        `Kill process: lsof -ti:${match[1]} | xargs kill`,
        'Dùng port khác trong config',
        'Tìm và tắt ứng dụng đang dùng port'
      ],
      category: 'NETWORK'
    })
  },

  // Database connection refused (common ports) - MUST come before generic ECONNREFUSED
  {
    pattern: /ECONNREFUSED.*?(?:3306|5432|27017|6379)/i,
    translate: () => ({
      title: 'Database không chạy',
      description: 'Không thể kết nối database - service có thể chưa start',
      suggestions: [
        'Start database service',
        'Kiểm tra Docker container nếu dùng Docker',
        'Kiểm tra connection string trong .env'
      ],
      category: 'DATABASE'
    })
  },

  // ECONNREFUSED (generic - for non-database ports)
  {
    pattern: /ECONNREFUSED.*?(?::(\d+)|(\d+\.\d+\.\d+\.\d+))/i,
    translate: (match) => ({
      title: 'Không thể kết nối',
      description: `Không thể kết nối đến ${match[1] ? 'port ' + match[1] : 'server'} - service có thể chưa chạy`,
      suggestions: [
        'Kiểm tra service đã start chưa',
        'Kiểm tra firewall settings',
        'Kiểm tra URL/port trong config'
      ],
      category: 'NETWORK'
    })
  },

  // ─────────────────────────────────────────────────────────────────────────────
  // NPM Errors
  // ─────────────────────────────────────────────────────────────────────────────

  // npm ERR! code ERESOLVE
  {
    pattern: /npm ERR!?\s*(?:code\s+)?ERESOLVE/i,
    translate: () => ({
      title: 'Xung đột phiên bản dependency',
      description: 'Các package yêu cầu phiên bản dependency khác nhau',
      suggestions: [
        'Chạy: npm install --legacy-peer-deps',
        'Chạy: npm install --force',
        'Kiểm tra và update các package xung đột'
      ],
      category: 'NPM'
    })
  },

  // npm ERR! code ENOENT
  {
    pattern: /npm ERR!?\s*(?:code\s+)?ENOENT/i,
    translate: () => ({
      title: 'npm không tìm thấy file',
      description: 'npm không tìm thấy package.json hoặc file cần thiết',
      suggestions: [
        'Kiểm tra đang ở đúng thư mục project',
        'Chạy: npm init nếu chưa có package.json',
        'Kiểm tra file/thư mục có tồn tại'
      ],
      category: 'NPM'
    })
  },

  // npm ERR! code E4XX/E5XX
  {
    pattern: /npm ERR!?\s*(?:code\s+)?E(\d{3})/i,
    translate: (match) => ({
      title: 'Lỗi npm registry',
      description: `npm gặp lỗi HTTP ${match[1]} khi tải package`,
      suggestions: [
        'Kiểm tra kết nối internet',
        'Thử lại sau vài phút',
        'Kiểm tra npm registry có hoạt động không'
      ],
      category: 'NPM'
    })
  },

  // npm peer dep missing
  {
    pattern: /npm ERR!?\s*peer dep(?:endency)? missing/i,
    translate: () => ({
      title: 'Thiếu peer dependency',
      description: 'Một package yêu cầu dependency khác mà bạn chưa cài',
      suggestions: [
        'Chạy: npm install --legacy-peer-deps',
        'Cài thủ công package được yêu cầu',
        'Kiểm tra version compatibility'
      ],
      category: 'NPM'
    })
  },

  // ─────────────────────────────────────────────────────────────────────────────
  // Next.js / React Errors
  // ─────────────────────────────────────────────────────────────────────────────

  // Functions cannot be passed to Client Components
  {
    pattern: /Functions cannot be passed directly to Client Components/i,
    translate: () => ({
      title: 'Lỗi Server/Client Component (Next.js)',
      description: 'Đang truyền function vào Client Component - không được phép trong App Router',
      suggestions: [
        'Chuyển function thành serializable data',
        'Thêm "use client" vào component con',
        'Di chuyển logic vào Client Component'
      ],
      category: 'NEXTJS'
    })
  },

  // Hydration failed
  {
    pattern: /Hydration failed|Text content does not match/i,
    translate: () => ({
      title: 'Lỗi Hydration (React/Next.js)',
      description: 'HTML từ server không khớp với client - thường do render khác nhau',
      suggestions: [
        'Tránh dùng Date, random trong initial render',
        'Sử dụng useEffect cho browser-only code',
        'Kiểm tra conditional rendering logic'
      ],
      category: 'REACT'
    })
  },

  // Invalid hook call
  {
    pattern: /Invalid hook call/i,
    translate: () => ({
      title: 'Lỗi React Hook',
      description: 'Hook được gọi sai cách - có thể ngoài component hoặc trong condition',
      suggestions: [
        'Chỉ gọi hook trong function component',
        'Không gọi hook trong if/loop',
        'Kiểm tra có duplicate React không'
      ],
      category: 'REACT'
    })
  },

  // ─────────────────────────────────────────────────────────────────────────────
  // TypeScript Errors
  // ─────────────────────────────────────────────────────────────────────────────

  // TS Error codes (TSxxxx)
  {
    pattern: /(?:error\s+)?TS(\d{4,5}):\s*(.{10,80})/i,
    translate: (match) => ({
      title: `Lỗi TypeScript (TS${match[1]})`,
      description: match[2].substring(0, 60) + (match[2].length > 60 ? '...' : ''),
      suggestions: [
        'Kiểm tra kiểu dữ liệu của biến',
        'Thêm type annotation nếu cần',
        `Tìm hiểu thêm: typescript.tv/errors/#TS${match[1]}`
      ],
      category: 'TYPESCRIPT'
    })
  },

  // Type X is not assignable to type Y
  {
    pattern: /Type ['"]?([^'"]+?)['"]? is not assignable to type ['"]?([^'"]+?)['"]?/i,
    translate: (match) => ({
      title: 'Lỗi TypeScript - Type không khớp',
      description: `Type '${match[1].substring(0, 20)}' không thể gán cho '${match[2].substring(0, 20)}'`,
      suggestions: [
        'Kiểm tra kiểu dữ liệu của biến',
        'Thêm type assertion nếu chắc chắn',
        'Sửa type definition'
      ],
      category: 'TYPESCRIPT'
    })
  },

  // Property X does not exist on type
  {
    pattern: /Property ['"]?(\w+)['"]? does not exist on type/i,
    translate: (match) => ({
      title: 'Lỗi TypeScript - Property không tồn tại',
      description: `Property '${match[1]}' không có trong type definition`,
      suggestions: [
        'Thêm property vào interface/type',
        'Kiểm tra tên property có đúng không',
        'Sử dụng type assertion hoặc any (tạm thời)'
      ],
      category: 'TYPESCRIPT'
    })
  },

  // Argument of type X is not assignable
  {
    pattern: /Argument of type ['"]?([^'"]+?)['"]? is not assignable/i,
    translate: (match) => ({
      title: 'Lỗi TypeScript - Argument không khớp',
      description: `Argument '${match[1].substring(0, 30)}' không đúng type`,
      suggestions: [
        'Kiểm tra function signature',
        'Cast type nếu cần',
        'Sửa data truyền vào cho đúng type'
      ],
      category: 'TYPESCRIPT'
    })
  },

  // ─────────────────────────────────────────────────────────────────────────────
  // Database Errors
  // ─────────────────────────────────────────────────────────────────────────────

  // Prisma errors
  {
    pattern: /Prisma(?:Client)?.*?P(\d+)/i,
    translate: (match) => ({
      title: 'Lỗi Prisma Database',
      description: `Prisma error code P${match[1]}`,
      suggestions: [
        'Chạy: npx prisma db push',
        'Chạy: npx prisma generate',
        'Kiểm tra DATABASE_URL trong .env'
      ],
      category: 'DATABASE'
    })
  },

  // Prisma invalid invocation
  {
    pattern: /Invalid [`']?prisma\.(\w+)\.(\w+)\(\)/i,
    translate: (match) => ({
      title: 'Lỗi Prisma Query',
      description: `Lỗi khi gọi prisma.${match[1]}.${match[2]}()`,
      suggestions: [
        'Kiểm tra model tồn tại trong schema.prisma',
        'Chạy: npx prisma generate',
        'Kiểm tra syntax của query'
      ],
      category: 'DATABASE'
    })
  },

  // MySQL/PostgreSQL access denied
  {
    pattern: /ER_ACCESS_DENIED_ERROR|FATAL:\s*password authentication failed/i,
    translate: () => ({
      title: 'Lỗi truy cập Database',
      description: 'Sai username/password hoặc không có quyền truy cập database',
      suggestions: [
        'Kiểm tra DATABASE_URL trong .env',
        'Kiểm tra user có quyền access database',
        'Reset password nếu cần'
      ],
      category: 'DATABASE'
    })
  },

  // SQLITE_ERROR
  {
    pattern: /SQLITE_ERROR:?\s*(.+)/i,
    translate: (match) => ({
      title: 'Lỗi SQLite',
      description: match[1].substring(0, 60),
      suggestions: [
        'Kiểm tra file database có tồn tại',
        'Kiểm tra table/column name có đúng',
        'Chạy migration nếu schema thay đổi'
      ],
      category: 'DATABASE'
    })
  },

  // ─────────────────────────────────────────────────────────────────────────────
  // Git Errors
  // ─────────────────────────────────────────────────────────────────────────────

  // Not a git repository
  {
    pattern: /fatal:?\s*not a git repository/i,
    translate: () => ({
      title: 'Không phải Git repository',
      description: 'Thư mục hiện tại chưa được khởi tạo git',
      suggestions: [
        'Chạy: git init',
        'Đảm bảo đang ở đúng thư mục project',
        'Kiểm tra thư mục .git có tồn tại'
      ],
      category: 'GIT'
    })
  },

  // Failed to push
  {
    pattern: /error:?\s*failed to push some refs/i,
    translate: () => ({
      title: 'Không thể push lên remote',
      description: 'Remote có commits mới mà local chưa có',
      suggestions: [
        'Chạy: git pull --rebase',
        'Resolve conflicts nếu có',
        'Force push (cẩn thận!): git push -f'
      ],
      category: 'GIT'
    })
  },

  // Merge conflict
  {
    pattern: /CONFLICT.*?Merge conflict in (.+)/i,
    translate: (match) => ({
      title: 'Git Merge Conflict',
      description: `Có conflict trong file: ${match[1]}`,
      suggestions: [
        'Mở file và resolve conflicts thủ công',
        'Sử dụng git mergetool',
        'Sau khi resolve: git add . && git commit'
      ],
      category: 'GIT'
    })
  },

  // ─────────────────────────────────────────────────────────────────────────────
  // Build/Webpack Errors
  // ─────────────────────────────────────────────────────────────────────────────

  // Module build failed
  {
    pattern: /Module build failed/i,
    translate: () => ({
      title: 'Build module thất bại',
      description: 'Webpack/bundler không thể build một module',
      suggestions: [
        'Kiểm tra syntax của file được báo lỗi',
        'Kiểm tra loader config nếu dùng custom',
        'Clear cache: rm -rf .next node_modules/.cache'
      ],
      category: 'BUILD'
    })
  },

  // ─────────────────────────────────────────────────────────────────────────────
  // Memory/Performance Errors
  // ─────────────────────────────────────────────────────────────────────────────

  // JavaScript heap out of memory
  {
    pattern: /JavaScript heap out of memory|FATAL ERROR:?\s*(?:Ineffective mark-compacts|CALL_AND_RETRY_LAST)/i,
    translate: () => ({
      title: 'Hết bộ nhớ',
      description: 'Node.js hết RAM khi chạy - thường do data quá lớn hoặc memory leak',
      suggestions: [
        'Tăng memory: NODE_OPTIONS="--max-old-space-size=4096"',
        'Kiểm tra có memory leak không',
        'Xử lý data theo batch thay vì load all'
      ],
      category: 'MEMORY'
    })
  }
];

/**
 * Fallback for unknown errors
 */
const UNKNOWN_ERROR = {
  title: 'Lỗi không xác định',
  description: 'Đã xảy ra lỗi trong quá trình thực thi',
  suggestions: [
    'Chạy vibecode debug --auto để AI phân tích',
    'Kiểm tra console log chi tiết',
    'Chạy vibecode assist để được hỗ trợ'
  ],
  category: 'UNKNOWN'
};

/**
 * Translate an error to human-friendly Vietnamese
 * @param {Error|string} error - The error to translate
 * @param {Object} options - Options
 * @param {boolean} options.debug - Enable debug mode
 * @returns {Object} Translated error info
 */
export function translateError(error, options = {}) {
  const errorMessage = typeof error === 'string' ? error : error.message || String(error);

  if (options.debug) {
    console.log('[DEBUG] translateError input:', errorMessage.substring(0, 100));
  }

  for (let i = 0; i < ERROR_PATTERNS.length; i++) {
    const { pattern, translate } = ERROR_PATTERNS[i];

    if (options.debug) {
      console.log(`[DEBUG] Testing pattern ${i}:`, pattern.toString().substring(0, 50));
    }

    const match = errorMessage.match(pattern);

    if (match) {
      if (options.debug) {
        console.log('[DEBUG] Matched! Groups:', match.slice(0, 3));
      }
      const result = translate(match);
      return result;
    }
  }

  if (options.debug) {
    console.log('[DEBUG] No pattern matched');
  }

  return {
    ...UNKNOWN_ERROR,
    originalMessage: errorMessage.substring(0, 100)
  };
}

/**
 * Format translated error as a pretty box
 * @param {Error|string} error - The error to format
 * @param {Object} options - Formatting options
 * @returns {string} Formatted error string
 */
export function formatTranslatedError(error, options = {}) {
  const translated = translateError(error);
  const errorMessage = typeof error === 'string' ? error : error.message || String(error);

  // Extract location if available
  const locationMatch = errorMessage.match(/at\s+(?:\w+\s+)?\(?([^:]+):(\d+)(?::\d+)?\)?/);
  const location = locationMatch ? `${locationMatch[1]} dòng ${locationMatch[2]}` : null;

  const lines = [];

  // Header
  lines.push(chalk.red('╭────────────────────────────────────────────────────────────────────╮'));
  lines.push(chalk.red('│') + `  ❌ ${chalk.bold.red('LỖI:')} ${chalk.white(translated.title)}`.padEnd(76) + chalk.red('│'));
  lines.push(chalk.red('│') + ''.padEnd(68) + chalk.red('│'));

  // Description (wrap if too long)
  const desc = translated.description;
  if (desc.length <= 55) {
    lines.push(chalk.red('│') + `  ${chalk.gray('Vấn đề:')} ${chalk.white(desc)}`.padEnd(76) + chalk.red('│'));
  } else {
    lines.push(chalk.red('│') + `  ${chalk.gray('Vấn đề:')} ${chalk.white(desc.substring(0, 55))}`.padEnd(76) + chalk.red('│'));
    lines.push(chalk.red('│') + `           ${chalk.white(desc.substring(55, 110))}`.padEnd(76) + chalk.red('│'));
  }

  // Location
  if (location) {
    lines.push(chalk.red('│') + ''.padEnd(68) + chalk.red('│'));
    lines.push(chalk.red('│') + `  📍 ${chalk.gray('Vị trí:')} ${chalk.yellow(location)}`.padEnd(76) + chalk.red('│'));
  }

  // Suggestions
  lines.push(chalk.red('│') + ''.padEnd(68) + chalk.red('│'));
  lines.push(chalk.red('│') + `  💡 ${chalk.gray('Gợi ý:')}`.padEnd(76) + chalk.red('│'));

  for (const suggestion of translated.suggestions.slice(0, 3)) {
    const truncated = suggestion.length > 58 ? suggestion.substring(0, 55) + '...' : suggestion;
    lines.push(chalk.red('│') + `  ${chalk.cyan('•')} ${chalk.white(truncated)}`.padEnd(76) + chalk.red('│'));
  }

  // Debug hint
  lines.push(chalk.red('│') + ''.padEnd(68) + chalk.red('│'));
  lines.push(chalk.red('│') + `  ${chalk.gray('Chạy')} ${chalk.cyan('vibecode debug --auto')} ${chalk.gray('để AI phân tích chi tiết')}`.padEnd(76) + chalk.red('│'));
  lines.push(chalk.red('│') + ''.padEnd(68) + chalk.red('│'));
  lines.push(chalk.red('╰────────────────────────────────────────────────────────────────────╯'));

  // Original error (verbose mode)
  if (options.verbose && options.showOriginal !== false) {
    lines.push('');
    lines.push(chalk.gray('Original error:'));
    lines.push(chalk.gray(errorMessage.substring(0, 300)));
  }

  return lines.join('\n');
}

/**
 * Show error in formatted box (console.log wrapper)
 * @param {Error|string} error - The error to show
 * @param {Object} options - Display options
 */
export function showError(error, options = {}) {
  console.log(formatTranslatedError(error, options));
}

/**
 * Get inline error message (short, single line)
 * @param {Error|string} error - The error to translate
 * @returns {string} Short error message
 */
export function inlineError(error) {
  const translated = translateError(error);
  return chalk.red(`❌ ${translated.title}: ${translated.description.substring(0, 50)}${translated.description.length > 50 ? '...' : ''}`);
}

/**
 * Get error category for filtering/grouping
 * @param {Error|string} error - The error
 * @returns {string} Error category
 */
export function getErrorCategory(error) {
  const translated = translateError(error);
  return translated.category || 'UNKNOWN';
}

/**
 * Check if error is of a specific category
 * @param {Error|string} error - The error
 * @param {string} category - Category to check
 * @returns {boolean}
 */
export function isErrorCategory(error, category) {
  return getErrorCategory(error) === category;
}

/**
 * Get all pattern categories for documentation
 * @returns {string[]} List of categories
 */
export function getCategories() {
  const categories = new Set();
  for (const { translate } of ERROR_PATTERNS) {
    // Call translate with empty match to get category
    try {
      const result = translate(['', '', '']);
      if (result.category) {
        categories.add(result.category);
      }
    } catch {
      // Some translates may fail with empty match, ignore
    }
  }
  return [...categories];
}
