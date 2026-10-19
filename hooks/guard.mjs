#!/usr/bin/env node
// PreToolUse hook — stops the handful of actions that are cheap to prevent and
// expensive to undo, BEFORE they run. lint-fe.mjs is advisory and runs after the
// write; for these, after is too late:
//
//   deny  — a secret literal written into a source file (it lands in git history,
//           which you cannot quietly rewrite), `rm -rf` on /, ~, $HOME, ., .., *,
//           a force-push to a protected branch.
//   ask   — writing a .env* file, any other force-push, `git reset --hard`,
//           `git clean -f`, `--no-verify`, a destructive DB reset / DROP.
//
// "ask" puts the user in the loop instead of refusing outright: storing a secret
// the user handed over in .env.local is legitimate, doing it unannounced is not.
// Only high-confidence patterns live here — a guard that cries wolf gets disabled.
// Opt-out: env TLM_GUARD=0.

import path from 'node:path'
import { readStdinPayload, delegateToVendored, toPosix } from './lib/hook-io.mjs'

const { raw, json: input } = readStdinPayload()
const tool = input?.tool_name
const ti = input?.tool_input || {}
const target = ti.file_path || ti.notebook_path

delegateToVendored({
  selfUrl: import.meta.url,
  startDirs: [target && path.dirname(target), input?.cwd, process.env.CLAUDE_PROJECT_DIR],
  raw,
})

if (process.env.TLM_GUARD === '0') process.exit(0)

const decide = (permissionDecision, reason) => {
  process.stdout.write(
    JSON.stringify({
      hookSpecificOutput: {
        hookEventName: 'PreToolUse',
        permissionDecision,
        permissionDecisionReason: `[tlm guard] ${reason}`,
      },
    })
  )
  process.exit(0)
}

// --- file writes ------------------------------------------------------------
const SECRET_PATTERNS = [
  [/-----BEGIN (RSA |EC |DSA |OPENSSH |PGP )?PRIVATE KEY-----/, 'a private key'],
  [/\bAKIA[0-9A-Z]{16}\b/, 'an AWS access key id'],
  [/\bgh[pousr]_[A-Za-z0-9]{36,}\b|\bgithub_pat_[A-Za-z0-9_]{50,}/, 'a GitHub token'],
  [/\bsk-ant-[A-Za-z0-9_-]{20,}/, 'an Anthropic API key'],
  [/\bsk-(proj-)?[A-Za-z0-9]{32,}\b/, 'an OpenAI-style API key'],
  [/\bxox[abposr]-[A-Za-z0-9-]{10,}/, 'a Slack token'],
  [/\bAIza[0-9A-Za-z_-]{35}\b/, 'a Google API key'],
  [/\b(sk|rk)_live_[A-Za-z0-9]{20,}/, 'a Stripe live key'],
  [/\b(postgres(ql)?|mysql|mongodb(\+srv)?|redis):\/\/[^:\s/'"]+:[^@\s'"]{3,}@(?!localhost|127\.0\.0\.1)/, 'a connection string with a password'],
]

if (tool === 'Edit' || tool === 'Write' || tool === 'MultiEdit') {
  const file = toPosix(target || '')
  const base = path.posix.basename(file)
  const isEnv = /^\.env(\..+)?$/.test(base) && !/\.(example|sample|template|dist)$/.test(base)
  if (isEnv) {
    decide(
      'ask',
      `writing ${base}. Env files hold secrets: confirm this is intended, make sure it is gitignored, and never echo the values back.`
    )
  }
  const text = [ti.content, ti.new_string, ...(Array.isArray(ti.edits) ? ti.edits.map((e) => e?.new_string) : [])]
    .filter((s) => typeof s === 'string')
    .join('\n')
  for (const [re, what] of SECRET_PATTERNS) {
    if (re.test(text)) {
      decide(
        'deny',
        `this write puts ${what} into ${base || 'a file'}. A committed secret stays in git history. Read it from an env var (process.env.X) and put the value in a gitignored .env.local / the deploy platform instead.`
      )
    }
  }
  process.exit(0)
}

// --- shell commands -----------------------------------------------------------
if (tool !== 'Bash') process.exit(0)
const cmd = String(ti.command || '')

// rm -rf on something that is the whole disk / home / project.
const rmRf = /\brm\s+(-[a-zA-Z]*r[a-zA-Z]*f[a-zA-Z]*|-[a-zA-Z]*f[a-zA-Z]*r[a-zA-Z]*|-r\s+-f|-f\s+-r|--recursive\s+--force|--force\s+--recursive)\s+([^;&|]*)/
const m = cmd.match(rmRf)
if (m) {
  const targets = m[2].trim().split(/\s+/)
  const fatal = targets.find((t) => /^(\/|\/\*|~\/?|~\/\*|\$HOME\/?|"\$HOME"\/?|\.\/?|\.\.\/?|\*|\.\/\*)$/.test(t))
  if (fatal) decide('deny', `\`rm -rf ${fatal}\` would delete far more than intended. Name the exact directory to remove.`)
}

const PROTECTED = /\b(main|master|develop|production|prod|release)\b/
if (/\bgit\s+push\b/.test(cmd) && /(\s--force(?!-with-lease)\b|\s-f\b|\s\+\S+)/.test(cmd)) {
  if (PROTECTED.test(cmd.replace(/^.*?\bgit\s+push\b/, ''))) {
    decide('deny', 'force-push to a protected branch rewrites shared history. Push a new branch and open a PR instead.')
  }
  decide('ask', 'force-push rewrites remote history. Prefer --force-with-lease, and confirm nobody else works on this branch.')
}

const ASK = [
  [/\bgit\s+reset\s+--hard\b/, '`git reset --hard` discards uncommitted work.'],
  [/\bgit\s+clean\s+-[a-zA-Z]*f/, '`git clean -f` deletes untracked files for good.'],
  [/\bgit\s+(checkout|restore)\s+(--\s+)?\.(\s|$)/, 'this discards every uncommitted change in the tree.'],
  [/\bgit\s+(commit|push)\b[^;&|]*--no-verify\b/, '`--no-verify` skips the project\'s git hooks (lint/tests).'],
  [/\bprisma\s+migrate\s+reset\b|\bprisma\s+db\s+push\b[^;&|]*--force-reset\b/, 'this wipes the database.'],
  [/\b(DROP\s+(DATABASE|SCHEMA|TABLE)|TRUNCATE\s+TABLE)\b/i, 'this destroys data.'],
]
for (const [re, why] of ASK) if (re.test(cmd)) decide('ask', why)
