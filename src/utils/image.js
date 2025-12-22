/**
 * Image utilities for Vibecode CLI
 * Handle clipboard images, file reading, and base64 conversion
 */

import fs from 'fs/promises';
import path from 'path';
import { exec } from 'child_process';
import { promisify } from 'util';
import os from 'os';

const execAsync = promisify(exec);

/**
 * Save clipboard image to temp file
 * Supports macOS, Linux, and Windows
 */
export async function saveClipboardImage() {
  const platform = process.platform;
  const tempDir = os.tmpdir();
  const tempFile = path.join(tempDir, `vibecode-screenshot-${Date.now()}.png`);

  if (platform === 'darwin') {
    // macOS: Use pngpaste or osascript
    try {
      // Try pngpaste first (if installed via brew install pngpaste)
      await execAsync(`pngpaste "${tempFile}"`);

      // Verify file was created
      const stats = await fs.stat(tempFile);
      if (stats.size > 0) {
        return tempFile;
      }
      throw new Error('Empty file');
    } catch {
      // Fallback to osascript
      try {
        const script = `
          set theFile to POSIX file "${tempFile}"
          try
            set imageData to the clipboard as «class PNGf»
            set fileRef to open for access theFile with write permission
            write imageData to fileRef
            close access fileRef
            return "success"
          on error errMsg
            return "error: " & errMsg
          end try
        `;

        const { stdout } = await execAsync(`osascript -e '${script.replace(/'/g, "'\\''")}'`);

        if (stdout.trim().startsWith('success')) {
          // Verify file was created
          const stats = await fs.stat(tempFile);
          if (stats.size > 0) {
            return tempFile;
          }
        }

        throw new Error('No image in clipboard');
      } catch (e) {
        throw new Error('No image in clipboard. Copy a screenshot first (Cmd+Shift+4).');
      }
    }
  } else if (platform === 'linux') {
    // Linux: Use xclip
    try {
      await execAsync(`xclip -selection clipboard -t image/png -o > "${tempFile}" 2>/dev/null`);

      const stats = await fs.stat(tempFile);
      if (stats.size > 0) {
        return tempFile;
      }
      throw new Error('No image in clipboard');
    } catch {
      throw new Error('No image in clipboard. Make sure xclip is installed: sudo apt install xclip');
    }
  } else if (platform === 'win32') {
    // Windows: Use PowerShell
    try {
      const psScript = `
        Add-Type -AssemblyName System.Windows.Forms
        $img = [System.Windows.Forms.Clipboard]::GetImage()
        if ($img -ne $null) {
          $img.Save('${tempFile.replace(/\\/g, '\\\\')}', [System.Drawing.Imaging.ImageFormat]::Png)
          Write-Output 'success'
        } else {
          Write-Output 'no image'
        }
      `.replace(/\n/g, ' ');

      const { stdout } = await execAsync(`powershell -Command "${psScript}"`);

      if (stdout.trim() === 'success') {
        return tempFile;
      }
      throw new Error('No image in clipboard');
    } catch {
      throw new Error('No image in clipboard');
    }
  }

  throw new Error(`Unsupported platform: ${platform}`);
}

/**
 * Read image file and convert to base64
 */
export async function imageToBase64(imagePath) {
  const absolutePath = path.resolve(imagePath);

  // Check file exists
  try {
    await fs.access(absolutePath);
  } catch {
    throw new Error(`Image file not found: ${imagePath}`);
  }

  // Read file
  const imageBuffer = await fs.readFile(absolutePath);
  const base64 = imageBuffer.toString('base64');

  // Detect mime type from extension
  const ext = path.extname(absolutePath).toLowerCase();
  const mimeTypes = {
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.gif': 'image/gif',
    '.webp': 'image/webp',
    '.bmp': 'image/bmp'
  };
  const mimeType = mimeTypes[ext] || 'image/png';

  return {
    base64,
    mimeType,
    dataUrl: `data:${mimeType};base64,${base64}`,
    path: absolutePath,
    size: imageBuffer.length
  };
}

/**
 * Get image information
 */
export async function getImageInfo(imagePath) {
  const info = await imageToBase64(imagePath);
  const stats = await fs.stat(imagePath);

  return {
    ...info,
    fileSize: stats.size,
    fileName: path.basename(imagePath),
    extension: path.extname(imagePath).toLowerCase()
  };
}

/**
 * Check if file is a valid image
 */
export async function isValidImage(imagePath) {
  const validExtensions = ['.png', '.jpg', '.jpeg', '.gif', '.webp', '.bmp'];
  const ext = path.extname(imagePath).toLowerCase();

  if (!validExtensions.includes(ext)) {
    return false;
  }

  try {
    await fs.access(imagePath);
    const stats = await fs.stat(imagePath);
    return stats.size > 0;
  } catch {
    return false;
  }
}

/**
 * Cleanup temporary vibecode images
 */
export async function cleanupTempImages() {
  const tempDir = os.tmpdir();

  try {
    const files = await fs.readdir(tempDir);
    const vibecodeImages = files.filter(f => f.startsWith('vibecode-screenshot-'));

    let cleaned = 0;
    for (const file of vibecodeImages) {
      try {
        await fs.unlink(path.join(tempDir, file));
        cleaned++;
      } catch {
        // Ignore errors
      }
    }

    return cleaned;
  } catch {
    return 0;
  }
}

/**
 * Format file size for display
 */
export function formatFileSize(bytes) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export default {
  saveClipboardImage,
  imageToBase64,
  getImageInfo,
  isValidImage,
  cleanupTempImages,
  formatFileSize
};
