#!/usr/bin/env node
// Stop hook — refuses to let Claude finish a turn in which it edited code but never
// ran a check (typecheck / lint / test / build) after the last edit.
//
// The failure it prevents: "done" reported on code that does not compile. lint-fe.mjs
// only sees one file at a time and only pattern-detectable rules; a type error two
// files away, a broken import or a red test is invisible to it. The fix is cheap —
// run the project's own checks — so the gate makes it non-optional.
//
// How it decides, from the session transcript (JSONL) since the last real user prompt:
//   - lastEdit  = the last Edit/Write/MultiEdit/NotebookEdit on a code file
//   - lastCheck = the last Bash command that runs a check
//   lastEdit after lastCheck (or no check at all) → block, with the commands to run.
//
// Blocks at most ONCE per stop: when the harness re-invokes Stop after a block it sets
// stop_hook_active, and we let it through — a gate that can loop forever gets disabled.
// Opt-out: env TLM_VERIFY_GATE=0, or tlm.quality.verifyGate=false in the project config.

import fs from 'node:fs'
import path from 'node:path'
import { readStdinPayload, delegateToVendored, toPosix } from './lib/hook-io.mjs'

const { raw, json: input } = readStdinPayload()
const cwd = input?.cwd || process.env.CLAUDE_PROJECT_DIR || process.cwd()

delegateToVendored({ selfUrl: import.meta.url, startDirs: [cwd, process.env.CLAUDE_PROJECT_DIR], raw })

if (input?.stop_hook_active) process.exit(0)
if (process.env.TLM_VERIFY_GATE === '0') process.exit(0)

const readJson = (p) => {
  try {
    return JSON.parse(fs.readFileSync(p, 'utf8'))
  } catch {
    return null
  }
}

// Project opt-out. Same config files every skill reads.
for (const f of ['settings.local.json', 'tlm.local.json']) {
  const cfg = readJson(path.join(cwd, '.claude', f))
  const tlm = f === 'settings.local.json' ? cfg?.tlm : cfg
  if (tlm?.quality?.verifyGate === false) process.exit(0)
}

const transcript = input?.transcript_path
if (!transcript) process.exit(0)
let lines
try {
  lines = fs.readFileSync(transcript, 'utf8').split('\n')
} catch {
  process.exit(0)
}

// Code a check can actually verify. Markdown, JSON config and the rules copy are not.
const CODE_RE = /\.(tsx?|jsx?|mjs|cjs|vue|svelte|py|go|rs|kt|swift|java|dart)$/
const CHECK_RE = new RegExp(
  [
    '\\b(pnpm|npm|yarn|bun|npx)\\s+(run\\s+|exec\\s+|dlx\\s+)?[\\w:.-]*(typecheck|type-check|tsc|lint|test|build|check|verify|e2e)',
    '(^|[\\s;&|(])(tsc|eslint|biome|vitest|jest|playwright|detox|next\\s+build|nest\\s+build|expo\\s+export)\\b',
    '\\bnode\\s+--test\\b',
    '\\b(pytest|go\\s+(test|vet|build)|cargo\\s+(test|check|build|clippy)|gradlew?\\s+\\S*(test|build|check))\\b',
  ].join('|')
)

const EDIT_TOOLS = new Set(['Edit', 'Write', 'MultiEdit', 'NotebookEdit'])

let seq = 0
let lastEdit = -1
let lastCheck = -1
const edited = new Set()

for (const line of lines) {
  if (!line.trim()) continue
  let entry
  try {
    entry = JSON.parse(line)
  } catch {
    continue
  }
  const content = entry?.message?.content
  // A real user prompt (not a tool_result echo) starts a new turn: reset.
  if (entry?.type === 'user') {
    const isToolResult = Array.isArray(content) && content.some((c) => c?.type === 'tool_result')
    if (!isToolResult && !entry.isMeta) {
      lastEdit = -1
      lastCheck = -1
      edited.clear()
    }
    continue
  }
  if (entry?.type !== 'assistant' || !Array.isArray(content)) continue
  for (const block of content) {
    if (block?.type !== 'tool_use') continue
    seq++
    const name = block.name
    const inp = block.input || {}
    if (EDIT_TOOLS.has(name)) {
      const file = toPosix(inp.file_path || inp.notebook_path || '')
      if (CODE_RE.test(file) && !file.includes('/node_modules/') && !file.includes('/.claude/')) {
        lastEdit = seq
        edited.add(file)
      }
    } else if (name === 'Bash' && CHECK_RE.test(String(inp.command || ''))) {
      lastCheck = seq
    }
  }
}

if (lastEdit === -1 || lastCheck > lastEdit) process.exit(0)

// Suggest the project's own commands, with its own package manager.
const pkg = readJson(path.join(cwd, 'package.json'))
const pm = fs.existsSync(path.join(cwd, 'pnpm-lock.yaml'))
  ? 'pnpm'
  : fs.existsSync(path.join(cwd, 'yarn.lock'))
    ? 'yarn'
    : fs.existsSync(path.join(cwd, 'bun.lockb')) || fs.existsSync(path.join(cwd, 'bun.lock'))
      ? 'bun'
      : 'npm'
const scripts = Object.keys(pkg?.scripts || {})
const pick = (...names) => names.find((n) => scripts.includes(n))
const suggestions = [
  pick('typecheck', 'type-check', 'tsc', 'check-types'),
  pick('lint'),
  pick('test', 'test:unit'),
]
  .filter(Boolean)
  .map((s) => `${pm} run ${s}`)
if (!suggestions.length && fs.existsSync(path.join(cwd, 'tsconfig.json'))) suggestions.push(`${pm === 'npm' ? 'npx' : pm + ' exec'} tsc --noEmit`)

const files = [...edited].slice(0, 8).map((f) => `  - ${f}`).join('\n')
process.stdout.write(
  JSON.stringify({
    decision: 'block',
    reason: `[verify-gate] You edited code this turn but ran no check after the last edit:
${files}
Before reporting done, run the project's checks and fix what they flag:
${suggestions.length ? suggestions.map((s) => `  ${s}`).join('\n') : '  (no typecheck/lint/test script found — run whatever this project uses to build or test)'}
If a check genuinely cannot run here (no deps installed, needs a device), say so explicitly in your reply instead.`,
  })
)
