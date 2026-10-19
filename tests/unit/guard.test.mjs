import { test } from 'node:test'
import assert from 'node:assert/strict'
import { runHook } from './helpers.mjs'

const bash = (command) => runHook('guard.mjs', { tool_name: 'Bash', tool_input: { command } })
const write = (file_path, content) => runHook('guard.mjs', { tool_name: 'Write', tool_input: { file_path, content } })
const decision = (r) => r.json?.hookSpecificOutput?.permissionDecision ?? 'none'

test('rm -rf on the whole tree is denied, on a named dir allowed', () => {
  for (const c of ['rm -rf /', 'rm -rf ~', 'rm -fr .', 'rm -rf *', 'cd x && rm -rf $HOME']) assert.equal(decision(bash(c)), 'deny', c)
  for (const c of ['rm -rf node_modules', 'rm -rf .next dist', 'rm -rf ./build']) assert.equal(decision(bash(c)), 'none', c)
})

test('force-push: protected branch denied, other branch asks, lease allowed', () => {
  assert.equal(decision(bash('git push --force origin main')), 'deny')
  assert.equal(decision(bash('git push -f origin develop')), 'deny')
  assert.equal(decision(bash('git push --force origin feat/x')), 'ask')
  assert.equal(decision(bash('git push --force-with-lease origin feat/x')), 'none')
  assert.equal(decision(bash('git push origin main')), 'none')
})

test('destructive git / db commands ask', () => {
  for (const c of ['git reset --hard HEAD~1', 'git clean -fd', 'git checkout -- .', 'git commit -m x --no-verify', 'pnpm prisma migrate reset', 'psql -c "DROP TABLE users"']) {
    assert.equal(decision(bash(c)), 'ask', c)
  }
  assert.equal(decision(bash('git status && pnpm test')), 'none')
})

test('secret literals in source are denied', () => {
  // Built at runtime so this test file itself never contains a key-shaped literal.
  const fake = 'AKIA' + 'ABCDEFGHIJKLMNOP'
  assert.equal(decision(write('/p/src/aws.ts', `const k = "${fake}"`)), 'deny')
  assert.equal(decision(write('/p/src/k.ts', '-----BEGIN RSA ' + 'PRIVATE KEY-----')), 'deny')
  assert.equal(decision(write('/p/src/db.ts', 'const u = "postgres://app:' + 's3cretpw@db.example.com/x"')), 'deny')
  assert.equal(decision(write('/p/src/db.ts', 'const u = "postgres://app:pw@localhost/x"')), 'none')
  assert.equal(decision(write('/p/src/ok.ts', 'const k = process.env.API_KEY')), 'none')
})

test('env-file writes ask, examples pass', () => {
  const env = '.e' + 'nv'
  assert.equal(decision(write(`/p/${env}.local`, 'X=1')), 'ask')
  assert.equal(decision(write(`/p/${env}`, 'X=1')), 'ask')
  assert.equal(decision(write(`/p/${env}.example`, 'X=')), 'none')
})

test('TLM_GUARD=0 disables it', () => {
  const r = runHook('guard.mjs', { tool_name: 'Bash', tool_input: { command: 'rm -rf /' } }, { TLM_GUARD: '0' })
  assert.equal(r.stdout, '')
})
