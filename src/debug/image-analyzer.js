/**
 * Image Analyzer for Vibecode CLI
 * Analyze screenshots of errors using AI vision
 */

import chalk from 'chalk';
import fs from 'fs/promises';
import path from 'path';
import { spawn } from 'child_process';
import { imageToBase64, saveClipboardImage, formatFileSize } from '../utils/image.js';

/**
 * ImageAnalyzer class for screenshot error analysis
 */
export class ImageAnalyzer {
  constructor(projectPath = process.cwd()) {
    this.projectPath = projectPath;
  }

  /**
   * Analyze image file for errors
   */
  async analyzeImage(imagePath) {
    console.log(chalk.cyan('\n  Analyzing screenshot...\n'));

    try {
      // Read and validate image
      const imageInfo = await imageToBase64(imagePath);

      console.log(chalk.gray(`  File: ${path.basename(imageInfo.path)}`));
      console.log(chalk.gray(`  Size: ${formatFileSize(imageInfo.size)}\n`));

      // Run AI analysis
      const analysis = await this.runImageAnalysis(imageInfo);

      return analysis;
    } catch (error) {
      throw new Error(`Failed to analyze image: ${error.message}`);
    }
  }

  /**
   * Analyze image from clipboard
   */
  async analyzeClipboard() {
    console.log(chalk.cyan('\n  Getting image from clipboard...\n'));

    try {
      const tempFile = await saveClipboardImage();
      console.log(chalk.green(`  Image captured\n`));

      const result = await this.analyzeImage(tempFile);

      // Cleanup temp file
      try {
        await fs.unlink(tempFile);
      } catch {
        // Ignore cleanup errors
      }

      return result;
    } catch (error) {
      throw new Error(`Clipboard error: ${error.message}`);
    }
  }

  /**
   * Run AI analysis on image
   */
  async runImageAnalysis(imageInfo) {
    // Create analysis prompt
    const prompt = this.buildAnalysisPrompt(imageInfo);

    // Save prompt to temp file
    const tempDir = path.join(this.projectPath, '.vibecode', 'debug');
    await fs.mkdir(tempDir, { recursive: true });

    const promptFile = path.join(tempDir, 'image-analysis.md');
    await fs.writeFile(promptFile, prompt);

    // Also save image reference
    const imageRef = path.join(tempDir, 'screenshot-ref.txt');
    await fs.writeFile(imageRef, imageInfo.path);

    // Run Claude Code with image
    const result = await this.runClaudeWithImage(imageInfo, promptFile);

    return this.parseAnalysisResult(result);
  }

  /**
   * Build analysis prompt
   */
  buildAnalysisPrompt(imageInfo) {
    return `# Screenshot Error Analysis

Analyze this screenshot and extract any error information.

## Instructions
1. Look for error messages, stack traces, console errors, or warnings
2. Identify the error type (TypeError, SyntaxError, Build Error, etc.)
3. Extract file names and line numbers if visible
4. Note any relevant context visible in the screenshot
5. Provide specific fix suggestions

## Response Format
Respond in this exact format:

**Error Type**: [type of error or "None detected"]
**Error Message**: [main error text]
**Location**: [file:line if visible]
**Root Cause**: [explanation of what's wrong]
**Suggested Fix**: [how to fix it]
**Confidence**: [High/Medium/Low]

If no error is visible, respond with:
**Error Type**: None detected
**Error Message**: No error visible in screenshot
`;
  }

  /**
   * Run Claude Code with image input
   */
  async runClaudeWithImage(imageInfo, promptFile) {
    return new Promise((resolve) => {
      let output = '';
      let errorOutput = '';

      // Use claude with image path
      // Claude Code can read images directly
      const args = [
        '--print',
        '-p', `Analyze this image for errors: ${imageInfo.path}

Look for:
- Error messages
- Stack traces
- Console errors
- Type errors
- Build failures

Respond with:
**Error Type**:
**Error Message**:
**Location**:
**Root Cause**:
**Suggested Fix**:
**Confidence**:

If no error found, say "No error detected"`
      ];

      const child = spawn('claude', args, {
        cwd: this.projectPath,
        stdio: ['pipe', 'pipe', 'pipe']
      });

      child.stdout.on('data', (data) => {
        output += data.toString();
      });

      child.stderr.on('data', (data) => {
        errorOutput += data.toString();
      });

      child.on('close', (code) => {
        resolve({
          success: code === 0,
          output: output.trim(),
          error: errorOutput.trim()
        });
      });

      child.on('error', (error) => {
        resolve({
          success: false,
          output: '',
          error: error.message
        });
      });

      // Timeout after 60 seconds
      setTimeout(() => {
        child.kill();
        resolve({
          success: false,
          output: '',
          error: 'Analysis timed out'
        });
      }, 60000);
    });
  }

  /**
   * Parse AI analysis result
   */
  parseAnalysisResult(result) {
    const analysis = {
      errorType: null,
      errorMessage: null,
      location: null,
      rootCause: null,
      suggestedFix: null,
      confidence: 'Low',
      raw: result?.output || '',
      success: result?.success || false
    };

    const output = result?.output || '';

    // Extract fields using regex
    const patterns = {
      errorType: /\*\*Error Type\*\*:\s*(.+?)(?:\n|$)/i,
      errorMessage: /\*\*Error Message\*\*:\s*(.+?)(?:\n|$)/i,
      location: /\*\*Location\*\*:\s*(.+?)(?:\n|$)/i,
      rootCause: /\*\*Root Cause\*\*:\s*(.+?)(?:\n|$)/i,
      suggestedFix: /\*\*Suggested Fix\*\*:\s*(.+?)(?:\n|$)/i,
      confidence: /\*\*Confidence\*\*:\s*(.+?)(?:\n|$)/i
    };

    for (const [key, pattern] of Object.entries(patterns)) {
      const match = output.match(pattern);
      if (match && match[1]) {
        const value = match[1].trim();
        if (value && value.toLowerCase() !== 'none' && value.toLowerCase() !== 'n/a') {
          analysis[key] = value;
        }
      }
    }

    // Check if error was actually detected
    if (analysis.errorType?.toLowerCase().includes('none detected') ||
        analysis.errorMessage?.toLowerCase().includes('no error')) {
      analysis.errorType = null;
      analysis.errorMessage = null;
    }

    return analysis;
  }

  /**
   * Format analysis for display
   */
  formatAnalysis(analysis) {
    // No error case
    if (!analysis.errorType && !analysis.errorMessage) {
      return chalk.yellow('\n  No error detected in screenshot.\n');
    }

    let output = chalk.cyan(`
+----------------------------------------------------------------------+
|  SCREENSHOT ANALYSIS                                                 |
+----------------------------------------------------------------------+
`);

    if (analysis.errorType) {
      output += `\n  ${chalk.white('Error Type:')} ${chalk.red(analysis.errorType)}`;
    }

    if (analysis.errorMessage) {
      output += `\n  ${chalk.white('Message:')}    ${chalk.yellow(analysis.errorMessage)}`;
    }

    if (analysis.location) {
      output += `\n  ${chalk.white('Location:')}   ${chalk.gray(analysis.location)}`;
    }

    if (analysis.confidence) {
      const confColor = analysis.confidence === 'High' ? chalk.green :
                        analysis.confidence === 'Medium' ? chalk.yellow : chalk.gray;
      output += `\n  ${chalk.white('Confidence:')} ${confColor(analysis.confidence)}`;
    }

    if (analysis.rootCause) {
      output += `\n\n  ${chalk.cyan('Root Cause:')}`;
      output += `\n  ${chalk.gray(analysis.rootCause)}`;
    }

    if (analysis.suggestedFix) {
      output += `\n\n  ${chalk.green('Suggested Fix:')}`;
      output += `\n  ${chalk.white(analysis.suggestedFix)}`;
    }

    output += '\n';

    return output;
  }
}

/**
 * Helper function for direct use
 */
export async function analyzeScreenshot(imagePathOrClipboard, options = {}) {
  const analyzer = new ImageAnalyzer(options.projectPath || process.cwd());

  if (imagePathOrClipboard === 'clipboard') {
    return await analyzer.analyzeClipboard();
  } else {
    return await analyzer.analyzeImage(imagePathOrClipboard);
  }
}

export default ImageAnalyzer;
