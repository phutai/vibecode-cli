// ═══════════════════════════════════════════════════════════════════════════════
// VIBECODE CLI - File Utilities
// ═══════════════════════════════════════════════════════════════════════════════

import fs from 'fs-extra';
import path from 'path';
import yaml from 'yaml';

/**
 * Check if path exists
 */
export async function pathExists(targetPath) {
  try {
    await fs.access(targetPath);
    return true;
  } catch {
    return false;
  }
}

/**
 * Read JSON file
 */
export async function readJson(filePath) {
  const content = await fs.readFile(filePath, 'utf-8');
  return JSON.parse(content);
}

/**
 * Write JSON file
 */
export async function writeJson(filePath, data) {
  await fs.writeFile(filePath, JSON.stringify(data, null, 2), 'utf-8');
}

/**
 * Read YAML file
 */
export async function readYaml(filePath) {
  const content = await fs.readFile(filePath, 'utf-8');
  return yaml.parse(content);
}

/**
 * Write YAML file
 */
export async function writeYaml(filePath, data) {
  await fs.writeFile(filePath, yaml.stringify(data), 'utf-8');
}

/**
 * Read markdown file
 */
export async function readMarkdown(filePath) {
  return await fs.readFile(filePath, 'utf-8');
}

/**
 * Write markdown file
 */
export async function writeMarkdown(filePath, content) {
  await fs.writeFile(filePath, content, 'utf-8');
}

/**
 * Ensure directory exists
 */
export async function ensureDir(dirPath) {
  await fs.ensureDir(dirPath);
}

/**
 * Get current working directory name
 */
export function getCurrentDirName() {
  return path.basename(process.cwd());
}

/**
 * Append to file
 */
export async function appendToFile(filePath, content) {
  await fs.appendFile(filePath, content + '\n', 'utf-8');
}
