// ═══════════════════════════════════════════════════════════════════════════════
// VIBECODE CLI - Desktop Notifications Utility
// Phase M7: Cross-platform notification support
// ═══════════════════════════════════════════════════════════════════════════════

import { execSync, exec } from 'child_process';
import { platform } from 'os';
import path from 'path';

// ─────────────────────────────────────────────────────────────────────────────
// Configuration
// ─────────────────────────────────────────────────────────────────────────────

const NOTIFICATION_TYPES = {
  success: { icon: '✅', sound: true },
  error: { icon: '❌', sound: true },
  warning: { icon: '⚠️', sound: false },
  info: { icon: 'ℹ️', sound: false },
  build: { icon: '🏗️', sound: true },
  deploy: { icon: '🚀', sound: true },
  test: { icon: '🧪', sound: true },
  watch: { icon: '👁️', sound: false }
};

const APP_NAME = 'Vibecode';

// ─────────────────────────────────────────────────────────────────────────────
// Platform Detection
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Get current platform
 * @returns {'macos'|'linux'|'windows'|'unknown'}
 */
function getPlatform() {
  const p = platform();
  if (p === 'darwin') return 'macos';
  if (p === 'linux') return 'linux';
  if (p === 'win32') return 'windows';
  return 'unknown';
}

/**
 * Check if notifications are supported on current platform
 * @returns {boolean}
 */
export function isNotificationSupported() {
  const p = getPlatform();

  if (p === 'macos') {
    return true; // AppleScript always available
  }

  if (p === 'linux') {
    try {
      execSync('which notify-send', { stdio: 'ignore' });
      return true;
    } catch {
      return false;
    }
  }

  if (p === 'windows') {
    return true; // PowerShell always available
  }

  return false;
}

// ─────────────────────────────────────────────────────────────────────────────
// Platform-Specific Implementations
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Send notification on macOS using AppleScript
 */
function notifyMacOS(title, message, options = {}) {
  const { sound = false, subtitle = '' } = options;

  // Escape special characters for AppleScript
  const escapeAS = (str) => str.replace(/"/g, '\\"').replace(/\\/g, '\\\\');

  let script = `display notification "${escapeAS(message)}" with title "${escapeAS(title)}"`;

  if (subtitle) {
    script += ` subtitle "${escapeAS(subtitle)}"`;
  }

  if (sound) {
    script += ' sound name "Glass"';
  }

  try {
    execSync(`osascript -e '${script}'`, { stdio: 'ignore' });
    return true;
  } catch (err) {
    return false;
  }
}

/**
 * Send notification on Linux using notify-send
 */
function notifyLinux(title, message, options = {}) {
  const { icon = 'dialog-information', urgency = 'normal', timeout = 5000 } = options;

  // Escape special characters for shell
  const escapeShell = (str) => str.replace(/'/g, "'\\''");

  const args = [
    `'${escapeShell(title)}'`,
    `'${escapeShell(message)}'`,
    `--urgency=${urgency}`,
    `-t ${timeout}`,
    `-i ${icon}`
  ];

  try {
    execSync(`notify-send ${args.join(' ')}`, { stdio: 'ignore' });
    return true;
  } catch (err) {
    return false;
  }
}

/**
 * Send notification on Windows using PowerShell
 */
function notifyWindows(title, message, options = {}) {
  const { icon = 'Information' } = options;

  // Escape special characters for PowerShell
  const escapePS = (str) => str.replace(/'/g, "''").replace(/`/g, '``');

  const script = `
    [Windows.UI.Notifications.ToastNotificationManager, Windows.UI.Notifications, ContentType = WindowsRuntime] | Out-Null
    [Windows.Data.Xml.Dom.XmlDocument, Windows.Data.Xml.Dom.XmlDocument, ContentType = WindowsRuntime] | Out-Null

    $template = @"
    <toast>
      <visual>
        <binding template="ToastText02">
          <text id="1">${escapePS(title)}</text>
          <text id="2">${escapePS(message)}</text>
        </binding>
      </visual>
    </toast>
"@

    $xml = New-Object Windows.Data.Xml.Dom.XmlDocument
    $xml.LoadXml($template)
    $toast = [Windows.UI.Notifications.ToastNotification]::new($xml)
    [Windows.UI.Notifications.ToastNotificationManager]::CreateToastNotifier("${APP_NAME}").Show($toast)
  `;

  try {
    // Use simpler balloon notification as fallback
    const simpleScript = `
      Add-Type -AssemblyName System.Windows.Forms
      $balloon = New-Object System.Windows.Forms.NotifyIcon
      $balloon.Icon = [System.Drawing.SystemIcons]::${icon}
      $balloon.BalloonTipIcon = [System.Windows.Forms.ToolTipIcon]::${icon}
      $balloon.BalloonTipTitle = '${escapePS(title)}'
      $balloon.BalloonTipText = '${escapePS(message)}'
      $balloon.Visible = $true
      $balloon.ShowBalloonTip(5000)
      Start-Sleep -Seconds 1
      $balloon.Dispose()
    `;

    exec(`powershell -Command "${simpleScript.replace(/\n/g, '; ')}"`, { stdio: 'ignore' });
    return true;
  } catch (err) {
    return false;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Main Notification Function
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Send a desktop notification
 * @param {string} message - Notification message
 * @param {string} type - Notification type (success, error, warning, info, build, deploy, test, watch)
 * @param {Object} options - Additional options
 * @param {string} options.title - Custom title (default: "Vibecode")
 * @param {string} options.subtitle - Subtitle (macOS only)
 * @param {boolean} options.sound - Play sound
 * @returns {boolean} - Whether notification was sent successfully
 */
export function notify(message, type = 'info', options = {}) {
  const config = NOTIFICATION_TYPES[type] || NOTIFICATION_TYPES.info;
  const title = options.title || `${config.icon} ${APP_NAME}`;
  const sound = options.sound !== undefined ? options.sound : config.sound;

  const p = getPlatform();

  switch (p) {
    case 'macos':
      return notifyMacOS(title, message, { ...options, sound });
    case 'linux':
      return notifyLinux(title, message, options);
    case 'windows':
      return notifyWindows(title, message, options);
    default:
      return false;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Convenience Functions
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Notify build completion
 * @param {boolean} success - Whether build succeeded
 * @param {string} projectName - Project name
 * @param {Object} options - Additional options
 */
export function notifyBuildComplete(success, projectName = 'Project', options = {}) {
  const message = success
    ? `${projectName} built successfully!`
    : `${projectName} build failed`;

  return notify(message, success ? 'success' : 'error', {
    title: '🏗️ Build Complete',
    subtitle: projectName,
    ...options
  });
}

/**
 * Notify deploy completion
 * @param {boolean} success - Whether deploy succeeded
 * @param {string} platform - Deploy platform (vercel, netlify, etc.)
 * @param {string} url - Deployment URL
 */
export function notifyDeployComplete(success, platform = 'Cloud', url = '') {
  const message = success
    ? `Deployed to ${platform}!${url ? ` ${url}` : ''}`
    : `Deploy to ${platform} failed`;

  return notify(message, success ? 'deploy' : 'error', {
    title: '🚀 Deploy Complete',
    subtitle: platform
  });
}

/**
 * Notify file change detected (watch mode)
 * @param {string} filePath - Changed file path
 * @param {string} event - Event type (change, add, unlink)
 */
export function notifyWatchChange(filePath, event = 'change') {
  const fileName = path.basename(filePath);
  const eventIcons = {
    change: '📝',
    add: '➕',
    unlink: '🗑️'
  };
  const icon = eventIcons[event] || '👁️';

  return notify(`${icon} ${fileName}`, 'watch', {
    title: '👁️ File Changed',
    subtitle: event,
    sound: false
  });
}

/**
 * Notify test completion
 * @param {boolean} success - Whether tests passed
 * @param {number} passed - Number of passed tests
 * @param {number} failed - Number of failed tests
 */
export function notifyTestComplete(success, passed = 0, failed = 0) {
  const message = success
    ? `All ${passed} tests passed!`
    : `${failed} test${failed > 1 ? 's' : ''} failed, ${passed} passed`;

  return notify(message, success ? 'success' : 'error', {
    title: '🧪 Tests Complete'
  });
}

/**
 * Notify error occurred
 * @param {string} message - Error message
 * @param {string} context - Error context
 */
export function notifyError(message, context = '') {
  return notify(message, 'error', {
    title: '❌ Error',
    subtitle: context
  });
}

/**
 * Notify success
 * @param {string} message - Success message
 * @param {string} context - Success context
 */
export function notifySuccess(message, context = '') {
  return notify(message, 'success', {
    title: '✅ Success',
    subtitle: context
  });
}

/**
 * Notify agent module completion
 * @param {number} moduleNum - Module number
 * @param {number} total - Total modules
 * @param {boolean} success - Whether module succeeded
 */
export function notifyAgentProgress(moduleNum, total, success = true) {
  const message = success
    ? `Module ${moduleNum}/${total} completed`
    : `Module ${moduleNum}/${total} failed`;

  return notify(message, success ? 'info' : 'warning', {
    title: '🤖 Agent Mode',
    subtitle: `Progress: ${Math.round((moduleNum / total) * 100)}%`
  });
}

// ─────────────────────────────────────════════════════════════════════════════
// Exports
// ─────────────────────────────════════════════════════════════════════════════

export default {
  notify,
  notifyBuildComplete,
  notifyDeployComplete,
  notifyWatchChange,
  notifyTestComplete,
  notifyError,
  notifySuccess,
  notifyAgentProgress,
  isNotificationSupported,
  getPlatform
};
