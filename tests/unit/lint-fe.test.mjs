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

test('flags onClick on a non-control without cursor-pointer, multi-line tags included', () => {
  const src = 'export const A = () => (\n  <li\n    role="option"\n    onClick={() => pick(1)}\n    className="px-2"\n  >x</li>\n)\n'
  assert.match(ctx(lint('src/A.tsx', src)), /onClick on a non-control <li>/)
  assert.doesNotMatch(ctx(lint('src/B.tsx', '<li onClick={() => pick(1)} className="cursor-pointer px-2">x</li>\n')), /non-control/)
  assert.doesNotMatch(ctx(lint('src/C.tsx', '<div aria-hidden className="fixed inset-0" onClick={onClose} />\n')), /non-control/)
  assert.doesNotMatch(ctx(lint('src/D.tsx', '<button onClick={() => go()}>Go</button>\n')), /non-control/)
})

test('flags an in-flow dropdown, accepts a portalled one', () => {
  const inflow = '<div className="relative">\n  {open ? <div className="absolute top-full z-50">\n    <ul role="listbox" />\n  </div> : null}\n</div>\n'
  assert.match(ctx(lint('src/Select.tsx', inflow)), /rendered in-flow/)
  const portalled = 'import { createPortal } from "react-dom"\n' + inflow
  assert.doesNotMatch(ctx(lint('src/Select.tsx', portalled)), /rendered in-flow/)
})

test('flags a Tailwind v4 stylesheet without the pointer-cursor base rule', () => {
  assert.match(ctx(lint('src/app/globals.css', '@import "tailwindcss";\nbody { margin: 0 }\n')), /cursor: pointer/)
  const ok = '@import "tailwindcss";\n@layer base { button, [role="option"] { cursor: pointer; } }\n'
  assert.equal(lint('src/app/globals.css', ok).stdout, '')
  assert.equal(lint('src/app/plain.css', 'body { margin: 0 }\n').stdout, '')
})
