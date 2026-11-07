// Shared helpers for the hook / script unit tests. Hooks read a JSON payload on
// stdin and answer on stdout, so every test runs the real file as a child process.
import { spawnSync } from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

export const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..')

export function runHook(name, payload, env = {}) {
  const res = spawnSync(process.execPath, [path.join(ROOT, 'hooks', name)], {
    input: JSON.stringify(payload),
    encoding: 'utf8',
    // TLM_HOOK_VENDORED stops delegation to a vendored copy on the test machine.
    env: { ...process.env, TLM_HOOK_VENDORED: '1', CLAUDE_PROJECT_DIR: '', ...env },
  })
  const out = res.stdout.trim()
  return { status: res.status, stdout: out, json: out ? JSON.parse(out) : null, stderr: res.stderr }
}

export function runScript(rel, args, env = {}) {
  return spawnSync(process.execPath, [path.join(ROOT, rel), ...args], {
    encoding: 'utf8',
    env: { ...process.env, ...env },
  })
}

export function tmpProject(files = {}) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'tlm-test-'))
  for (const [rel, content] of Object.entries(files)) {
    const p = path.join(dir, rel)
    fs.mkdirSync(path.dirname(p), { recursive: true })
    fs.writeFileSync(p, typeof content === 'string' ? content : JSON.stringify(content))
  }
  return dir
}
