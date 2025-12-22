# Vibecode CLI

```
██╗   ██╗██╗██████╗ ███████╗ ██████╗ ██████╗ ██████╗ ███████╗
██║   ██║██║██╔══██╗██╔════╝██╔════╝██╔═══██╗██╔══██╗██╔════╝
██║   ██║██║██████╔╝█████╗  ██║     ██║   ██║██║  ██║█████╗
╚██╗ ██╔╝██║██╔══██╗██╔══╝  ██║     ██║   ██║██║  ██║██╔══╝
 ╚████╔╝ ██║██████╔╝███████╗╚██████╗╚██████╔╝██████╔╝███████╗
  ╚═══╝  ╚═╝╚═════╝ ╚══════╝ ╚═════╝ ╚═════╝ ╚═════╝ ╚══════╝
```

**Build Software with Discipline** — AI coding with guardrails

[![npm version](https://img.shields.io/npm/v/@nclamvn/vibecode-cli.svg)](https://www.npmjs.com/package/@nclamvn/vibecode-cli)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

---

## What is Vibecode?

Vibecode is a CLI tool that brings **discipline** to AI-assisted development. Instead of chaotic prompt-and-pray coding, Vibecode enforces a structured workflow:

1. **Define** what you want (Intake)
2. **Design** how it works (Blueprint)
3. **Agree** on deliverables (Contract)
4. **Build** with AI assistance
5. **Review** against criteria
6. **Ship** with confidence

---

## Quick Start

```bash
# Install globally
npm install -g @nclamvn/vibecode-cli

# Initialize in your project
cd your-project
vibecode init

# Start guided session
vibecode start
```

That's it! Vibecode will guide you through the entire process.

---

## Philosophy

### AI as Pipeline, not Tool

Traditional approach:
```
Human → AI → Code → ???
```

Vibecode approach:
```
Human → Contract → AI Pipeline → Validated Code → Ship
         ↑                              │
         └──────── Feedback Loop ───────┘
```

### Core Principles

| Principle | Description |
|-----------|-------------|
| **Contract-First** | Lock scope before building. No scope creep. |
| **Evidence-Based** | Every build produces diff, logs, screenshots |
| **Iterative** | Build → Test → Fix loop until tests pass |
| **Disciplined** | State machine prevents skipping steps |

---

## Workflow

```
┌─────────────────────────────────────────────────────────────────┐
│                        VIBECODE WORKFLOW                        │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  PHASE A: PLANNING                                              │
│  ┌──────┐   ┌───────────┐   ┌──────────┐   ┌────────┐          │
│  │ INIT │ → │  INTAKE   │ → │ BLUEPRINT│ → │CONTRACT│          │
│  └──────┘   └───────────┘   └──────────┘   └────────┘          │
│                                                   │             │
│                                                   ▼             │
│                                              ┌────────┐         │
│                                              │  LOCK  │         │
│                                              └────────┘         │
│                                                   │             │
│  PHASE B: EXECUTION                               │             │
│                                                   ▼             │
│  ┌────────┐   ┌───────┐   ┌────────┐   ┌──────────┐            │
│  │SHIPPED │ ← │REVIEW │ ← │ BUILD  │ ← │   PLAN   │            │
│  └────────┘   └───────┘   └────────┘   └──────────┘            │
│                   │             ▲                               │
│                   │             │                               │
│                   └─────────────┘                               │
│                   (if failed, rebuild)                          │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

---

## Commands Reference

### Phase A: Planning

| Command | Description | Options |
|---------|-------------|---------|
| `vibecode init` | Initialize workspace | `-f, --force` `-q, --quiet` |
| `vibecode start` | Start guided session | `-r, --resume` |
| `vibecode status` | Show current state | `--json` `-v, --verbose` |
| `vibecode lock` | Lock contract, generate spec hash | `-d, --dry-run` `-f, --force` |
| `vibecode doctor` | Check installation health | — |

### Phase B: Execution

| Command | Description | Options |
|---------|-------------|---------|
| `vibecode plan` | Create execution plan | — |
| `vibecode build` | Build with AI | See Build Flags below |
| `vibecode review` | Review against criteria | `--skip-manual` |
| `vibecode snapshot` | Create release | `--patch` `--minor` `--major` |
| `vibecode config` | Manage settings | `--show` `--provider <name>` |

---

## Build Flags

The `build` command supports multiple modes:

```bash
# Manual build
vibecode build --start      # Start building
vibecode build --evidence   # Capture git diff
vibecode build --complete   # Mark as done

# AI-powered build
vibecode build --auto       # Single AI build with Claude Code

# Iterative build (recommended)
vibecode build --iterate              # Build → Test → Fix loop
vibecode build --iterate --max 5      # Max 5 iterations
vibecode build --iterate --strict     # Exit with error if fails
```

### How `--iterate` Works

```
┌─────────────────────────────────────────────────────────┐
│                  ITERATIVE BUILD LOOP                   │
├─────────────────────────────────────────────────────────┤
│                                                         │
│  ┌─────────┐                                            │
│  │  START  │                                            │
│  └────┬────┘                                            │
│       ▼                                                 │
│  ┌─────────┐     ┌─────────┐     ┌─────────┐           │
│  │  BUILD  │ ──▶ │  TEST   │ ──▶ │ ANALYZE │           │
│  │(Claude) │     │(npm test│     │ ERRORS  │           │
│  └─────────┘     │ + lint) │     └────┬────┘           │
│       ▲          └─────────┘          │                │
│       │                               ▼                │
│       │          ┌─────────┐     ┌─────────┐           │
│       └──────────│GENERATE │ ◀── │ ERRORS? │           │
│                  │FIX PROMPT│     └────┬────┘           │
│                  └─────────┘          │ No             │
│                                       ▼                │
│                                  ┌─────────┐           │
│                                  │  DONE!  │           │
│                                  └─────────┘           │
│                                                         │
└─────────────────────────────────────────────────────────┘
```

---

## Examples

### Example 1: Simple CLI Calculator

```bash
mkdir my-calculator && cd my-calculator
vibecode init

vibecode start
# Describe: "CLI calculator with add, subtract, multiply, divide"

vibecode start  # Continue to blueprint
vibecode start  # Continue to contract
vibecode lock   # Lock the contract

vibecode plan   # Generate execution plan
vibecode build --iterate  # Build until tests pass

vibecode review    # Review the build
vibecode snapshot  # Create v1.0.0
```

### Example 2: Landing Page

```bash
mkdir landing && cd landing
vibecode init
vibecode start
# Describe: "Modern landing page with hero, features, pricing, and contact form"

# ... follow the workflow
vibecode build --iterate --max 3
```

### Example 3: Using with Existing Project

```bash
cd my-existing-project
vibecode init
vibecode start
# Describe your feature/fix

vibecode build --auto  # Single AI build
```

---

## Project Structure

After `vibecode init`, your project will have:

```
your-project/
├── .vibecode/
│   ├── vibecode.yaml      # Configuration
│   ├── state.json         # State machine
│   ├── sessions/          # Session data
│   │   └── abc123/        # Session ID
│   │       ├── intake.md
│   │       ├── blueprint.md
│   │       ├── contract.md
│   │       ├── plan.md
│   │       ├── coder_pack.md
│   │       └── evidence/
│   │           ├── changes.diff
│   │           ├── build.log
│   │           └── screenshots/
│   └── logs/
│       └── audit.log
└── ... your code
```

---

## State Machine

Vibecode enforces a strict state machine to prevent skipping steps:

| State | Description | Next States |
|-------|-------------|-------------|
| `INIT` | Fresh workspace | `INTAKE_CAPTURED` |
| `INTAKE_CAPTURED` | Description recorded | `BLUEPRINT_DRAFTED` |
| `BLUEPRINT_DRAFTED` | Architecture designed | `CONTRACT_DRAFTED` |
| `CONTRACT_DRAFTED` | Scope defined | `CONTRACT_LOCKED` |
| `CONTRACT_LOCKED` | Ready to build | `PLAN_CREATED` |
| `PLAN_CREATED` | Plan generated | `BUILD_IN_PROGRESS` |
| `BUILD_IN_PROGRESS` | Building... | `BUILD_DONE` |
| `BUILD_DONE` | Build complete | `REVIEW_PASSED` / `REVIEW_FAILED` |
| `REVIEW_PASSED` | QA passed | `SHIPPED` |
| `REVIEW_FAILED` | QA failed | `BUILD_IN_PROGRESS` |
| `SHIPPED` | Released! | — |

---

## Requirements

- **Node.js** >= 18.0.0
- **Claude Code CLI** (for `--auto` and `--iterate` modes)
  ```bash
  npm install -g @anthropic-ai/claude-code
  ```

---

## Configuration

### CLAUDE.md

Create a `CLAUDE.md` file in your project root to provide context to Claude Code:

```markdown
# Project Rules

- Use TypeScript for all new files
- Follow existing code style
- Write tests for new features
- No console.log in production code
```

This will be automatically injected when using `--auto` or `--iterate`.

---

## Troubleshooting

### "No Vibecode workspace found"

Run `vibecode init` first.

### "Invalid transition"

You're trying to skip a step. Check current state with `vibecode status`.

### "Claude Code CLI not found"

Install Claude Code:
```bash
npm install -g @anthropic-ai/claude-code
```

### Build keeps failing

1. Check `vibecode status --verbose`
2. Look at `.vibecode/sessions/<id>/evidence/build.log`
3. Try `vibecode build --iterate --max 5` for more attempts

---

## Links

- **npm**: https://www.npmjs.com/package/@nclamvn/vibecode-cli
- **Issues**: https://github.com/nclamvn/vibecode-cli/issues

---

## License

MIT © [Lam](https://github.com/nclamvn)

---

## Credits

Powered by [Claude Code](https://github.com/anthropics/claude-code)

---

<p align="center">
  <strong>"Contract LOCKED = License to Build"</strong>
</p>
