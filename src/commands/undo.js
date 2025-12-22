// ═══════════════════════════════════════════════════════════════════════════════
// VIBECODE CLI - Undo Command
// Phase H4: Revert last action with backup restore
// ═══════════════════════════════════════════════════════════════════════════════

import chalk from 'chalk';
import inquirer from 'inquirer';
import { BackupManager } from '../core/backup.js';

/**
 * Undo Command - Revert to previous state
 *
 * Usage:
 *   vibecode undo           - Interactive restore menu
 *   vibecode undo --list    - List available backups
 *   vibecode undo --step 2  - Restore to 2 steps ago
 *   vibecode undo --clear   - Clear all backups
 */
export async function undoCommand(options = {}) {
  const backup = new BackupManager();

  // Clear all backups
  if (options.clear) {
    await clearBackups(backup, options);
    return;
  }

  // List backups
  if (options.list) {
    await listBackups(backup);
    return;
  }

  // Restore specific step
  if (options.step) {
    await restoreStep(backup, parseInt(options.step), options.force);
    return;
  }

  // Interactive undo
  await interactiveUndo(backup);
}

/**
 * List all available backups
 */
async function listBackups(backup) {
  const backups = await backup.listBackups();

  if (backups.length === 0) {
    console.log(chalk.yellow('\n📭 Chưa có backup nào.\n'));
    console.log(chalk.gray('Backup sẽ được tạo tự động khi chạy:'));
    console.log(chalk.gray('  • vibecode build --auto'));
    console.log(chalk.gray('  • vibecode agent'));
    console.log(chalk.gray('  • vibecode go'));
    console.log();
    return;
  }

  console.log(chalk.cyan(`
╭────────────────────────────────────────────────────────────────────╮
│  📦 BACKUP HISTORY                                                 │
╰────────────────────────────────────────────────────────────────────╯
  `));

  backups.forEach((b, index) => {
    const date = new Date(b.timestamp);
    const timeAgo = getTimeAgo(date);
    const filesCount = b.files?.length || 0;

    console.log(chalk.white(`  ${(index + 1).toString().padStart(2)}. ${chalk.bold(b.action)}`));
    console.log(chalk.gray(`      ${timeAgo} · ${filesCount} files`));
    console.log('');
  });

  console.log(chalk.gray(`  Chạy ${chalk.cyan('vibecode undo')} để restore`));
  console.log(chalk.gray(`  Hoặc ${chalk.cyan('vibecode undo --step N')} để restore step cụ thể\n`));
}

/**
 * Restore to specific step
 */
async function restoreStep(backup, step, force = false) {
  const backups = await backup.listBackups();

  if (backups.length === 0) {
    console.log(chalk.yellow('\n📭 Chưa có backup nào để restore.\n'));
    return;
  }

  if (step < 1 || step > backups.length) {
    console.log(chalk.red(`\n❌ Step ${step} không tồn tại.`));
    console.log(chalk.gray(`   Có ${backups.length} backups (1-${backups.length}).\n`));
    return;
  }

  const targetBackup = backups[step - 1];

  console.log(chalk.yellow(`\n⚠️  Sắp restore về: ${chalk.bold(targetBackup.action)}`));
  console.log(chalk.gray(`   Thời gian: ${new Date(targetBackup.timestamp).toLocaleString('vi-VN')}`));
  console.log(chalk.gray(`   Files: ${targetBackup.files?.length || 0}\n`));

  if (!force) {
    const { confirm } = await inquirer.prompt([
      {
        type: 'confirm',
        name: 'confirm',
        message: 'Xác nhận restore?',
        default: false
      }
    ]);

    if (!confirm) {
      console.log(chalk.gray('\n👋 Đã huỷ.\n'));
      return;
    }
  }

  const result = await backup.restore(targetBackup.id);
  showRestoreResult(result);
}

/**
 * Interactive undo menu
 */
async function interactiveUndo(backup) {
  const backups = await backup.listBackups();

  if (backups.length === 0) {
    console.log(chalk.yellow('\n📭 Chưa có backup nào để undo.\n'));
    console.log(chalk.gray('Backup sẽ được tạo tự động khi chạy các lệnh build.'));
    console.log();
    return;
  }

  console.log(chalk.cyan(`
╭────────────────────────────────────────────────────────────────────╮
│  ⏪ VIBECODE UNDO                                                  │
│                                                                    │
│  Chọn backup để restore files về trạng thái trước đó.             │
│                                                                    │
╰────────────────────────────────────────────────────────────────────╯
  `));

  const choices = backups.map((b, index) => {
    const timeAgo = getTimeAgo(new Date(b.timestamp));
    const filesCount = b.files?.length || 0;
    return {
      name: `${b.action} (${timeAgo}, ${filesCount} files)`,
      value: b.id,
      short: b.action
    };
  });

  choices.push(new inquirer.Separator());
  choices.push({ name: '❌ Huỷ', value: 'cancel' });

  const { backupId } = await inquirer.prompt([
    {
      type: 'list',
      name: 'backupId',
      message: 'Chọn backup để restore:',
      choices,
      pageSize: 10
    }
  ]);

  if (backupId === 'cancel') {
    console.log(chalk.gray('\n👋 Đã huỷ.\n'));
    return;
  }

  const targetBackup = backups.find(b => b.id === backupId);

  // Show files that will be restored
  if (targetBackup.files && targetBackup.files.length > 0) {
    console.log(chalk.gray('\n  Files sẽ được restore:'));
    const displayFiles = targetBackup.files.slice(0, 5);
    for (const f of displayFiles) {
      console.log(chalk.gray(`    • ${f.path}`));
    }
    if (targetBackup.files.length > 5) {
      console.log(chalk.gray(`    ... và ${targetBackup.files.length - 5} files khác`));
    }
    console.log();
  }

  const { confirm } = await inquirer.prompt([
    {
      type: 'confirm',
      name: 'confirm',
      message: `Restore về "${targetBackup.action}"?`,
      default: false
    }
  ]);

  if (!confirm) {
    console.log(chalk.gray('\n👋 Đã huỷ.\n'));
    return;
  }

  const result = await backup.restore(backupId);
  showRestoreResult(result);
}

/**
 * Clear all backups
 */
async function clearBackups(backup, options) {
  const backups = await backup.listBackups();

  if (backups.length === 0) {
    console.log(chalk.yellow('\n📭 Không có backup nào để xoá.\n'));
    return;
  }

  if (!options.force) {
    console.log(chalk.yellow(`\n⚠️  Sắp xoá ${backups.length} backups.\n`));

    const { confirm } = await inquirer.prompt([
      {
        type: 'confirm',
        name: 'confirm',
        message: 'Xác nhận xoá tất cả backups?',
        default: false
      }
    ]);

    if (!confirm) {
      console.log(chalk.gray('\n👋 Đã huỷ.\n'));
      return;
    }
  }

  await backup.clearAllBackups();
  console.log(chalk.green(`\n✅ Đã xoá ${backups.length} backups.\n`));
}

/**
 * Show restore result
 */
function showRestoreResult(result) {
  if (result.success) {
    console.log(chalk.green(`
╭────────────────────────────────────────────────────────────────────╮
│  ✅ RESTORE THÀNH CÔNG                                             │
│                                                                    │
│  Action: ${result.action.substring(0, 54).padEnd(54)}│
│  Files restored: ${String(result.filesRestored).padEnd(46)}│
│                                                                    │
╰────────────────────────────────────────────────────────────────────╯
    `));

    // Show some restored files
    if (result.files && result.files.length > 0) {
      console.log(chalk.gray('  Files đã restore:'));
      for (const f of result.files.slice(0, 5)) {
        console.log(chalk.gray(`    ✓ ${f}`));
      }
      if (result.files.length > 5) {
        console.log(chalk.gray(`    ... và ${result.files.length - 5} files khác`));
      }
      console.log();
    }
  } else {
    console.log(chalk.red(`\n❌ Restore thất bại: ${result.error}\n`));
  }
}

/**
 * Get human-readable time ago string
 */
function getTimeAgo(date) {
  const seconds = Math.floor((new Date() - date) / 1000);

  if (seconds < 60) return 'vừa xong';
  if (seconds < 3600) return `${Math.floor(seconds / 60)} phút trước`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)} giờ trước`;
  if (seconds < 604800) return `${Math.floor(seconds / 86400)} ngày trước`;
  return `${Math.floor(seconds / 604800)} tuần trước`;
}
