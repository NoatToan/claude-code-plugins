import { test } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { runScript, tmpProject } from './helpers.mjs'

const S = 'skills/agent-setup/agents.mjs'
const run = (dir, ...args) => runScript(S, args, { TLM_PROJECT_DIR: dir })
const agents = (dir) => {
  try {
    return fs.readdirSync(path.join(dir, '.claude', 'agents')).sort()
  } catch {
    return []
  }
}

const NEXT_PRISMA = {
  'package.json': { name: 'demo', scripts: { typecheck: 'tsc', test: 'vitest' }, dependencies: { next: '15', react: '19', '@prisma/client': '6' }, devDependencies: { vitest: '2' } },
  'pnpm-lock.yaml': '',
  'pages/api/x.ts': '',
  'prisma/schema.prisma': '',
}

test('detect reads stack, data layer, tests and checks', () => {
  const { facts, existing } = JSON.parse(run(tmpProject(NEXT_PRISMA), 'detect', '--json').stdout)
  assert.deepEqual(facts.stacks, ['nextjs-page-router', 'nextjs-api'])
  assert.deepEqual(facts.db, ['prisma'])
  assert.deepEqual(facts.tests, ['vitest'])
  assert.equal(facts.checks.typecheck, 'pnpm run typecheck')
  assert.deepEqual(existing, [])
})

test('detect sees a NestJS service and an Expo app inside a monorepo', () => {
  const dir = tmpProject({
    'package.json': { name: 'mono', devDependencies: { turbo: '2' } },
    'apps/api/package.json': { dependencies: { '@nestjs/core': '10', typeorm: '0.3' } },
    'apps/mobile/package.json': { dependencies: { expo: '52', 'expo-router': '4', 'react-native': '0.76' } },
  })
  const { facts } = JSON.parse(run(dir, 'detect', '--json').stdout)
  assert.ok(facts.stacks.includes('nestjs'))
  assert.ok(facts.stacks.includes('react-native-expo'))
  assert.deepEqual(facts.db, ['typeorm'])
})

test('generate creates a stack-fitted team when there are no agents', () => {
  const dir = tmpProject(NEXT_PRISMA)
  assert.equal(run(dir, 'generate', '--dry-run').status, 0)
  assert.deepEqual(agents(dir), [], 'dry-run writes nothing')
  run(dir, 'generate')
  const got = agents(dir)
  for (const a of ['code-reviewer.md', 'debugger.md', 'security-reviewer.md', 'frontend-engineer.md', 'backend-engineer.md', 'database-specialist.md', 'test-engineer.md']) assert.ok(got.includes(a), a)
  assert.ok(!got.includes('mobile-engineer.md'), 'no RN in deps → no mobile agent')
  for (const f of got) {
    const body = fs.readFileSync(path.join(dir, '.claude', 'agents', f), 'utf8')
    assert.match(body, /^---\nname: [a-z-]+\ndescription: .+\n/, f)
    assert.doesNotMatch(body, /\{\{\w+\}\}/, `${f} has unrendered placeholders`)
  }
})

test('with existing agents it only reports gaps unless asked, and never overwrites', () => {
  const dir = tmpProject({ ...NEXT_PRISMA, '.claude/agents/mine.md': '---\nname: my-reviewer\ndescription: x\n---\n' })
  assert.match(run(dir, 'generate').stdout, /Nothing written/)
  assert.deepEqual(agents(dir), ['mine.md'])
  run(dir, 'generate', '--only', 'debugger')
  assert.deepEqual(agents(dir), ['debugger.md', 'mine.md'])
  fs.writeFileSync(path.join(dir, '.claude/agents/debugger.md'), 'edited')
  run(dir, 'generate', '--fill-gaps')
  assert.equal(fs.readFileSync(path.join(dir, '.claude/agents/debugger.md'), 'utf8'), 'edited')
  assert.notEqual(run(dir, 'generate', '--only', 'nope').status, 0)
})

test('new scaffolds a custom specialist and validates input', () => {
  const dir = tmpProject(NEXT_PRISMA)
  assert.notEqual(run(dir, 'new', 'Bad Name', '--role', 'x').status, 0)
  assert.notEqual(run(dir, 'new', 'payments').status, 0, '--role is required')
  assert.equal(run(dir, 'new', 'payments', '--role', 'Stripe payments and webhooks').status, 0)
  const body = fs.readFileSync(path.join(dir, '.claude/agents/payments.md'), 'utf8')
  assert.match(body, /name: payments\ndescription: Stripe payments and webhooks/)
  assert.doesNotMatch(body, /\{\{\w+\}\}/)
})

test('every catalog entry has a template', async () => {
  const { CATALOG } = await import('../../skills/agent-setup/agents.mjs')
  for (const c of CATALOG) assert.ok(fs.existsSync(new URL(`../../skills/agent-setup/templates/${c.name}.md`, import.meta.url)), c.name)
})
