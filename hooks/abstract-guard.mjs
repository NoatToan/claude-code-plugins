#!/usr/bin/env node
// PreToolUse hook — keeps project-specific content out of the PLUGIN's own files
// (skills/ ai/ hooks/ setup/ README.md CLAUDE.md), whether that is this repo or a
// consuming project's live rules copy (.claude/tlm-plugin/).
//
// Why it exists: a skill is usually born from one real project, and its first
// draft carries that project along — the client's name, a real ClickUp workspace
// id, the stakeholders' names in an e-mail example, a sprint's real numbers. Once
// committed (or shipped upstream by plugin-pr.mjs) that is in every teammate's
// install and in git history. Catching it BEFORE the write is the only cheap fix.
//
// Three checks, cheapest-to-ignore last:
//   1. PLANNING GATE — the first write of a NEW skill (skills/<name>/ not there
//      yet, or its SKILL.md) is denied once per session with the abstraction
//      checklist, so the draft gets one deliberate pass. The retry goes through.
//   2. DENYLIST — the real values themselves, read from local config that is never
//      committed: <root>/setup/project.local.json (`abstract`: real → placeholder),
//      plus the project's tlm config and pm-report profiles. A hit is denied.
//   3. HEURISTICS — real-looking tracker ids/URLs, UUIDs, e-mail addresses, home
//      paths. Advisory only (additionalContext): placeholders can look like these.
//
// Silent outside the plugin's own files. Never fails the turn on bad input.

import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import crypto from 'node:crypto'
import { readStdinPayload, delegateToVendored, emitContext, toPosix, VENDOR_SEGMENT } from './lib/hook-io.mjs'

const { raw, json: input } = readStdinPayload()
const tool = input?.tool_name
const ti = input?.tool_input || {}
const file = ti.file_path
if (!file) process.exit(0)

delegateToVendored({
  selfUrl: import.meta.url,
  startDirs: [path.dirname(file), input?.cwd, process.env.CLAUDE_PROJECT_DIR],
  raw,
})

const exists = (p) => {
  try {
    fs.statSync(p)
    return true
  } catch {
    return false
  }
}
const readJson = (p) => {
  try {
    return JSON.parse(fs.readFileSync(p, 'utf8'))
  } catch {
    return null
  }
}

// ---------------------------------------------------------------------------
// Scope: which plugin tree is this file in, and where is the project around it?

function pluginScope(abs) {
  const posix = toPosix(path.resolve(abs))
  const marker = `/${VENDOR_SEGMENT}/`
  const at = posix.lastIndexOf(marker)
  if (at !== -1) {
    const projectDir = posix.slice(0, at)
    return { root: projectDir + '/' + VENDOR_SEGMENT, projectDir, rel: posix.slice(at + marker.length) }
  }
  // The plugin repo itself: nearest ancestor holding .claude-plugin/plugin.json.
  let dir = path.dirname(path.resolve(abs))
  for (;;) {
    if (exists(path.join(dir, '.claude-plugin', 'plugin.json'))) {
      const root = toPosix(dir)
      return { root, projectDir: root, rel: posix.slice(root.length + 1) }
    }
    const up = path.dirname(dir)
    if (up === dir) return null
    dir = up
  }
}

const scope = pluginScope(file)
if (!scope) process.exit(0)
const { root, projectDir, rel } = scope
const inPluginFiles = /^(skills|ai|hooks|setup)\//.test(rel) || rel === 'README.md' || rel === 'CLAUDE.md'
// *.local.json is where the real values are SUPPOSED to live.
if (!inPluginFiles || /\.local\.json$/.test(rel)) process.exit(0)

// ---------------------------------------------------------------------------
// The text this call would put into the file.

let text = ''
if (tool === 'Write') text = ti.content ?? ''
else if (tool === 'Edit') text = ti.new_string ?? ''
else if (tool === 'MultiEdit') text = (ti.edits || []).map((e) => e?.new_string ?? '').join('\n')
else process.exit(0)

// ---------------------------------------------------------------------------
// 2. DENYLIST — real values from local, never-committed config.

function denylist() {
  const terms = new Map() // real value → placeholder to use instead
  const add = (v, placeholder) => {
    const s = String(v ?? '').trim()
    const known = [...terms.keys()].some((k) => k.toLowerCase() === s.toLowerCase())
    if (s.length >= 3 && !/^<.*>$/.test(s) && !/^<<FILL/.test(s) && !known) terms.set(s, placeholder)
  }
  const local = readJson(path.join(root, 'setup', 'project.local.json'))
  for (const [real, ph] of Object.entries(local?.abstract || {})) add(real, ph)

  const tlm = readJson(path.join(projectDir, '.claude', 'settings.local.json'))?.tlm
  add(tlm?.project?.name, 'Acme')
  add(tlm?.tickets?.workspaceId, '9000000000')

  for (const p of readJson(path.join(projectDir, '.claude', 'tlm-pm-reports.json'))?.profiles || []) {
    add(p?.name, 'Acme')
    add(p?.id, 'acme-portal')
    add(p?.tracker?.workspaceId, '9000000000')
  }
  // Placeholders themselves must never be flagged.
  for (const k of [...terms.keys()]) if (['acme', 'acme-portal', '9000000000'].includes(k.toLowerCase())) terms.delete(k)
  return terms
}

const escapeRe = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
const denyHits = []
for (const [term, ph] of denylist()) {
  // Word boundaries only where the term itself starts/ends with a word character,
  // so "project/<client>/" still matches inside "project/<client>/sprint-1.md".
  const pre = /^[A-Za-z0-9]/.test(term) ? '(?<![A-Za-z0-9])' : ''
  const post = /[A-Za-z0-9]$/.test(term) ? '(?![A-Za-z0-9])' : ''
  const re = new RegExp(`${pre}${escapeRe(term)}${post}`, 'gi')
  const n = (text.match(re) || []).length
  if (n) denyHits.push(`  - "${term}" ×${n} → use ${ph}`)
}

// ---------------------------------------------------------------------------
// 3. HEURISTICS — shapes that are usually real. Placeholders are exempted.

// 9000000000, 90100000001, 90100000003: at most two non-zero digits after the first.
const looksPlaceholderNumber = (d) =>
  d.slice(1).replace(/0/g, '').length <= 2 || '12345678901234567890'.startsWith(d)
const heuristics = []
const note = (label, list) => {
  const uniq = [...new Set(list)].slice(0, 5)
  if (uniq.length) heuristics.push(`  - ${label}: ${uniq.join(', ')}`)
}
note(
  'long numeric ids (tracker workspace/list/folder ids?)',
  (text.match(/\b\d{9,}\b/g) || []).filter((d) => !looksPlaceholderNumber(d))
)
note(
  'ticket URLs with a real-looking id',
  (text.match(/app\.clickup\.com\/t\/\w+(?:\/[\w-]+)?/g) || []).filter(
    (u) => !/\/t\/(abc123|REPLACE_ME|9000000000)\b/.test(u) && !/\/t\/[019]+(\/|$)/.test(u)
  )
)
note(
  'UUIDs (custom field / option ids?)',
  (text.match(/\b[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\b/gi) || []).filter(
    (u) => !/^[0-]+$/.test(u)
  )
)
note(
  'e-mail addresses',
  // TLD must be letters, so package pins like next@15.1.6 are not addresses.
  (text.match(/(?<![\w.+-])[\w.+]+(?:-[\w.+]+)*@[\w-]+(?:\.[\w-]+)*\.[A-Za-z]{2,}\b/g) || []).filter(
    (e) =>
      !/^git@/.test(e) &&
      !/@github\.com/i.test(e) &&
      !/@(example\.(com|org|net)|acme\.[a-z.]+)$/i.test(e) &&
      e.toLowerCase() !== 'noreply@anthropic.com'
  )
)
note(
  'absolute home paths',
  (text.match(/(?:\/Users\/|\/home\/|[A-Z]:\\\\?Users\\\\?)[A-Za-z][\w.-]+/g) || []).filter(
    (p) => !/(you|me|user|name)$/i.test(p)
  )
)

// ---------------------------------------------------------------------------
// 1. PLANNING GATE — once per session per new skill.

const CHECKLIST = `Before writing a skill, abstract everything that belongs to ONE project. Plugin files are
shared with every team that installs it, and anything committed stays in git history.

  WHAT                                  REPLACE WITH
  1. Client / company / product names   Acme, Acme Portal, acme-portal
  2. People: PM, stakeholders, devs,    <PM name>, <lead>, invented first names (Alex, Sam)
     greetings and sign-offs
  3. Tracker ids: workspace, space,     9000000000, 90100000001, abc-123, TLM-1234,
     folder, list, custom-field ids,    https://app.clickup.com/t/abc123
     real ticket ids and URLs
  4. Hosts, repos, channels: internal   acme.example.com, git@github.com:acme/<repo>.git,
     domains, git remotes, Slack        #acme-releases
  5. E-mail addresses                   stakeholder@example.com
  6. Examples copied from a real run:   invented but coherent numbers, dates, goal names;
     report figures, sprint numbers,    keep the SHAPE of the real example, not its data
     goal/feature names, dates
  7. Local paths: project/<client>/,    reports/acme/..., ~/..., <project>/
     /Users/<name>/...
  8. Secrets: tokens, API keys          an env var name, or REPLACE_ME

WHERE THE REAL VALUES GO: a skill READS them from config, it never hardcodes them.
  - per project, for the skill at run time → the consuming project's .claude/settings.local.json
    (schema: setup/tlm-config.reference.json) or the skill's own local store
  - for you to look up while authoring → setup/project.local.json (gitignored, key "abstract":
    real value → placeholder; the denylist this hook enforces)`

const skillMatch = rel.match(/^skills\/([^/]+)\//)
let gate = false
if (tool === 'Write' && skillMatch && !exists(file)) {
  const skillDir = path.join(root, 'skills', skillMatch[1])
  if (!exists(skillDir) || path.basename(file) === 'SKILL.md') {
    const key = crypto
      .createHash('sha1')
      .update(`${input?.session_id || 'nosession'}|${toPosix(skillDir)}`)
      .digest('hex')
    const markerDir = path.join(os.tmpdir(), 'tlm-abstract-plan')
    const marker = path.join(markerDir, key)
    if (!exists(marker)) {
      gate = true
      try {
        fs.mkdirSync(markerDir, { recursive: true })
        fs.writeFileSync(marker, toPosix(skillDir))
      } catch {
        // can't persist the marker → the gate would fire forever; skip it instead
        gate = false
      }
    }
  }
}

// ---------------------------------------------------------------------------
// Decide.

const deny = (reason) => {
  process.stdout.write(
    JSON.stringify({
      hookSpecificOutput: { hookEventName: 'PreToolUse', permissionDecision: 'deny', permissionDecisionReason: reason },
    })
  )
  process.exit(0)
}

if (gate) {
  deny(`[abstract] Planning pass for the new skill "${skillMatch[1]}" (${rel}) — this write was held once on purpose.

${CHECKLIST}
${denyHits.length ? `\nDenylisted real values in this draft (must go):\n${denyHits.join('\n')}\n` : ''}${heuristics.length ? `\nReal-looking values in this draft (check each):\n${heuristics.join('\n')}\n` : ''}
ACTION FOR CLAUDE: review the draft against every row above, replace what is project-specific, move
real values to config, then write the file again (the retry is not held).`)
}

if (denyHits.length) {
  deny(`[abstract] ${rel} would get project-specific values. Plugin files are shared with every team:
${denyHits.join('\n')}

These come from local config (setup/project.local.json "abstract", the project's tlm config, or its
pm-report profiles). Replace them with the placeholders, keep the real value in config, and write again.`)
}

if (heuristics.length) {
  emitContext(
    'PreToolUse',
    `[abstract] ${rel} — values that look project-specific (advisory, the write went through):
${heuristics.join('\n')}
If any of these is real, replace it with a placeholder (9000000000, abc123, stakeholder@example.com,
~/...) and, if you need to remember it, add it to setup/project.local.json "abstract".`
  )
}
