import { test } from 'node:test'
import assert from 'node:assert/strict'
import path from 'node:path'
import { runHook, tmpProject } from './helpers.mjs'

function lint(rel, source) {
  const dir = tmpProject({ [rel]: source })
  return runHook('lint-fe.mjs', { tool_input: { file_path: path.join(dir, rel) } })
}
const ctx = (r) => r.json?.hookSpecificOutput?.additionalContext ?? ''

test('flags hard-rule violations', () => {
  const c = ctx(lint('src/X.tsx', 'const a = b as any\nconst el = <div>x</div>\nrouter.push("/a")\nconst c = "#ff0000"\n'))
  for (const re of [/as any/, /raw HTML/, /router\.push/, /hardcoded hex/]) assert.match(c, re)
})

test('flags security patterns, respects a sanitizer', () => {
  assert.match(ctx(lint('src/H.tsx', '<BaseView dangerouslySetInnerHTML={{ __html: x }} />\n')), /dangerouslySetInnerHTML/)
  assert.equal(lint('src/H.tsx', 'import DOMPurify from "dompurify"\n<BaseView dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(x) }} />\n').stdout, '')
  assert.match(ctx(lint('src/e.ts', 'const r = eval(code)\n')), /eval/)
  assert.match(ctx(lint('src/cfg.ts', 'const s = process.env.NEXT_PUBLIC_STRIPE_SECRET\n')), /NEXT_PUBLIC_/)
})

test('silent on clean code and on exempt files', () => {
  assert.equal(lint('src/ok.ts', 'export const add = (a: number, b: number) => a + b\n').stdout, '')
  assert.equal(lint('src/BaseBox.tsx', 'export const BaseBox = () => <div />\n').stdout, '')
  assert.equal(lint('src/theme/colors.ts', 'export const red = "#ff0000"\n').stdout, '')
  assert.equal(lint('src/a.test.ts', 'const a = b as any\n').stdout, '')
})
