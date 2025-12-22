// ═══════════════════════════════════════════════════════════════════════════════
// VIBECODE CLI - Learn Command
// Phase H5: View and manage AI learnings
// ═══════════════════════════════════════════════════════════════════════════════

import chalk from 'chalk';
import inquirer from 'inquirer';
import fs from 'fs/promises';
import path from 'path';
import { LearningEngine } from '../core/learning.js';

/**
 * Learn Command - View and manage AI learnings
 *
 * Usage:
 *   vibecode learn           - Interactive menu
 *   vibecode learn --stats   - Show learning statistics
 *   vibecode learn --clear   - Clear all learnings
 *   vibecode learn --export  - Export learnings to file
 */
export async function learnCommand(options = {}) {
  const learning = new LearningEngine();

  if (options.stats) {
    await showStats(learning);
    return;
  }

  if (options.clear) {
    await clearLearnings(learning, options.force);
    return;
  }

  if (options.export) {
    await exportLearnings(learning);
    return;
  }

  // Default: show interactive menu
  await interactiveLearn(learning);
}

/**
 * Show learning statistics
 */
async function showStats(learning) {
  const stats = await learning.getStats();

  console.log(chalk.cyan(`
╭────────────────────────────────────────────────────────────────────╮
│  📊 LEARNING STATISTICS                                            │
╰────────────────────────────────────────────────────────────────────╯
  `));

  console.log(chalk.white(`  📁 Project Learnings`));
  console.log(chalk.gray(`     Tổng fixes: ${stats.local.total}`));
  console.log(chalk.gray(`     Thành công: ${stats.local.success} (${stats.local.rate}%)`));
  console.log('');

  console.log(chalk.white(`  🌍 Global Learnings`));
  console.log(chalk.gray(`     Tổng fixes: ${stats.global.total}`));
  console.log(chalk.gray(`     Thành công: ${stats.global.success} (${stats.global.rate}%)`));
  console.log('');

  if (Object.keys(stats.byCategory).length > 0) {
    console.log(chalk.white(`  📂 Theo Error Category`));
    for (const [cat, data] of Object.entries(stats.byCategory)) {
      const rate = data.total > 0 ? (data.success / data.total * 100).toFixed(0) : 0;
      const bar = renderMiniBar(data.success, data.total);
      console.log(chalk.gray(`     ${cat.padEnd(12)} ${bar} ${data.success}/${data.total} (${rate}%)`));
    }
    console.log('');
  }

  console.log(chalk.white(`  ⚙️  Preferences đã lưu: ${stats.preferences}`));

  if (stats.lastLearning) {
    const lastDate = new Date(stats.lastLearning).toLocaleString('vi-VN');
    console.log(chalk.gray(`  📅 Learning gần nhất: ${lastDate}`));
  }

  console.log('');
}

/**
 * Render a mini progress bar
 */
function renderMiniBar(value, total) {
  const width = 10;
  const filled = total > 0 ? Math.round(width * value / total) : 0;
  const empty = width - filled;
  return chalk.green('█'.repeat(filled)) + chalk.gray('░'.repeat(empty));
}

/**
 * Clear all local learnings
 */
async function clearLearnings(learning, force) {
  const stats = await learning.getStats();

  if (stats.local.total === 0) {
    console.log(chalk.yellow('\n📭 Không có learnings nào để xoá.\n'));
    return;
  }

  if (!force) {
    console.log(chalk.yellow(`\n⚠️  Sắp xoá ${stats.local.total} learnings của project này.\n`));

    const { confirm } = await inquirer.prompt([
      {
        type: 'confirm',
        name: 'confirm',
        message: 'Xác nhận xoá tất cả learnings?',
        default: false
      }
    ]);

    if (!confirm) {
      console.log(chalk.gray('\n👋 Đã huỷ.\n'));
      return;
    }
  }

  await learning.clearLocal();
  console.log(chalk.green(`\n✅ Đã xoá ${stats.local.total} learnings.\n`));
}

/**
 * Export learnings to file
 */
async function exportLearnings(learning) {
  const stats = await learning.getStats();
  const fixes = await learning.loadJson(
    path.join(learning.localPath, 'fixes.json'),
    []
  );
  const prefs = await learning.loadJson(
    path.join(learning.localPath, 'preferences.json'),
    {}
  );

  if (fixes.length === 0 && Object.keys(prefs).length === 0) {
    console.log(chalk.yellow('\n📭 Không có learnings nào để export.\n'));
    return;
  }

  const exportData = {
    exportedAt: new Date().toISOString(),
    projectPath: learning.projectPath,
    stats,
    fixes: fixes.map(f => ({
      id: f.id,
      errorType: f.errorType,
      errorCategory: f.errorCategory,
      success: f.success,
      userFeedback: f.userFeedback,
      projectType: f.projectType,
      timestamp: f.timestamp
    })),
    preferences: prefs
  };

  const exportPath = `vibecode-learnings-${Date.now()}.json`;
  await fs.writeFile(exportPath, JSON.stringify(exportData, null, 2));

  console.log(chalk.green(`\n✅ Đã export ${fixes.length} learnings → ${exportPath}\n`));
}

/**
 * Interactive learning menu
 */
async function interactiveLearn(learning) {
  const stats = await learning.getStats();

  const successBar = renderMiniBar(stats.local.success, stats.local.total);

  console.log(chalk.cyan(`
╭────────────────────────────────────────────────────────────────────╮
│  🧠 VIBECODE LEARNING                                              │
│                                                                    │
│  AI học từ feedback của bạn để cải thiện suggestions.             │
│                                                                    │
│  Success rate: ${successBar} ${String(stats.local.rate + '%').padEnd(30)}│
│  Total learnings: ${String(stats.local.total).padEnd(44)}│
│                                                                    │
╰────────────────────────────────────────────────────────────────────╯
  `));

  const { action } = await inquirer.prompt([
    {
      type: 'list',
      name: 'action',
      message: 'Bạn muốn làm gì?',
      choices: [
        { name: '📊 Xem thống kê chi tiết', value: 'stats' },
        { name: '📤 Export learnings', value: 'export' },
        { name: '🗑️  Xoá learnings', value: 'clear' },
        new inquirer.Separator(),
        { name: '👋 Thoát', value: 'exit' }
      ]
    }
  ]);

  switch (action) {
    case 'stats':
      await showStats(learning);
      break;
    case 'export':
      await exportLearnings(learning);
      break;
    case 'clear':
      await clearLearnings(learning, false);
      break;
  }
}

/**
 * Ask for feedback after a fix
 * Called from debug/fix commands
 */
export async function askFeedback(fixInfo) {
  console.log('');
  const { feedback } = await inquirer.prompt([
    {
      type: 'list',
      name: 'feedback',
      message: 'Fix này có đúng không?',
      choices: [
        { name: '✅ Đúng, hoạt động tốt', value: 'success' },
        { name: '❌ Không đúng', value: 'failed' },
        { name: '🔄 Đúng một phần', value: 'partial' },
        { name: '⏭️  Bỏ qua', value: 'skip' }
      ]
    }
  ]);

  if (feedback === 'skip') {
    return null;
  }

  const learning = new LearningEngine();
  let userCorrection = null;

  if (feedback === 'failed' || feedback === 'partial') {
    const { correction } = await inquirer.prompt([
      {
        type: 'input',
        name: 'correction',
        message: 'Mô tả ngắn vấn đề hoặc cách fix đúng (Enter để bỏ qua):',
      }
    ]);
    userCorrection = correction || null;
  }

  await learning.recordFix({
    errorType: fixInfo.errorType,
    errorMessage: fixInfo.errorMessage,
    errorCategory: fixInfo.errorCategory,
    fixApplied: fixInfo.fixApplied,
    success: feedback === 'success',
    userFeedback: feedback,
    userCorrection
  });

  if (feedback === 'success') {
    console.log(chalk.green('  ✅ Đã ghi nhận. Cảm ơn!\n'));
  } else {
    console.log(chalk.yellow('  📝 Đã ghi nhận feedback.\n'));
  }

  return feedback;
}

/**
 * Show learning-based suggestion (if available)
 */
export async function showLearningSuggestion(errorType, errorCategory) {
  const learning = new LearningEngine();
  const suggestion = await learning.getSuggestion(errorType, errorCategory);

  if (suggestion && suggestion.confidence > 0.6) {
    const confidencePercent = (suggestion.confidence * 100).toFixed(0);
    console.log(chalk.cyan(`  💡 Dựa trên ${suggestion.basedOn} fixes trước (độ tin cậy: ${confidencePercent}%)`));

    if (suggestion.suggestion) {
      const shortSuggestion = suggestion.suggestion.substring(0, 100);
      console.log(chalk.gray(`     Gợi ý: ${shortSuggestion}${suggestion.suggestion.length > 100 ? '...' : ''}`));
    }
    console.log('');
    return suggestion;
  }

  return null;
}
