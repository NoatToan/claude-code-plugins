#!/usr/bin/env node
// Refresh ai/vendor/ecc/ from upstream ECC (https://github.com/affaan-m/ECC, MIT).
//
// The house rules (ai/nestjs/, ai/shared-be/README.md) REFERENCE these files by path instead of
// re-writing them, so an ECC update reaches every rule that points here the moment this script runs.
// Files land at the same relative path they have upstream, which keeps those references stable.
//
//   node ai/vendor/ecc/sync-ecc.mjs            # fetch upstream, copy every manifest path, write ecc.lock.json
//   node ai/vendor/ecc/sync-ecc.mjs --check    # report what would change; writes nothing, exits 1 on drift
//   node ai/vendor/ecc/sync-ecc.mjs --from <dir>   # use an existing ECC checkout instead of cloning
//
// Env:
//   ECC_REF        branch/tag/commit to copy (default: manifest "ref")
//   ECC_CACHE_DIR  where the upstream checkout lives (default: ~/.cache/tlm-ecc/ECC) — never this folder
//
// Node + git only (no bash/rsync), so it runs the same on Windows, macOS and Linux.

import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'

const HERE = path.dirname(fileURLToPath(import.meta.url))
const MANIFEST = JSON.parse(fs.readFileSync(path.join(HERE, 'ecc.manifest.json'), 'utf8'))
const LOCK = path.join(HERE, 'ecc.lock.json')
// Files in this folder that are ours, not ECC's — never treated as stale.
const OWN = new Set(['ecc.manifest.json', 'ecc.lock.json', 'sync-ecc.mjs', 'PROVENANCE.md'])

const args = process.argv.slice(2)
const CHECK = args.includes('--check')
const fromAt = args.indexOf('--from')
const FROM = fromAt !== -1 ? path.resolve(args[fromAt + 1] ?? '') : null
const REF = process.env.ECC_REF || MANIFEST.ref
const CACHE = process.env.ECC_CACHE_DIR || path.join(os.homedir(), '.cache', 'tlm-ecc', 'ECC')

function die(msg) {
  process.stderr.write(`sync-ecc: ${msg}\n`)
  process.exit(2)
}

function git(cwd, ...gitArgs) {
  const r = spawnSync('git', gitArgs, { cwd, encoding: 'utf8' })
  if (r.status !== 0) die(`git ${gitArgs.join(' ')} failed:\n${r.stderr || r.stdout}`)
  return r.stdout.trim()
}

function checkout() {
  if (FROM) {
    if (!fs.existsSync(path.join(FROM, '.git'))) die(`--from ${FROM} is not a git checkout`)
    return FROM
  }
  if (fs.existsSync(path.join(CACHE, '.git'))) {
    git(CACHE, 'fetch', '--quiet', '--depth', '1', 'origin', REF)
    git(CACHE, 'checkout', '--quiet', '--force', 'FETCH_HEAD')
  } else {
    fs.mkdirSync(path.dirname(CACHE), { recursive: true })
    git(path.dirname(CACHE), 'clone', '--quiet', '--depth', '1', '--branch', REF, MANIFEST.upstream, CACHE)
  }
  return CACHE
}

function listVendored(dir, rel = '') {
  const out = []
  for (const e of fs.readdirSync(path.join(dir, rel), { withFileTypes: true })) {
    const r = rel ? `${rel}/${e.name}` : e.name
    if (e.isDirectory()) out.push(...listVendored(dir, r))
    else if (!OWN.has(r)) out.push(r)
  }
  return out
}

const src = checkout()
const commit = git(src, 'rev-parse', 'HEAD')
const version = fs.existsSync(path.join(src, 'VERSION')) ? fs.readFileSync(path.join(src, 'VERSION'), 'utf8').trim() : null

const wanted = new Set(MANIFEST.paths)
const changes = []

for (const rel of wanted) {
  const from = path.join(src, rel)
  if (!fs.existsSync(from)) die(`${rel} is in the manifest but not in ECC @ ${commit.slice(0, 7)} — upstream moved or removed it; fix ecc.manifest.json`)
  const to = path.join(HERE, rel)
  const next = fs.readFileSync(from)
  const prev = fs.existsSync(to) ? fs.readFileSync(to) : null
  if (prev && prev.equals(next)) continue
  changes.push(`${prev ? 'update' : 'add   '} ${rel}`)
  if (!CHECK) {
    fs.mkdirSync(path.dirname(to), { recursive: true })
    fs.writeFileSync(to, next)
  }
}

for (const rel of listVendored(HERE)) {
  if (wanted.has(rel)) continue
  changes.push(`remove ${rel}`)
  if (!CHECK) fs.rmSync(path.join(HERE, rel))
}

if (!CHECK) {
  // Drop directories the removals left empty.
  const prune = (d) => {
    for (const e of fs.readdirSync(d, { withFileTypes: true })) if (e.isDirectory()) prune(path.join(d, e.name))
    if (d !== HERE && fs.readdirSync(d).length === 0) fs.rmdirSync(d)
  }
  prune(HERE)
  const prevLock = fs.existsSync(LOCK) ? JSON.parse(fs.readFileSync(LOCK, 'utf8')) : {}
  if (changes.length || prevLock.commit !== commit) {
    const lock = { upstream: MANIFEST.upstream, ref: REF, commit, version, syncedOn: new Date().toISOString().slice(0, 10) }
    fs.writeFileSync(LOCK, JSON.stringify(lock, null, 2) + '\n')
  }
}

const head = `ECC ${version ?? '?'} @ ${commit.slice(0, 7)}`
if (!changes.length) {
  process.stdout.write(`${head} — ai/vendor/ecc is up to date.\n`)
} else {
  process.stdout.write(`${head} — ${CHECK ? 'would change' : 'changed'}:\n  ${changes.join('\n  ')}\n`)
  if (!CHECK) process.stdout.write('Review the diff against ai/nestjs/README.md and ai/shared-be/README.md (house overrides), then commit.\n')
}
process.exit(CHECK && changes.length ? 1 : 0)
