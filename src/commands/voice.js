// ═══════════════════════════════════════════════════════════════════════════════
// VIBECODE CLI - Voice Command
// Voice-controlled commands - hands-free coding
// ═══════════════════════════════════════════════════════════════════════════════

import { spawn, exec } from 'child_process';
import { promisify } from 'util';
import fs from 'fs/promises';
import path from 'path';
import chalk from 'chalk';
import inquirer from 'inquirer';
import readline from 'readline';

const execAsync = promisify(exec);

// Voice recognition methods
const VOICE_METHODS = {
  macos: {
    name: 'macOS Dictation',
    available: process.platform === 'darwin',
    description: 'Built-in macOS speech recognition'
  },
  whisper: {
    name: 'OpenAI Whisper',
    available: true,
    description: 'Cloud-based speech recognition (requires API key)'
  },
  text: {
    name: 'Text Input',
    available: true,
    description: 'Type commands as fallback'
  }
};

/**
 * Voice command entry point
 */
export async function voiceCommand(subcommand, options = {}) {
  console.log(chalk.cyan(`
╭────────────────────────────────────────────────────────────────────╮
│  🎤 VIBECODE VOICE MODE                                            │
│                                                                    │
│  Speak your commands - hands-free coding!                          │
│                                                                    │
╰────────────────────────────────────────────────────────────────────╯
  `));

  // Check available methods
  const method = await selectVoiceMethod(options);
  if (!method) return;

  // If subcommand specified, do one-shot
  if (subcommand) {
    return oneShotVoice(subcommand, method, options);
  }

  // Interactive voice mode
  return interactiveVoice(method, options);
}

/**
 * Select voice recognition method
 */
async function selectVoiceMethod(options) {
  // If specified in options
  if (options.whisper) return 'whisper';
  if (options.macos) return 'macos';
  if (options.text) return 'text';

  // Check what's available
  const available = [];

  if (process.platform === 'darwin') {
    available.push({
      name: `🍎 macOS Dictation ${chalk.gray('(Built-in, Free)')}`,
      value: 'macos'
    });
  }

  // Check for Whisper API key
  if (process.env.OPENAI_API_KEY) {
    available.push({
      name: `🤖 OpenAI Whisper ${chalk.gray('(Cloud, API Key set)')}`,
      value: 'whisper'
    });
  } else {
    available.push({
      name: `🤖 OpenAI Whisper ${chalk.yellow('(Requires OPENAI_API_KEY)')}`,
      value: 'whisper'
    });
  }

  available.push({
    name: `⌨️  Text Input ${chalk.gray('(Type commands)')}`,
    value: 'text'
  });

  if (available.length === 1) {
    return available[0].value;
  }

  const { method } = await inquirer.prompt([{
    type: 'list',
    name: 'method',
    message: 'Select input method:',
    choices: available
  }]);

  return method;
}

/**
 * One-shot voice command (e.g., vibecode voice go)
 */
async function oneShotVoice(subcommand, method, options) {
  console.log(chalk.yellow(`\n  🎤 Listening for "${subcommand}" command...\n`));

  if (method === 'text') {
    console.log(chalk.gray('  Type your description:\n'));
  } else {
    console.log(chalk.gray('  Speak now, or type as fallback. Press Enter when done.\n'));
  }

  const transcript = await listen(method, options);

  if (!transcript) {
    console.log(chalk.red('  ❌ No input detected.\n'));
    return;
  }

  console.log(chalk.green(`\n  📝 Input: "${transcript}"\n`));

  // Build command
  const fullCommand = `vibecode ${subcommand} "${transcript}"`;

  console.log(chalk.cyan(`  🚀 Command: ${fullCommand}\n`));

  if (options.auto) {
    // Auto-execute
    await executeCommand(fullCommand);
  } else {
    // Confirm first
    const { execute } = await inquirer.prompt([{
      type: 'confirm',
      name: 'execute',
      message: 'Execute this command?',
      default: true
    }]);

    if (execute) {
      await executeCommand(fullCommand);
    }
  }
}

/**
 * Interactive voice mode
 */
async function interactiveVoice(method, options) {
  console.log(chalk.white('  Voice Commands:\n'));
  console.log(chalk.gray('    • "go <description>"      Create a new project'));
  console.log(chalk.gray('    • "agent <description>"   Multi-module build'));
  console.log(chalk.gray('    • "debug"                 Debug current project'));
  console.log(chalk.gray('    • "preview"               Start preview server'));
  console.log(chalk.gray('    • "deploy"                Deploy project'));
  console.log(chalk.gray('    • "feedback"              Enter feedback mode'));
  console.log(chalk.gray('    • "help"                  Show all commands'));
  console.log(chalk.gray('    • "exit" or "quit"        Stop voice mode\n'));

  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
    prompt: chalk.magenta('🎤 voice> ')
  });

  console.log(chalk.yellow('  Press Enter to start listening, or type directly...\n'));
  rl.prompt();

  rl.on('line', async (line) => {
    const directInput = line.trim();

    let transcript;

    if (directInput) {
      // User typed something directly
      transcript = directInput;
    } else {
      // Start listening
      console.log(chalk.yellow('\n  🎤 Listening... (speak or type)\n'));
      transcript = await listen(method, { timeout: options.timeout || 10 });
    }

    if (!transcript) {
      console.log(chalk.gray('  No input detected. Try again.\n'));
      rl.prompt();
      return;
    }

    console.log(chalk.green(`  📝 Input: "${transcript}"\n`));

    // Parse command
    const command = parseVoiceCommand(transcript);

    if (command.type === 'exit') {
      console.log(chalk.cyan('\n  👋 Voice mode ended.\n'));
      rl.close();
      return;
    }

    if (command.type === 'help') {
      showVoiceHelp();
      rl.prompt();
      return;
    }

    if (command.fullCommand) {
      console.log(chalk.cyan(`  🚀 Executing: ${command.fullCommand}\n`));

      if (options.auto) {
        await executeCommand(command.fullCommand);
      } else {
        const { execute } = await inquirer.prompt([{
          type: 'confirm',
          name: 'execute',
          message: 'Execute?',
          default: true
        }]);

        if (execute) {
          await executeCommand(command.fullCommand);
        }
      }
    } else {
      console.log(chalk.yellow(`  ⚠️ Couldn't understand: "${transcript}"`));
      console.log(chalk.gray('  Try: "go <description>", "debug", "preview", etc.\n'));
    }

    console.log('');
    rl.prompt();
  });

  rl.on('close', () => {
    process.exit(0);
  });

  // Handle Ctrl+C
  process.on('SIGINT', () => {
    console.log(chalk.cyan('\n\n  👋 Voice mode ended.\n'));
    rl.close();
  });
}

/**
 * Parse voice command into executable command
 */
function parseVoiceCommand(transcript) {
  const lower = transcript.toLowerCase().trim();

  // Exit commands
  if (['exit', 'quit', 'stop', 'bye', 'goodbye', 'done'].some(w => lower === w || lower === `say ${w}`)) {
    return { type: 'exit' };
  }

  // Help
  if (lower === 'help' || lower.includes('what can you do')) {
    return { type: 'help' };
  }

  // Go command - various phrasings
  const goPatterns = [
    /^go\s+(.+)$/i,
    /^create\s+(.+)$/i,
    /^build\s+(.+)$/i,
    /^make\s+(.+)$/i,
    /^new\s+(.+)$/i,
    /^generate\s+(.+)$/i
  ];

  for (const pattern of goPatterns) {
    const match = transcript.match(pattern);
    if (match) {
      const description = match[1].trim();
      return { type: 'go', fullCommand: `vibecode go "${description}"` };
    }
  }

  // Agent command
  const agentMatch = transcript.match(/^agent\s+(.+)$/i);
  if (agentMatch) {
    const description = agentMatch[1].trim();
    return { type: 'agent', fullCommand: `vibecode agent "${description}" --new` };
  }

  // Simple commands
  const simpleCommands = {
    debug: 'vibecode debug --auto',
    status: 'vibecode status',
    preview: 'vibecode preview',
    deploy: 'vibecode deploy',
    templates: 'vibecode templates',
    template: 'vibecode templates',
    feedback: 'vibecode feedback --preview',
    images: 'vibecode images',
    doctor: 'vibecode doctor',
    undo: 'vibecode undo',
    learn: 'vibecode learn --stats'
  };

  for (const [keyword, command] of Object.entries(simpleCommands)) {
    if (lower === keyword || lower.includes(keyword)) {
      return { type: keyword, fullCommand: command };
    }
  }

  // Template with name
  const templateMatch = transcript.match(/template\s+(\w+)/i);
  if (templateMatch) {
    const templateId = templateMatch[1].toLowerCase();
    return { type: 'template', fullCommand: `vibecode go --template ${templateId}` };
  }

  // If long enough, interpret as go command
  if (lower.length > 15 && !lower.includes('vibecode')) {
    return { type: 'go', fullCommand: `vibecode go "${transcript}"` };
  }

  return { type: 'unknown' };
}

/**
 * Listen for voice input
 */
async function listen(method, options = {}) {
  const timeout = parseInt(options.timeout) || 10;

  if (method === 'text') {
    return listenText(timeout);
  } else if (method === 'macos') {
    return listenMacOS(timeout);
  } else if (method === 'whisper') {
    return listenWhisper(timeout, options);
  }

  return listenText(timeout);
}

/**
 * Text input (fallback)
 */
async function listenText(timeout) {
  return new Promise((resolve) => {
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout
    });

    let resolved = false;

    const timer = setTimeout(() => {
      if (!resolved) {
        resolved = true;
        rl.close();
        resolve(null);
      }
    }, timeout * 1000);

    rl.question(chalk.gray('  > '), (answer) => {
      if (!resolved) {
        resolved = true;
        clearTimeout(timer);
        rl.close();
        resolve(answer.trim() || null);
      }
    });
  });
}

/**
 * macOS speech recognition
 */
async function listenMacOS(timeout) {
  // Check if sox is available for recording
  try {
    await execAsync('which sox');
  } catch {
    console.log(chalk.yellow('  ⚠️ sox not installed. Using text input.'));
    console.log(chalk.gray('  Install with: brew install sox\n'));
    return listenText(timeout);
  }

  console.log(chalk.gray(`  [Recording for ${timeout} seconds...]\n`));

  const audioFile = `/tmp/vibecode-voice-${Date.now()}.wav`;

  try {
    // Record audio with sox
    await execAsync(`sox -d -r 16000 -c 1 -b 16 "${audioFile}" trim 0 ${timeout} 2>/dev/null`, {
      timeout: (timeout + 5) * 1000
    });

    // Check if we have Whisper API key for transcription
    if (process.env.OPENAI_API_KEY) {
      const transcript = await transcribeWithWhisper(audioFile, process.env.OPENAI_API_KEY);
      await fs.unlink(audioFile).catch(() => {});
      return transcript;
    } else {
      console.log(chalk.yellow('  ⚠️ No OPENAI_API_KEY for transcription.'));
      await fs.unlink(audioFile).catch(() => {});
      return listenText(timeout);
    }
  } catch (error) {
    console.log(chalk.yellow('  ⚠️ Recording failed. Using text input.'));
    await fs.unlink(audioFile).catch(() => {});
    return listenText(timeout);
  }
}

/**
 * OpenAI Whisper transcription
 */
async function listenWhisper(timeout, options) {
  const apiKey = process.env.OPENAI_API_KEY;

  if (!apiKey) {
    console.log(chalk.yellow('  ⚠️ OPENAI_API_KEY not set.'));
    console.log(chalk.gray('  Set it with: export OPENAI_API_KEY=your-key\n'));
    return listenText(timeout);
  }

  // Check for sox
  try {
    await execAsync('which sox');
  } catch {
    console.log(chalk.yellow('  ⚠️ sox not installed for audio recording.'));
    console.log(chalk.gray('  Install with: brew install sox\n'));
    return listenText(timeout);
  }

  const audioFile = `/tmp/vibecode-voice-${Date.now()}.wav`;

  console.log(chalk.gray(`  [Recording for ${timeout} seconds...]\n`));

  try {
    // Record audio
    await execAsync(`sox -d -r 16000 -c 1 -b 16 "${audioFile}" trim 0 ${timeout} 2>/dev/null`, {
      timeout: (timeout + 5) * 1000
    });

    // Transcribe with Whisper
    const transcript = await transcribeWithWhisper(audioFile, apiKey);

    // Cleanup
    await fs.unlink(audioFile).catch(() => {});

    return transcript;

  } catch (error) {
    console.log(chalk.yellow(`  ⚠️ Recording/transcription failed: ${error.message}`));
    await fs.unlink(audioFile).catch(() => {});
    return listenText(timeout);
  }
}

/**
 * Transcribe audio file with OpenAI Whisper API
 */
async function transcribeWithWhisper(audioFile, apiKey) {
  try {
    // Read audio file
    const audioBuffer = await fs.readFile(audioFile);

    // Create form data manually (avoid extra dependencies)
    const boundary = '----VibecodeFormBoundary' + Date.now();
    const fileName = path.basename(audioFile);

    const header = [
      `--${boundary}`,
      `Content-Disposition: form-data; name="file"; filename="${fileName}"`,
      'Content-Type: audio/wav',
      '',
      ''
    ].join('\r\n');

    const modelPart = [
      '',
      `--${boundary}`,
      'Content-Disposition: form-data; name="model"',
      '',
      'whisper-1',
      `--${boundary}--`,
      ''
    ].join('\r\n');

    const headerBuffer = Buffer.from(header, 'utf-8');
    const modelBuffer = Buffer.from(modelPart, 'utf-8');
    const body = Buffer.concat([headerBuffer, audioBuffer, modelBuffer]);

    // Make request
    const response = await fetch('https://api.openai.com/v1/audio/transcriptions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': `multipart/form-data; boundary=${boundary}`
      },
      body
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Whisper API error: ${response.status} - ${errorText}`);
    }

    const result = await response.json();
    return result.text || null;

  } catch (error) {
    console.log(chalk.yellow(`  ⚠️ Whisper transcription failed: ${error.message}`));
    return null;
  }
}

/**
 * Execute a command
 */
async function executeCommand(command) {
  return new Promise((resolve) => {
    const child = spawn('sh', ['-c', command], {
      stdio: 'inherit',
      shell: true
    });

    child.on('close', (code) => {
      resolve(code);
    });

    child.on('error', (error) => {
      console.log(chalk.red(`  ❌ Execution failed: ${error.message}`));
      resolve(1);
    });
  });
}

/**
 * Show voice help
 */
function showVoiceHelp() {
  console.log(chalk.cyan(`
  🎤 Voice Commands:
  ─────────────────────────────────────────────────────────────────

  ${chalk.white('Project Creation:')}
    "go <description>"         Create new project
    "create <description>"     Same as go
    "agent <description>"      Multi-module build
    "template <id>"            Use a template

  ${chalk.white('Project Management:')}
    "debug"                    Debug current project
    "status"                   Show project status
    "preview"                  Start preview server
    "deploy"                   Deploy project
    "feedback"                 Interactive feedback mode
    "images"                   Generate images
    "undo"                     Undo last change

  ${chalk.white('Navigation:')}
    "templates"                Browse templates
    "doctor"                   Check configuration

  ${chalk.white('Session:')}
    "help"                     Show this help
    "exit" / "quit"            End voice mode

  ${chalk.gray('Examples:')}
    ${chalk.gray('"go landing page for my SaaS startup"')}
    ${chalk.gray('"create e-commerce site with dark theme"')}
    ${chalk.gray('"template landing-saas"')}
    ${chalk.gray('"deploy"')}
  `));
}
