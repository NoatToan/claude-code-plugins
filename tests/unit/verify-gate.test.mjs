import { test } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { runHook, tmpProject } from './helpers.mjs'

const user = (text) => ({ type: 'user', message: { role: 'user', content: text } })
const toolResult = () => ({ type: 'user', message: { role: 'user', content: [{ type: 'tool_result', tool_use_id: 't', content: 'ok' }] } })
const use = (name, input) => ({ type: 'assistant', message: { role: 'assistant', content: [{ type: 'tool_use', id: 't', name, input }] } })

function gate(entries, { files = {}, extra = {}, env = {} } = {}) {
  const dir = tmpProject({ 'package.json': { scripts: { typecheck: 'tsc --noEmit', lint: 'eslint .' } }, 'pnpm-lock.yaml': '', ...files })
  const transcript = path.join(dir, 't.jsonl')
  fs.writeFileSync(transcript, entries.map((e) => JSON.stringify(e)).join('\n'))
  return runHook('verify-gate.mjs', { cwd: dir, transcript_path: transcript, stop_hook_active: false, ...extra }, env)
}

test('blocks when code was edited and no check ran', () => {
  const r = gate([user('add x'), use('Edit', { file_path: '/p/src/a.ts' }), toolResult()])
  assert.equal(r.json?.decision, 'block')
  assert.match(r.json.reason, /pnpm run typecheck/)
  assert.match(r.json.reason, /src\/a\.ts/)
})

test('passes when a check ran after the last edit', () => {
  const r = gate([user('add x'), use('Write', { file_path: '/p/src/a.tsx' }), toolResult(), use('Bash', { command: 'pnpm run typecheck' }), toolResult()])
  assert.equal(r.stdout, '')
})

test('blocks when an edit came after the check', () => {
  const r = gate([user('x'), use('Edit', { file_path: '/p/a.ts' }), use('Bash', { command: 'npx tsc --noEmit' }), use('Edit', { file_path: '/p/b.ts' })])
  assert.equal(r.json?.decision, 'block')
})

test('ignores non-code edits and earlier turns', () => {
  assert.equal(gate([user('docs'), use('Edit', { file_path: '/p/README.md' })]).stdout, '')
  assert.equal(gate([user('a'), use('Edit', { file_path: '/p/a.ts' }), user('just a question')]).stdout, '')
})

test('lets through on re-entry, env opt-out and config opt-out', () => {
  const t = [user('x'), use('Edit', { file_path: '/p/a.ts' })]
  assert.equal(gate(t, { extra: { stop_hook_active: true } }).stdout, '')
  assert.equal(gate(t, { env: { TLM_VERIFY_GATE: '0' } }).stdout, '')
  assert.equal(gate(t, { files: { '.claude/settings.local.json': { tlm: { quality: { verifyGate: false } } } } }).stdout, '')
})
