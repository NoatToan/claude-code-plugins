import { test } from 'node:test'
import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { ROOT } from './helpers.mjs'

const SCRIPT = path.join(ROOT, 'skills/before-after-testing/compose.mjs')
const { imageSize, boxStyle, renderHtml } = await import(SCRIPT)

/** A minimal PNG header of the given size (enough for imageSize and a data URI). */
const png = (w, h) => {
  const b = Buffer.alloc(33)
  b.writeUInt32BE(0x89504e47, 0)
  b.writeUInt32BE(0x0d0a1a0a, 4)
  b.writeUInt32BE(13, 8)
  b.write('IHDR', 12)
  b.writeUInt32BE(w, 16)
  b.writeUInt32BE(h, 20)
  return b
}

test('imageSize reads PNG and JPEG dimensions', () => {
  assert.deepEqual(imageSize(png(1440, 900)), { w: 1440, h: 900 })
  // SOI, APP0 (len 16), SOF0 with height 300 and width 400
  const jpeg = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, ...Array(14).fill(0), 0xff, 0xc0, 0x00, 0x11, 0x08, 0x01, 0x2c, 0x01, 0x90, 0x03])
  assert.deepEqual(imageSize(jpeg), { w: 400, h: 300 })
  assert.equal(imageSize(Buffer.from('GIF89a')), null)
})

test('boxStyle places a pixel box as percentages of its image', () => {
  assert.equal(boxStyle({ x: 144, y: 90, w: 720, h: 45 }, { w: 1440, h: 900 }), 'left:10.000%;top:10.000%;width:50.000%;height:5.000%')
})

test('renderHtml: design column only when a row has a design key; empty design cell says why', () => {
  const read = (file) => ({ src: `data:${file}`, size: { w: 100, h: 100 }, boxes: file.startsWith('after') ? [{ x: 10, y: 10, w: 20, h: 20, label: 'Total' }] : [] })
  const two = renderHtml({ title: 'K-1: case', rows: [{ before: 'before.png', after: 'after.png' }] }, '.', read)
  assert.match(two, /repeat\(2,/)
  assert.doesNotMatch(two, />Design</)
  assert.match(two, /#14823c">Total</)

  const three = renderHtml(
    { title: 'K-1: <case>', captions: ['Expected: x & y'], rows: [{ name: 'Mobile', design: null, designNote: 'no frame draws this', before: 'before.png', after: 'after.png' }] },
    '.',
    read,
  )
  assert.match(three, /repeat\(3,/)
  assert.match(three, /no frame draws this/)
  assert.match(three, /K-1: &lt;case&gt;/)
  assert.match(three, /Expected: x &amp; y/)
})

test('renderHtml refuses a case without a title, rows, or a before/after pair', () => {
  assert.throws(() => renderHtml({ rows: [{ before: 'a', after: 'b' }] }), /title/)
  assert.throws(() => renderHtml({ title: 't', rows: [] }), /row/)
  assert.throws(() => renderHtml({ title: 't', rows: [{ before: 'a' }] }), /before.*after/)
})

test('the CLI writes a self-contained HTML with the sidecar box', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'ba-compose-'))
  fs.writeFileSync(path.join(dir, 'before-x.png'), png(200, 100))
  fs.writeFileSync(path.join(dir, 'after-x.png'), png(200, 100))
  fs.writeFileSync(path.join(dir, 'after-x.box.json'), JSON.stringify([{ x: 20, y: 10, w: 100, h: 50, label: 'Row' }]))
  fs.writeFileSync(path.join(dir, 'case.json'), JSON.stringify({ title: 'K-2: row shows', rows: [{ before: 'before-x.png', after: 'after-x.png' }] }))
  // cwd = the temp dir: no Playwright there, so only the HTML is written.
  execFileSync(process.execPath, [SCRIPT, 'case.json'], { cwd: dir, stdio: 'pipe' })
  const html = fs.readFileSync(path.join(dir, 'case.html'), 'utf8')
  assert.match(html, /data:image\/png;base64,/)
  assert.match(html, /left:10\.000%;top:10\.000%;width:50\.000%;height:50\.000%/)
  assert.equal(fs.existsSync(path.join(dir, 'case.png')), false)
})
