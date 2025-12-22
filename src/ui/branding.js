// ═══════════════════════════════════════════════════════════════════════════════
// VIBECODE CLI - Branding & ASCII Art
// ═══════════════════════════════════════════════════════════════════════════════

import chalk from 'chalk';
import { VERSION } from '../config/constants.js';

export const LOGO = `
██╗   ██╗██╗██████╗ ███████╗ ██████╗ ██████╗ ██████╗ ███████╗
██║   ██║██║██╔══██╗██╔════╝██╔════╝██╔═══██╗██╔══██╗██╔════╝
██║   ██║██║██████╔╝█████╗  ██║     ██║   ██║██║  ██║█████╗
╚██╗ ██╔╝██║██╔══██╗██╔══╝  ██║     ██║   ██║██║  ██║██╔══╝
 ╚████╔╝ ██║██████╔╝███████╗╚██████╗╚██████╔╝██████╔╝███████╗
  ╚═══╝  ╚═╝╚═════╝ ╚══════╝ ╚═════╝ ╚═════╝ ╚═════╝ ╚══════╝
`;

export function printLogo() {
  console.log(chalk.cyan(LOGO));
  console.log(chalk.gray.italic('                    "Build with Discipline"'));
  console.log(chalk.gray(`                        Version ${VERSION}`));
  console.log();
}

export function printWelcome() {
  printLogo();
  console.log(chalk.cyan('🏗️  Chào mừng! Tôi là Kiến trúc sư của bạn.'));
  console.log();
  console.log(chalk.white('    Tôi đã thiết kế hàng triệu sản phẩm số.'));
  console.log(chalk.white('    Tôi sẽ dẫn dắt bạn qua từng bước.'));
  console.log(chalk.white('    Bạn chỉ cần cho tôi biết MỤC TIÊU.'));
  console.log();
}

export function printDivider() {
  console.log(chalk.gray('─'.repeat(70)));
}
