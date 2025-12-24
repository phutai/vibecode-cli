// ═══════════════════════════════════════════════════════════════════════════════
// VIBECODE CLI - History & Favorites Utility
// Phase M8: Command history and favorite prompts management
// ═══════════════════════════════════════════════════════════════════════════════

import fs from 'fs/promises';
import path from 'path';
import os from 'os';

// ─────────────────────────────────────────────────────────────────────────────
// Configuration
// ─────────────────────────────────────────────────────────────────────────────

const HISTORY_DIR = path.join(os.homedir(), '.vibecode');
const HISTORY_FILE = path.join(HISTORY_DIR, 'history.json');
const FAVORITES_FILE = path.join(HISTORY_DIR, 'favorites.json');
const MAX_HISTORY = 100;

// ─────────────────────────────────────────────────────────────────────────────
// History Functions
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Add a command to history
 * @param {string} command - The command that was run
 * @param {string} description - Description of the command
 * @param {Object} metadata - Additional metadata
 */
export async function addToHistory(command, description = '', metadata = {}) {
  const history = await loadHistory();

  history.unshift({
    id: Date.now(),
    command,
    description,
    timestamp: new Date().toISOString(),
    cwd: process.cwd(),
    ...metadata
  });

  // Keep only last MAX_HISTORY items
  if (history.length > MAX_HISTORY) {
    history.length = MAX_HISTORY;
  }

  await saveHistory(history);
}

/**
 * Load history from disk
 * @returns {Promise<Array>} History array
 */
export async function loadHistory() {
  try {
    await fs.mkdir(HISTORY_DIR, { recursive: true });
    const content = await fs.readFile(HISTORY_FILE, 'utf-8');
    return JSON.parse(content);
  } catch {
    return [];
  }
}

/**
 * Save history to disk
 * @param {Array} history - History array to save
 */
export async function saveHistory(history) {
  await fs.mkdir(HISTORY_DIR, { recursive: true });
  await fs.writeFile(HISTORY_FILE, JSON.stringify(history, null, 2));
}

/**
 * Clear all history
 */
export async function clearHistory() {
  await saveHistory([]);
}

/**
 * Search history by query
 * @param {string} query - Search query
 * @returns {Promise<Array>} Matching history items
 */
export async function searchHistory(query) {
  const history = await loadHistory();
  const q = query.toLowerCase();

  return history.filter(item =>
    item.command.toLowerCase().includes(q) ||
    (item.description && item.description.toLowerCase().includes(q))
  );
}

/**
 * Get history item by index (1-based)
 * @param {number} index - Item index (1-based)
 * @returns {Promise<Object|null>} History item or null
 */
export async function getHistoryItem(index) {
  const history = await loadHistory();
  return history[index - 1] || null;
}

/**
 * Get history stats
 * @returns {Promise<Object>} History statistics
 */
export async function getHistoryStats() {
  const history = await loadHistory();

  if (history.length === 0) {
    return { total: 0, oldest: null, newest: null };
  }

  return {
    total: history.length,
    oldest: history[history.length - 1]?.timestamp,
    newest: history[0]?.timestamp
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Favorites Functions
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Load favorites from disk
 * @returns {Promise<Array>} Favorites array
 */
export async function loadFavorites() {
  try {
    await fs.mkdir(HISTORY_DIR, { recursive: true });
    const content = await fs.readFile(FAVORITES_FILE, 'utf-8');
    return JSON.parse(content);
  } catch {
    return [];
  }
}

/**
 * Save favorites to disk
 * @param {Array} favorites - Favorites array to save
 */
export async function saveFavorites(favorites) {
  await fs.mkdir(HISTORY_DIR, { recursive: true });
  await fs.writeFile(FAVORITES_FILE, JSON.stringify(favorites, null, 2));
}

/**
 * Add a new favorite
 * @param {string} name - Display name for the favorite
 * @param {string} command - The command to save
 * @param {string} description - Description of what it does
 * @param {Array<string>} tags - Optional tags for searching
 * @returns {Promise<Object>} Result object
 */
export async function addFavorite(name, command, description = '', tags = []) {
  const favorites = await loadFavorites();

  // Check for duplicate
  const exists = favorites.some(f => f.command === command);
  if (exists) {
    return { success: false, message: 'Already in favorites' };
  }

  favorites.push({
    id: Date.now(),
    name: name || description.substring(0, 30),
    command,
    description,
    tags,
    createdAt: new Date().toISOString(),
    usageCount: 0
  });

  await saveFavorites(favorites);
  return { success: true, message: 'Added to favorites' };
}

/**
 * Remove a favorite by identifier (index or name)
 * @param {string|number} identifier - Index (1-based) or name/command fragment
 * @returns {Promise<Object>} Result object
 */
export async function removeFavorite(identifier) {
  const favorites = await loadFavorites();

  let index = -1;

  // Try by index first
  if (typeof identifier === 'number' || /^\d+$/.test(identifier)) {
    index = parseInt(identifier) - 1;
  } else {
    // Try by name/command
    index = favorites.findIndex(f =>
      f.name.toLowerCase().includes(identifier.toLowerCase()) ||
      f.command.toLowerCase().includes(identifier.toLowerCase())
    );
  }

  if (index >= 0 && index < favorites.length) {
    const removed = favorites.splice(index, 1)[0];
    await saveFavorites(favorites);
    return { success: true, removed };
  }

  return { success: false, message: 'Favorite not found' };
}

/**
 * Get a favorite by identifier (index or name)
 * @param {string|number} identifier - Index (1-based) or name/command fragment
 * @returns {Promise<Object|null>} Favorite object or null
 */
export async function getFavorite(identifier) {
  const favorites = await loadFavorites();

  // Try by index
  if (typeof identifier === 'number' || /^\d+$/.test(identifier)) {
    return favorites[parseInt(identifier) - 1] || null;
  }

  // Try by name/command
  return favorites.find(f =>
    f.name.toLowerCase().includes(identifier.toLowerCase()) ||
    f.command.toLowerCase().includes(identifier.toLowerCase())
  ) || null;
}

/**
 * Update favorite usage count
 * @param {number} id - Favorite ID
 */
export async function updateFavoriteUsage(id) {
  const favorites = await loadFavorites();
  const favorite = favorites.find(f => f.id === id);

  if (favorite) {
    favorite.usageCount = (favorite.usageCount || 0) + 1;
    favorite.lastUsed = new Date().toISOString();
    await saveFavorites(favorites);
  }
}

/**
 * Search favorites by query
 * @param {string} query - Search query
 * @returns {Promise<Array>} Matching favorites
 */
export async function searchFavorites(query) {
  const favorites = await loadFavorites();
  const q = query.toLowerCase();

  return favorites.filter(f =>
    f.name.toLowerCase().includes(q) ||
    f.command.toLowerCase().includes(q) ||
    (f.description && f.description.toLowerCase().includes(q)) ||
    (f.tags && f.tags.some(t => t.toLowerCase().includes(q)))
  );
}

/**
 * Export favorites as JSON
 * @returns {Promise<Array>} Favorites array
 */
export async function exportFavorites() {
  return await loadFavorites();
}

/**
 * Import favorites from JSON data
 * @param {Array} data - Favorites data to import
 * @param {boolean} merge - Whether to merge with existing (true) or replace (false)
 * @returns {Promise<Object>} Import result
 */
export async function importFavorites(data, merge = true) {
  const existing = merge ? await loadFavorites() : [];

  // Filter out duplicates
  const newFavorites = data.filter(item =>
    !existing.some(e => e.command === item.command)
  );

  // Ensure each imported item has required fields
  const processedFavorites = newFavorites.map(item => ({
    id: item.id || Date.now() + Math.random(),
    name: item.name || item.description?.substring(0, 30) || 'Untitled',
    command: item.command,
    description: item.description || '',
    tags: item.tags || [],
    createdAt: item.createdAt || new Date().toISOString(),
    usageCount: item.usageCount || 0
  }));

  const merged = [...existing, ...processedFavorites];
  await saveFavorites(merged);

  return { imported: processedFavorites.length, total: merged.length };
}

/**
 * Clear all favorites
 */
export async function clearFavorites() {
  await saveFavorites([]);
}

/**
 * Get favorites stats
 * @returns {Promise<Object>} Favorites statistics
 */
export async function getFavoritesStats() {
  const favorites = await loadFavorites();

  if (favorites.length === 0) {
    return { total: 0, mostUsed: null, totalUsage: 0 };
  }

  const mostUsed = favorites.reduce((max, f) =>
    (f.usageCount || 0) > (max.usageCount || 0) ? f : max
  , favorites[0]);

  const totalUsage = favorites.reduce((sum, f) => sum + (f.usageCount || 0), 0);

  return {
    total: favorites.length,
    mostUsed: mostUsed.name,
    totalUsage
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Exports
// ─────────────────────────────────────────────────────────────────────────────

export default {
  // History
  addToHistory,
  loadHistory,
  saveHistory,
  clearHistory,
  searchHistory,
  getHistoryItem,
  getHistoryStats,
  // Favorites
  loadFavorites,
  saveFavorites,
  addFavorite,
  removeFavorite,
  getFavorite,
  updateFavoriteUsage,
  searchFavorites,
  exportFavorites,
  importFavorites,
  clearFavorites,
  getFavoritesStats
};
