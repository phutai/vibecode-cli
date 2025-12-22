// ═══════════════════════════════════════════════════════════════════════════════
// VIBECODE CLI - Backup Manager
// Phase H4: Undo/Rollback - Auto-backup before every action
// ═══════════════════════════════════════════════════════════════════════════════

import fs from 'fs-extra';
import path from 'path';
import { createHash } from 'crypto';

const BACKUP_DIR = '.vibecode/backups';
const MAX_BACKUPS = 10;

/**
 * BackupManager - Creates and manages backups for undo functionality
 *
 * Usage:
 *   const backup = new BackupManager();
 *   const id = await backup.createBackup('build');
 *   // ... do stuff ...
 *   await backup.restore(id);  // Undo!
 */
export class BackupManager {
  constructor(projectPath = process.cwd()) {
    this.projectPath = projectPath;
    this.backupPath = path.join(projectPath, BACKUP_DIR);
  }

  /**
   * Initialize backup directory
   */
  async init() {
    await fs.ensureDir(this.backupPath);
  }

  /**
   * Create backup before action
   * @param {string} actionName - Name of action (build, agent, go, etc.)
   * @param {string[]} files - Specific files to backup (optional)
   * @returns {string} Backup ID
   */
  async createBackup(actionName, files = null) {
    await this.init();

    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const backupId = `${timestamp}_${actionName}`;
    const backupDir = path.join(this.backupPath, backupId);

    await fs.ensureDir(backupDir);

    // If specific files provided, backup only those
    // Otherwise, backup common source files
    const filesToBackup = files || await this.getSourceFiles();

    const manifest = {
      id: backupId,
      action: actionName,
      timestamp: new Date().toISOString(),
      files: []
    };

    for (const file of filesToBackup) {
      try {
        const sourcePath = path.join(this.projectPath, file);
        const stats = await fs.stat(sourcePath).catch(() => null);

        if (stats && stats.isFile()) {
          const content = await fs.readFile(sourcePath);
          const hash = createHash('md5').update(content).digest('hex');

          // Replace slashes with __ for flat storage
          const backupFileName = file.replace(/[/\\]/g, '__');
          const backupFilePath = path.join(backupDir, backupFileName);

          await fs.writeFile(backupFilePath, content);

          manifest.files.push({
            path: file,
            hash,
            size: stats.size,
            backupName: backupFileName
          });
        }
      } catch (error) {
        // Skip files that can't be backed up
      }
    }

    // Save manifest
    await fs.writeFile(
      path.join(backupDir, 'manifest.json'),
      JSON.stringify(manifest, null, 2)
    );

    // Cleanup old backups
    await this.cleanupOldBackups();

    return backupId;
  }

  /**
   * Get list of source files to backup
   * @returns {string[]} File paths relative to project
   */
  async getSourceFiles() {
    const files = [];
    const ignoreDirs = [
      'node_modules', '.git', '.next', 'dist', 'build',
      '.vibecode/backups', 'coverage', '.cache', '__pycache__'
    ];
    const extensions = [
      '.js', '.ts', '.tsx', '.jsx', '.json', '.css', '.scss',
      '.html', '.md', '.vue', '.svelte', '.prisma', '.env'
    ];

    const scan = async (dir, prefix = '') => {
      try {
        const entries = await fs.readdir(dir, { withFileTypes: true });

        for (const entry of entries) {
          const fullPath = path.join(dir, entry.name);
          const relativePath = prefix ? `${prefix}/${entry.name}` : entry.name;

          if (entry.isDirectory()) {
            if (!ignoreDirs.includes(entry.name) && !entry.name.startsWith('.')) {
              await scan(fullPath, relativePath);
            }
          } else if (entry.isFile()) {
            const ext = path.extname(entry.name);
            if (extensions.includes(ext)) {
              files.push(relativePath);
            }
          }
        }
      } catch (error) {
        // Skip directories that can't be read
      }
    };

    await scan(this.projectPath);
    return files.slice(0, 100); // Limit to 100 files
  }

  /**
   * List available backups
   * @returns {Object[]} Array of backup manifests
   */
  async listBackups() {
    await this.init();

    try {
      const entries = await fs.readdir(this.backupPath, { withFileTypes: true });
      const backups = [];

      for (const entry of entries) {
        if (entry.isDirectory()) {
          const manifestPath = path.join(this.backupPath, entry.name, 'manifest.json');
          try {
            const manifest = await fs.readJson(manifestPath);
            backups.push(manifest);
          } catch {
            // Skip invalid backups
          }
        }
      }

      // Sort by timestamp, newest first
      return backups.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
    } catch {
      return [];
    }
  }

  /**
   * Restore from backup
   * @param {string} backupId - Backup ID to restore
   * @returns {Object} Restore result
   */
  async restore(backupId) {
    const backupDir = path.join(this.backupPath, backupId);
    const manifestPath = path.join(backupDir, 'manifest.json');

    try {
      const manifest = await fs.readJson(manifestPath);
      const restored = [];

      for (const file of manifest.files) {
        const backupFilePath = path.join(backupDir, file.backupName);
        const targetPath = path.join(this.projectPath, file.path);

        // Ensure directory exists
        await fs.ensureDir(path.dirname(targetPath));

        // Restore file
        const content = await fs.readFile(backupFilePath);
        await fs.writeFile(targetPath, content);

        restored.push(file.path);
      }

      return {
        success: true,
        backupId,
        action: manifest.action,
        timestamp: manifest.timestamp,
        filesRestored: restored.length,
        files: restored
      };
    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Restore to N steps ago
   * @param {number} steps - Number of steps back
   * @returns {Object} Restore result
   */
  async restoreSteps(steps = 1) {
    const backups = await this.listBackups();

    if (steps > backups.length) {
      return {
        success: false,
        error: `Only ${backups.length} backups available`
      };
    }

    const backup = backups[steps - 1];
    return await this.restore(backup.id);
  }

  /**
   * Get the most recent backup
   * @returns {Object|null} Latest backup manifest or null
   */
  async getLatestBackup() {
    const backups = await this.listBackups();
    return backups.length > 0 ? backups[0] : null;
  }

  /**
   * Cleanup old backups to maintain MAX_BACKUPS limit
   */
  async cleanupOldBackups() {
    const backups = await this.listBackups();

    if (backups.length > MAX_BACKUPS) {
      const toDelete = backups.slice(MAX_BACKUPS);

      for (const backup of toDelete) {
        const backupDir = path.join(this.backupPath, backup.id);
        await fs.remove(backupDir);
      }
    }
  }

  /**
   * Delete specific backup
   * @param {string} backupId - Backup ID to delete
   */
  async deleteBackup(backupId) {
    const backupDir = path.join(this.backupPath, backupId);
    await fs.remove(backupDir);
  }

  /**
   * Clear all backups
   */
  async clearAllBackups() {
    await fs.remove(this.backupPath);
    await this.init();
  }

  /**
   * Get backup size in bytes
   * @param {string} backupId - Backup ID
   * @returns {number} Size in bytes
   */
  async getBackupSize(backupId) {
    const backupDir = path.join(this.backupPath, backupId);
    let totalSize = 0;

    try {
      const files = await fs.readdir(backupDir);
      for (const file of files) {
        const stats = await fs.stat(path.join(backupDir, file));
        totalSize += stats.size;
      }
    } catch {
      // Ignore errors
    }

    return totalSize;
  }
}

/**
 * Helper to wrap action with auto-backup
 * @param {string} actionName - Name of action
 * @param {Function} fn - Async function to execute
 * @returns {*} Result of fn()
 */
export async function withBackup(actionName, fn) {
  const backup = new BackupManager();
  const backupId = await backup.createBackup(actionName);

  try {
    return await fn();
  } catch (error) {
    // Error occurred - backup is available for restore
    console.log(`\n💾 Backup created: ${backupId}`);
    console.log(`   Run 'vibecode undo' to restore previous state.\n`);
    throw error;
  }
}

/**
 * Create backup manager instance
 */
export function createBackupManager(projectPath) {
  return new BackupManager(projectPath);
}
