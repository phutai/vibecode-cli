// ═══════════════════════════════════════════════════════════════════════════════
// VIBECODE CLI - Security Command
// Phase K5: AI Security Audit
// ═══════════════════════════════════════════════════════════════════════════════

import { spawn, exec } from 'child_process';
import { promisify } from 'util';
import fs from 'fs/promises';
import path from 'path';
import chalk from 'chalk';

const execAsync = promisify(exec);

export async function securityCommand(options = {}) {
  const cwd = process.cwd();

  console.log(chalk.cyan(`
╭────────────────────────────────────────────────────────────────────╮
│  🔒 SECURITY AUDIT                                                 │
│                                                                    │
│  Scanning for vulnerabilities...                                  │
│                                                                    │
╰────────────────────────────────────────────────────────────────────╯
  `));

  const results = {
    npmAudit: null,
    secretsScan: [],
    timestamp: new Date().toISOString()
  };

  // 1. Run npm audit
  console.log(chalk.gray('\n  [1/3] Running npm audit...\n'));
  try {
    const { stdout } = await execAsync('npm audit --json', { cwd, timeout: 60000 });
    results.npmAudit = JSON.parse(stdout);
    console.log(chalk.green('    ✓ npm audit complete'));
  } catch (error) {
    try {
      if (error.stdout) {
        results.npmAudit = JSON.parse(error.stdout);
        const vulns = results.npmAudit?.metadata?.vulnerabilities;
        if (vulns) {
          const total = vulns.critical + vulns.high + vulns.moderate + vulns.low;
          if (total > 0) {
            console.log(chalk.yellow(`    ⚠ Found ${total} vulnerabilities`));
          } else {
            console.log(chalk.green('    ✓ No vulnerabilities found'));
          }
        }
      }
    } catch {
      results.npmAudit = { error: 'npm audit failed or not applicable' };
      console.log(chalk.gray('    - npm audit not applicable'));
    }
  }

  // 2. Scan for secrets
  console.log(chalk.gray('\n  [2/3] Scanning for exposed secrets...\n'));
  results.secretsScan = await scanForSecrets(cwd);
  if (results.secretsScan.length > 0) {
    console.log(chalk.red(`    ⚠ Found ${results.secretsScan.length} potential secrets!`));
    for (const secret of results.secretsScan.slice(0, 5)) {
      console.log(chalk.gray(`      - ${secret.file}: ${secret.type}`));
    }
  } else {
    console.log(chalk.green('    ✓ No exposed secrets detected'));
  }

  // 3. AI security analysis
  console.log(chalk.gray('\n  [3/3] AI security analysis...\n'));

  const vulnSummary = results.npmAudit?.metadata?.vulnerabilities;
  const npmSummary = vulnSummary
    ? `Critical: ${vulnSummary.critical}, High: ${vulnSummary.high}, Moderate: ${vulnSummary.moderate}, Low: ${vulnSummary.low}`
    : 'npm audit not available';

  const prompt = `
# Security Audit Request

## Project: ${path.basename(cwd)}

## NPM Audit Results:
${npmSummary}

## Potential Secrets Found:
${results.secretsScan.map(s => `- ${s.file}: ${s.type}`).join('\n') || 'None detected'}

## Security Analysis Required:
Analyze the codebase for security vulnerabilities:

1. **Authentication Issues**
   - Weak password handling
   - Missing auth checks on protected routes
   - Insecure session management
   - JWT vulnerabilities

2. **Input Validation**
   - SQL injection risks
   - XSS vulnerabilities
   - Command injection
   - Path traversal
   - ReDoS (regex denial of service)

3. **Data Exposure**
   - Sensitive data in logs
   - Exposed API keys in code
   - Insecure data storage
   - PII handling issues

4. **Configuration Issues**
   - CORS misconfiguration
   - Missing security headers
   - Debug mode in production
   - Insecure defaults

5. **Dependencies**
   - Known vulnerable packages
   - Outdated dependencies
   - Unnecessary dependencies

## Output Format:
For each vulnerability found:
- **Severity**: Critical / High / Medium / Low
- **Category**: Auth / Injection / Exposure / Config / Dependency
- **Location**: File and line number
- **Description**: What's the issue
- **Remediation**: How to fix it

End with a security score (A-F) and priority fixes.
`;

  const promptFile = path.join(cwd, '.vibecode', 'security-prompt.md');
  await fs.mkdir(path.dirname(promptFile), { recursive: true });
  await fs.writeFile(promptFile, prompt);

  await runClaudeCode(prompt, cwd);

  // Save report
  const reportPath = path.join(cwd, '.vibecode', 'reports', `security-${Date.now()}.json`);
  await fs.mkdir(path.dirname(reportPath), { recursive: true });
  await fs.writeFile(reportPath, JSON.stringify(results, null, 2));

  console.log(chalk.green('\n✅ Security audit complete!'));
  console.log(chalk.gray(`  Report saved to: .vibecode/reports/\n`));

  // Auto-fix option
  if (options.fix) {
    console.log(chalk.yellow('\n  Attempting auto-fix...\n'));
    try {
      await execAsync('npm audit fix', { cwd });
      console.log(chalk.green('  ✓ npm audit fix completed\n'));
    } catch {
      console.log(chalk.gray('  - npm audit fix not applicable\n'));
    }
  }
}

async function scanForSecrets(cwd) {
  const secrets = [];
  const patterns = [
    { regex: /(['"])?(api[_-]?key|apikey)(['"])?\s*[:=]\s*(['"])[a-zA-Z0-9]{20,}(['"])/gi, type: 'API Key' },
    { regex: /(['"])?(secret|password|passwd|pwd)(['"])?\s*[:=]\s*(['"])[^'"]{8,}(['"])/gi, type: 'Password/Secret' },
    { regex: /(['"])?(aws[_-]?access[_-]?key[_-]?id)(['"])?\s*[:=]\s*(['"])[A-Z0-9]{20}(['"])/gi, type: 'AWS Access Key' },
    { regex: /(['"])?(aws[_-]?secret)(['"])?\s*[:=]\s*(['"])[a-zA-Z0-9/+=]{40}(['"])/gi, type: 'AWS Secret Key' },
    { regex: /(['"])?(private[_-]?key)(['"])?\s*[:=]\s*(['"])-----BEGIN/gi, type: 'Private Key' },
    { regex: /(['"])?(auth[_-]?token|bearer)(['"])?\s*[:=]\s*(['"])[a-zA-Z0-9._-]{20,}(['"])/gi, type: 'Auth Token' },
    { regex: /(['"])?(github[_-]?token)(['"])?\s*[:=]\s*(['"])gh[ps]_[a-zA-Z0-9]{36}(['"])/gi, type: 'GitHub Token' },
    { regex: /(['"])?(stripe[_-]?key)(['"])?\s*[:=]\s*(['"])sk_[a-zA-Z0-9]{24,}(['"])/gi, type: 'Stripe Key' }
  ];

  const files = await getAllSourceFiles(cwd);

  for (const file of files) {
    try {
      const content = await fs.readFile(path.join(cwd, file), 'utf-8');

      for (const { regex, type } of patterns) {
        regex.lastIndex = 0; // Reset regex state
        if (regex.test(content)) {
          secrets.push({ file, type });
          break; // One type per file is enough
        }
      }
    } catch {}
  }

  return secrets;
}

async function getAllSourceFiles(cwd) {
  const files = [];
  const extensions = ['.js', '.ts', '.jsx', '.tsx', '.json', '.env', '.yaml', '.yml', '.py', '.go'];
  const ignoreDirs = ['node_modules', '.git', 'dist', 'build', '.next', 'coverage'];

  async function scan(dir) {
    try {
      const entries = await fs.readdir(dir, { withFileTypes: true });

      for (const entry of entries) {
        if (entry.name.startsWith('.') && entry.name !== '.env') continue;
        if (ignoreDirs.includes(entry.name)) continue;

        const fullPath = path.join(dir, entry.name);

        if (entry.isDirectory()) {
          await scan(fullPath);
        } else if (extensions.some(ext => entry.name.endsWith(ext))) {
          files.push(path.relative(cwd, fullPath));
        }
      }
    } catch {}
  }

  await scan(cwd);
  return files.slice(0, 100);
}

async function runClaudeCode(prompt, cwd) {
  return new Promise((resolve) => {
    const child = spawn('claude', ['-p', prompt, '--dangerously-skip-permissions'], {
      cwd,
      stdio: 'inherit'
    });

    child.on('close', resolve);
    child.on('error', () => resolve());
  });
}
