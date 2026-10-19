import { test } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { ROOT } from './helpers.mjs'

const json = (rel) => JSON.parse(fs.readFileSync(path.join(ROOT, rel), 'utf8'))

test('version is in lockstep across the three manifest fields', () => {
  const v = json('.claude-plugin/plugin.json').version
  const m = json('.claude-plugin/marketplace.json')
  assert.equal(m.metadata.version, v)
  assert.equal(m.plugins[0].version, v)
})

test('every hook in hooks.json exists; every skill and agent has frontmatter', () => {
  for (const groups of Object.values(json('hooks/hooks.json').hooks)) {
    for (const g of groups) {
      for (const h of g.hooks) {
        const file = h.args[0].replace('${CLAUDE_PLUGIN_ROOT}/', '')
        assert.ok(fs.existsSync(path.join(ROOT, file)), file)
      }
    }
  }
  for (const d of fs.readdirSync(path.join(ROOT, 'skills'))) {
    const s = fs.readFileSync(path.join(ROOT, 'skills', d, 'SKILL.md'), 'utf8')
    assert.match(s, new RegExp(`^---\\nname: ${d}\\ndescription: .+`), d)
  }
  for (const f of fs.readdirSync(path.join(ROOT, 'agents'))) {
    assert.match(fs.readFileSync(path.join(ROOT, 'agents', f), 'utf8'), /^---\nname: [a-z-]+\ndescription: .+/, f)
  }
})

test('the config reference parses and lists the new skills', () => {
  const req = json('setup/tlm-config.reference.json').skillRequirements
  for (const s of ['agent-setup', 'systematic-debugging', 'tdd']) assert.ok(req[s], s)
})
