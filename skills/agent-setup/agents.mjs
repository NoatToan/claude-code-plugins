#!/usr/bin/env node
// agents.mjs — give a project a team of specialist subagents fitted to its stack.
//
// A project with no `.claude/agents/` makes Claude do every job in one context: the
// review is done by the same context that wrote the code, the DB question is answered
// from frontend context, and nothing reminds it the project has a test runner. A
// specialist with its own short brief (stack, commands, which rule files to open)
// fixes that cheaply. This script decides WHICH specialists a project needs from what
// is actually in the repo, and writes them from templates — it never guesses a stack
// the repo does not show.
//
// Usage (run from the consuming project, or point TLM_PROJECT_DIR at it):
//   node agents.mjs detect [--json]           # stack facts + existing agents; no writes
//   node agents.mjs plan                      # which specialists it would create, and why
//   node agents.mjs generate [--dry-run] [--fill-gaps] [--only a,b] [--force]
//   node agents.mjs new <name> --role "<expertise>" [--tools "Read, Grep"] [--model sonnet]
//
// `generate` writes ONLY when the project has no agents yet — "generate a team if there
// is none". With agents already present it reports the gaps and stops, unless
// --fill-gaps (add the missing ones) or --only (add exactly these). An existing file is
// never overwritten without --force: it may hold edits the team made.
//
// `new` scaffolds ONE specialist for an expertise the catalog does not cover (payments,
// maps, i18n, …). Its body is a skeleton the agent-setup skill then fills in from the
// repo — the script does not invent domain knowledge.
//
// Writes only into <project>/.claude/agents/. Never touches ${CLAUDE_PLUGIN_ROOT}.

import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const PROJ = path.resolve(process.env.TLM_PROJECT_DIR || process.cwd())
const HERE = path.dirname(fileURLToPath(import.meta.url))
const TEMPLATES = path.join(HERE, 'templates')
const AGENTS_DIR = path.join(PROJ, '.claude', 'agents')

const out = (s) => process.stdout.write(s + '\n')
const die = (msg) => {
  process.stderr.write(`agent-setup: ${msg}\n`)
  process.exit(1)
}
const exists = (p) => fs.existsSync(p)
const readJson = (p) => {
  try {
    return JSON.parse(fs.readFileSync(p, 'utf8'))
  } catch {
    return null
  }
}
const isDir = (p) => {
  try {
    return fs.statSync(p).isDirectory()
  } catch {
    return false
  }
}

// ---------------------------------------------------------------------------
// DETECT

// Root package.json plus workspace packages (apps/*, packages/*, services/*), so a
// monorepo's NestJS API is seen even though the root manifest only lists turbo.
function manifests() {
  const found = []
  const add = (dir) => {
    const pkg = readJson(path.join(dir, 'package.json'))
    if (pkg) found.push({ dir, pkg })
  }
  add(PROJ)
  for (const group of ['apps', 'packages', 'services']) {
    const g = path.join(PROJ, group)
    if (!isDir(g)) continue
    for (const d of fs.readdirSync(g)) if (isDir(path.join(g, d))) add(path.join(g, d))
  }
  return found
}

function packageManager() {
  if (exists(path.join(PROJ, 'pnpm-lock.yaml'))) return 'pnpm'
  if (exists(path.join(PROJ, 'yarn.lock'))) return 'yarn'
  if (exists(path.join(PROJ, 'bun.lockb')) || exists(path.join(PROJ, 'bun.lock'))) return 'bun'
  return 'npm'
}

const anyFile = (...rels) => rels.some((r) => exists(path.join(PROJ, r)))
const globTop = (re) => {
  try {
    return fs.readdirSync(PROJ).some((f) => re.test(f))
  } catch {
    return false
  }
}

export function detect() {
  const ms = manifests()
  const deps = new Set()
  for (const { pkg } of ms) {
    for (const k of ['dependencies', 'devDependencies', 'peerDependencies']) {
      for (const d of Object.keys(pkg[k] || {})) deps.add(d)
    }
  }
  const has = (...names) => names.some((n) => deps.has(n))
  const root = ms[0]?.pkg || {}
  const pm = packageManager()

  const stacks = []
  if (has('next')) {
    const appRouter = anyFile('app', 'src/app') && !anyFile('pages', 'src/pages')
    stacks.push(appRouter ? 'nextjs-app-router' : 'nextjs-page-router')
  } else if (has('react', 'vue', 'svelte', '@angular/core') && !has('react-native')) stacks.push('web-spa')
  if (has('expo', 'expo-router')) stacks.push('react-native-expo')
  else if (has('react-native')) stacks.push('react-native-cli')
  if (has('@nestjs/core')) stacks.push('nestjs')
  if (has('express', 'fastify', 'hono', 'koa') && !has('@nestjs/core')) stacks.push('node-api')
  const nextApi = has('next') && anyFile('pages/api', 'src/pages/api', 'app/api', 'src/app/api')
  if (nextApi) stacks.push('nextjs-api')

  const db = []
  if (has('prisma', '@prisma/client') || anyFile('prisma/schema.prisma')) db.push('prisma')
  if (has('typeorm', '@nestjs/typeorm')) db.push('typeorm')
  if (has('drizzle-orm')) db.push('drizzle')
  if (has('mongoose', '@nestjs/mongoose')) db.push('mongoose')
  if (has('knex', 'sequelize', 'pg', 'mysql2') && !db.length) db.push('sql')

  const tests = []
  for (const t of ['vitest', 'jest', '@playwright/test', 'detox', 'cypress', '@testing-library/react', '@testing-library/react-native']) {
    if (has(t)) tests.push(t)
  }

  const infra = []
  if (globTop(/^Dockerfile|^docker-compose/)) infra.push('docker')
  if (isDir(path.join(PROJ, '.github', 'workflows'))) infra.push('github-actions')
  if (anyFile('azure-pipelines.yml', '.gitlab-ci.yml', 'bitbucket-pipelines.yml')) infra.push('ci')
  if (anyFile('vercel.json') || has('vercel')) infra.push('vercel')
  if (anyFile('eas.json')) infra.push('eas')

  const scripts = root.scripts || {}
  const pick = (...names) => names.find((n) => scripts[n])
  const run = (s) => (s ? `${pm} run ${s}` : null)
  const checks = {
    typecheck: run(pick('typecheck', 'type-check', 'tsc', 'check-types')) || (anyFile('tsconfig.json') ? `${pm === 'npm' ? 'npx' : pm + ' exec'} tsc --noEmit` : null),
    lint: run(pick('lint')),
    test: run(pick('test', 'test:unit')),
    e2e: run(pick('e2e', 'test:e2e')),
    build: run(pick('build')),
  }

  return {
    project: root.name || path.basename(PROJ),
    pm,
    stacks,
    db,
    tests,
    infra,
    checks,
  }
}

// Agents already in the project. Identity is the `name:` frontmatter, not the filename.
export function existingAgents() {
  const found = []
  const walk = (dir) => {
    if (!isDir(dir)) return
    for (const f of fs.readdirSync(dir)) {
      const p = path.join(dir, f)
      if (isDir(p)) walk(p)
      else if (f.endsWith('.md')) {
        const m = fs.readFileSync(p, 'utf8').match(/^---\s*\n[\s\S]*?^name:\s*["']?([^\n"']+)["']?\s*$/m)
        found.push({ name: m ? m[1].trim() : path.basename(f, '.md'), file: path.relative(PROJ, p) })
      }
    }
  }
  walk(AGENTS_DIR)
  return found
}

// ---------------------------------------------------------------------------
// CATALOG — each specialist states the evidence that makes it worth having.

const FE = ['nextjs-app-router', 'nextjs-page-router', 'web-spa']
const RN = ['react-native-expo', 'react-native-cli']
const BE = ['nestjs', 'node-api', 'nextjs-api']

export const CATALOG = [
  { name: 'code-reviewer', why: () => 'always — a second context reviewing the diff catches what the author context cannot' },
  { name: 'debugger', why: () => 'always — root-cause debugging in its own context keeps failed hypotheses out of the main one' },
  { name: 'security-reviewer', why: (f) => (f.stacks.length ? 'the project ships code that handles user input / auth / secrets' : null) },
  { name: 'frontend-engineer', why: (f) => (f.stacks.some((s) => FE.includes(s)) ? `web stack: ${f.stacks.filter((s) => FE.includes(s)).join(', ')}` : null) },
  { name: 'mobile-engineer', why: (f) => (f.stacks.some((s) => RN.includes(s)) ? `mobile stack: ${f.stacks.filter((s) => RN.includes(s)).join(', ')}` : null) },
  { name: 'backend-engineer', why: (f) => (f.stacks.some((s) => BE.includes(s)) ? `backend: ${f.stacks.filter((s) => BE.includes(s)).join(', ')}` : null) },
  { name: 'database-specialist', why: (f) => (f.db.length ? `data layer: ${f.db.join(', ')}` : null) },
  { name: 'test-engineer', why: (f) => (f.tests.length ? `test tooling: ${f.tests.join(', ')}` : null) },
  { name: 'devops-engineer', why: (f) => (f.infra.length ? `delivery: ${f.infra.join(', ')}` : null) },
]

export function plan(facts, existing) {
  const have = new Set(existing.map((a) => a.name))
  return CATALOG.map((c) => ({ name: c.name, why: c.why(facts), exists: have.has(c.name) })).filter((p) => p.why)
}

// ---------------------------------------------------------------------------
// RENDER

// Rule files each specialist should open, relative to the rules root. Only paths that
// exist in the rules root are listed, so a trimmed vendored copy never points at air.
const RULE_REFS = {
  'nextjs-app-router': ['skills/fe-coding/SKILL.md', 'ai/nextjs/app-router/', 'ai/shared-fe/'],
  'nextjs-page-router': ['skills/fe-coding/SKILL.md', 'ai/nextjs/page-router/', 'ai/shared-fe/'],
  'web-spa': ['skills/fe-coding/SKILL.md', 'ai/shared-fe/'],
  'react-native-expo': ['skills/fe-coding/SKILL.md', 'ai/reactnative/'],
  'react-native-cli': ['skills/fe-coding/SKILL.md', 'ai/reactnative/'],
  nestjs: ['ai/nestjs/README.md', 'ai/shared-be/', 'ai/vendor/ecc/skills/nestjs-patterns/SKILL.md'],
  'node-api': ['ai/shared-be/', 'ai/vendor/ecc/skills/backend-patterns/SKILL.md', 'ai/vendor/ecc/skills/api-design/SKILL.md'],
  'nextjs-api': ['ai/nextjs/00-backend-decision.md', 'ai/shared-be/'],
  prisma: ['ai/vendor/ecc/skills/prisma-patterns/SKILL.md', 'ai/vendor/ecc/skills/database-migrations/SKILL.md', 'ai/shared-be/01-avoid-n-plus-1-queries.md'],
  typeorm: ['ai/vendor/ecc/skills/database-migrations/SKILL.md', 'ai/shared-be/01-avoid-n-plus-1-queries.md'],
  drizzle: ['ai/vendor/ecc/skills/database-migrations/SKILL.md', 'ai/shared-be/01-avoid-n-plus-1-queries.md'],
  sql: ['ai/vendor/ecc/skills/postgres-patterns/SKILL.md', 'ai/shared-be/01-avoid-n-plus-1-queries.md'],
  mongoose: ['ai/shared-be/'],
  security: ['ai/vendor/ecc/skills/security-review/SKILL.md', 'ai/vendor/ecc/rules/typescript/security.md'],
  testing: ['skills/tdd/SKILL.md', 'ai/shared-fe/14-e2e-testing.md'],
  debugging: ['skills/systematic-debugging/SKILL.md'],
  review: ['ai/shared-fe/07-ai-workflow-integration.md', 'skills/fe-coding/SKILL.md'],
}

const RULES_DIR = path.resolve(HERE, '..', '..')
const rulesRootLabel = () =>
  isDir(path.join(PROJ, '.claude', 'tlm-plugin')) ? '.claude/tlm-plugin' : '${CLAUDE_PLUGIN_ROOT}'

function refsFor(name, facts) {
  const keys = {
    'code-reviewer': ['review', ...facts.stacks],
    debugger: ['debugging'],
    'security-reviewer': ['security'],
    'frontend-engineer': facts.stacks.filter((s) => FE.includes(s)),
    'mobile-engineer': facts.stacks.filter((s) => RN.includes(s)),
    'backend-engineer': facts.stacks.filter((s) => BE.includes(s)),
    'database-specialist': facts.db,
    'test-engineer': ['testing'],
    'devops-engineer': [],
  }[name] || []
  const seen = new Set()
  const refs = []
  for (const k of keys) {
    for (const r of RULE_REFS[k] || []) {
      if (seen.has(r) || !exists(path.join(RULES_DIR, r))) continue
      seen.add(r)
      refs.push(r)
    }
  }
  const root = rulesRootLabel()
  return refs.length ? refs.map((r) => `- \`${root}/${r}\``).join('\n') : '- (no house rule file for this area — follow the project\'s own conventions)'
}

function render(tpl, facts, name) {
  const checks = Object.entries(facts.checks)
    .filter(([, v]) => v)
    .map(([k, v]) => `  - ${k}: \`${v}\``)
    .join('\n') || '  - (no check scripts found in package.json — ask the user how this project is verified)'
  const vars = {
    PROJECT: facts.project,
    PM: facts.pm,
    STACK: [...facts.stacks, ...facts.db].join(', ') || 'not detected',
    TESTS: facts.tests.join(', ') || 'none detected',
    INFRA: facts.infra.join(', ') || 'none detected',
    CHECKS: checks,
    RULE_REFS: refsFor(name, facts),
    VERSION: readJson(path.join(RULES_DIR, '.claude-plugin', 'plugin.json'))?.version || 'rules copy',
  }
  return tpl.replace(/\{\{(\w+)\}\}/g, (m, k) => (k in vars ? vars[k] : m))
}

function writeAgent(name, content, { dryRun, force }) {
  const file = path.join(AGENTS_DIR, `${name}.md`)
  const rel = path.relative(PROJ, file)
  if (exists(file) && !force) return `skip   ${rel} (exists — use --force to overwrite)`
  if (dryRun) return `would write ${rel}`
  fs.mkdirSync(AGENTS_DIR, { recursive: true })
  fs.writeFileSync(file, content)
  return `wrote  ${rel}`
}

// ---------------------------------------------------------------------------
// COMMANDS

function flag(args, name) {
  const i = args.indexOf(name)
  if (i === -1) return undefined
  const v = args[i + 1]
  return v && !v.startsWith('--') ? v : true
}

function cmdDetect(args) {
  const facts = detect()
  const existing = existingAgents()
  if (args.includes('--json')) return out(JSON.stringify({ facts, existing }, null, 2))
  out(`project   ${facts.project}  (${facts.pm})`)
  out(`stack     ${facts.stacks.join(', ') || '—'}`)
  out(`data      ${facts.db.join(', ') || '—'}`)
  out(`tests     ${facts.tests.join(', ') || '—'}`)
  out(`infra     ${facts.infra.join(', ') || '—'}`)
  out(`checks    ${Object.entries(facts.checks).filter(([, v]) => v).map(([k, v]) => `${k}=${v}`).join('  ') || '—'}`)
  out(`agents    ${existing.length ? existing.map((a) => a.name).join(', ') : 'none (.claude/agents/ is empty)'}`)
}

function cmdPlan() {
  const facts = detect()
  const existing = existingAgents()
  const p = plan(facts, existing)
  out(existing.length ? `Project already has ${existing.length} agent(s); missing specialists are listed as gaps.` : 'Project has no agents — generate would create:')
  for (const s of p) out(`  ${s.exists ? '✓ have' : existing.length ? '+ gap ' : '+ new '}  ${s.name.padEnd(20)} ${s.why}`)
}

function cmdGenerate(args) {
  const dryRun = args.includes('--dry-run')
  const force = args.includes('--force')
  const only = flag(args, '--only')
  const facts = detect()
  const existing = existingAgents()
  let targets = plan(facts, existing)
  if (typeof only === 'string') {
    const want = only.split(',').map((s) => s.trim()).filter(Boolean)
    const unknown = want.filter((w) => !CATALOG.some((c) => c.name === w))
    if (unknown.length) die(`unknown specialist(s): ${unknown.join(', ')} — catalog: ${CATALOG.map((c) => c.name).join(', ')}; use \`new\` for anything else`)
    targets = want.map((name) => ({ name, why: CATALOG.find((c) => c.name === name).why(facts) || 'requested' }))
  } else if (existing.length && !args.includes('--fill-gaps')) {
    const gaps = targets.filter((t) => !t.exists)
    out(`Project already has agents (${existing.map((a) => a.name).join(', ')}). Nothing written.`)
    if (gaps.length) out(`Gaps: ${gaps.map((g) => g.name).join(', ')} — re-run with --fill-gaps or --only <names> to add them.`)
    return
  } else {
    targets = targets.filter((t) => !t.exists || force)
  }
  if (!targets.length) return out('Nothing to generate.')
  for (const t of targets) {
    const tplPath = path.join(TEMPLATES, `${t.name}.md`)
    if (!exists(tplPath)) die(`missing template ${path.relative(RULES_DIR, tplPath)}`)
    out(writeAgent(t.name, render(fs.readFileSync(tplPath, 'utf8'), facts, t.name), { dryRun, force }) + `  — ${t.why}`)
  }
  if (dryRun) return
  out('Commit .claude/agents/ so the whole team gets the same specialists.')
  if (rulesRootLabel() !== '.claude/tlm-plugin') {
    out('Note: no rules copy at .claude/tlm-plugin/ — rule paths point at ${CLAUDE_PLUGIN_ROOT}. Install the copy (/project-setup PHASE 1.5) for stable, team-wide paths.')
  }
}

function cmdNew(args) {
  const name = args[0]
  if (!name || name.startsWith('--')) die('usage: new <name> --role "<expertise>" [--tools "Read, Grep, Glob, Bash"] [--model sonnet]')
  if (!/^[a-z][a-z0-9-]{1,62}$/.test(name)) die('name must be kebab-case (a-z, 0-9, -)')
  const role = flag(args, '--role')
  if (typeof role !== 'string') die('--role "<expertise>" is required — say what this specialist knows and when to use it')
  const tools = typeof flag(args, '--tools') === 'string' ? flag(args, '--tools') : 'Read, Grep, Glob, Bash'
  const model = typeof flag(args, '--model') === 'string' ? flag(args, '--model') : 'sonnet'
  const facts = detect()
  const tpl = fs.readFileSync(path.join(TEMPLATES, '_custom.md'), 'utf8')
  const content = render(tpl, facts, name)
    .replace(/\{\{NAME\}\}/g, name)
    .replace(/\{\{ROLE\}\}/g, role.replace(/\n/g, ' '))
    .replace(/\{\{TOOLS\}\}/g, tools)
    .replace(/\{\{MODEL\}\}/g, model)
  out(writeAgent(name, content, { dryRun: args.includes('--dry-run'), force: args.includes('--force') }))
  out('Now fill the TODO sections from the repo (real paths, real commands) before relying on it.')
}

const [cmd, ...rest] = process.argv.slice(2)
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  if (cmd === 'detect') cmdDetect(rest)
  else if (cmd === 'plan') cmdPlan()
  else if (cmd === 'generate') cmdGenerate(rest)
  else if (cmd === 'new') cmdNew(rest)
  else die('usage: agents.mjs detect [--json] | plan | generate [--dry-run] [--fill-gaps] [--only a,b] [--force] | new <name> --role "..."')
}
