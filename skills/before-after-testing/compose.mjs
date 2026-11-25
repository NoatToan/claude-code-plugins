#!/usr/bin/env node
// Composes the before/after evidence of ONE case into one page: a title band, captions, then a row per screen with
// design → before → after columns and the changed element boxed (red on before, green on after, blue on design).
// See ai/shared-fe/21-before-after-evidence.md and skills/before-after-testing/SKILL.md.
//
//   node compose.mjs <case.json> [--html out.html] [--png out.png] [--width 2400]
//
// <case.json> (paths relative to it):
//   {
//     "title": "<KEY>: <the case in a few words>",
//     "captions": ["Expected: …", "Before: …", "After: …", "Data: …"],
//     "labels": { "design": "Design", "before": "Before (current build)", "after": "After (this change)" },
//     "rows": [
//       { "name": "Desktop 1440", "design": "design.png", "designLink": "<design node url>",
//         "before": "before-x.png", "after": "after-x.png", "beforeNote": "…", "afterNote": "…" },
//       { "name": "Mobile 390", "design": null, "designNote": "no frame draws this", "before": "…", "after": "…" }
//     ]
//   }
// A screenshot's sidecar `<name>.box.json` — [{ "x", "y", "w", "h", "label"? }] in that image's pixels, from
// Playwright's locator.boundingBox() — is drawn on it. The design column appears when any row has a `design` key.
// The PNG is rendered with the Playwright the current project already has; without one, only the HTML is written.

import fs from 'node:fs'
import path from 'node:path'
import { createRequire } from 'node:module'
import { pathToFileURL } from 'node:url'

const COLOURS = { design: '#2563eb', before: '#c81e1e', after: '#14823c' }
const DEFAULT_LABELS = { design: 'Design', before: 'Before (current build)', after: 'After (this change)' }

/** Pixel size of a PNG or JPEG buffer, or null for another format. */
export function imageSize(buf) {
  if (buf.length > 24 && buf.readUInt32BE(0) === 0x89504e47) return { w: buf.readUInt32BE(16), h: buf.readUInt32BE(20) }
  if (buf.length > 4 && buf[0] === 0xff && buf[1] === 0xd8) {
    let i = 2
    while (i + 9 < buf.length) {
      if (buf[i] !== 0xff) return null
      const marker = buf[i + 1]
      const len = buf.readUInt16BE(i + 2)
      // SOF0..SOF15 carry the frame size, except DHT (C4), JPG (C8) and DAC (CC).
      if (marker >= 0xc0 && marker <= 0xcf && ![0xc4, 0xc8, 0xcc].includes(marker)) return { w: buf.readUInt16BE(i + 7), h: buf.readUInt16BE(i + 5) }
      i += 2 + len
    }
  }
  return null
}

/** A box in image pixels → CSS percentages of that image, so it stays on the element at any rendered width. */
export function boxStyle(box, size) {
  const pct = (v, of) => `${((v / of) * 100).toFixed(3)}%`
  return `left:${pct(box.x, size.w)};top:${pct(box.y, size.h)};width:${pct(box.w, size.w)};height:${pct(box.h, size.h)}`
}

const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c])
const MIME = { '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.webp': 'image/webp' }

function readShot(file, baseDir) {
  const abs = path.resolve(baseDir, file)
  const buf = fs.readFileSync(abs)
  const sidecar = abs.replace(/\.[^.]+$/, '.box.json')
  const boxes = fs.existsSync(sidecar) ? JSON.parse(fs.readFileSync(sidecar, 'utf8')) : []
  const size = imageSize(buf)
  if (boxes.length && !size) throw new Error(`${file}: boxes need a PNG or JPEG to be placed`)
  return { src: `data:${MIME[path.extname(abs).toLowerCase()] ?? 'image/png'};base64,${buf.toString('base64')}`, size, boxes }
}

function cell(side, file, note, link, baseDir, read) {
  const colour = COLOURS[side]
  if (!file) return `<div class="cell empty"><p>${esc(note || 'no image')}</p></div>`
  const shot = read(file, baseDir)
  const boxes = shot.boxes
    .map((b) => `<div class="box" style="${boxStyle(b, shot.size)};border-color:${colour}">${b.label ? `<span style="background:${colour}">${esc(b.label)}</span>` : ''}</div>`)
    .join('')
  const foot = [note && esc(note), link && `<a href="${esc(link)}">${esc(link)}</a>`].filter(Boolean).join(' · ')
  return `<div class="cell"><div class="shot"><img src="${shot.src}" alt="${esc(side)}">${boxes}</div>${foot ? `<p>${foot}</p>` : ''}</div>`
}

/** The composed page for one case. `read` is injectable for tests. */
export function renderHtml(spec, baseDir = '.', read = readShot) {
  if (!spec?.title) throw new Error('case.json needs a "title"')
  if (!Array.isArray(spec.rows) || !spec.rows.length) throw new Error('case.json needs at least one row')
  for (const [i, r] of spec.rows.entries()) if (!r.before || !r.after) throw new Error(`row ${i + 1} needs "before" and "after"`)
  const sides = spec.rows.some((r) => 'design' in r) ? ['design', 'before', 'after'] : ['before', 'after']
  const labels = { ...DEFAULT_LABELS, ...spec.labels }
  const head = sides.map((s) => `<div class="label" style="color:${COLOURS[s]}">${esc(labels[s])}</div>`).join('')
  const rows = spec.rows
    .map((r) => {
      const cells = sides.map((s) => cell(s, r[s], r[`${s}Note`], r[`${s}Link`], baseDir, read)).join('')
      return `${r.name ? `<h2>${esc(r.name)}</h2>` : ''}<div class="row">${cells}</div>`
    })
    .join('')
  const captions = (spec.captions ?? []).map((c) => `<li>${esc(c)}</li>`).join('')
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><title>${esc(spec.title)}</title><style>
body{margin:0;font:16px/1.4 -apple-system,"Segoe UI",Roboto,Arial,sans-serif;color:#101828;background:#fff}
header{background:#f2f7ff;padding:20px 24px}h1{margin:0 0 8px;font-size:26px}ul{margin:0;padding-left:20px;color:#344054}
main{padding:16px 24px 24px}h2{font-size:17px;margin:20px 0 8px}
.row,.head{display:grid;grid-template-columns:repeat(${sides.length},minmax(0,1fr));gap:16px;align-items:start}
.label{font-weight:700;font-size:18px}.shot{position:relative;border:1px solid #d0d5dd}.shot img{display:block;width:100%;height:auto}
.box{position:absolute;border:4px solid;outline:2px solid #fff;box-sizing:border-box}
.box span{position:absolute;left:-4px;top:-30px;color:#fff;font-size:14px;font-weight:700;padding:3px 8px;white-space:nowrap}
.cell p{margin:6px 0 0;font-size:14px;color:#475467;word-break:break-all}
.empty{border:1px dashed #98a2b3;min-height:120px;display:flex;align-items:center;justify-content:center;text-align:center}
.empty p{margin:0;padding:12px;font-style:italic}
</style></head><body><header><h1>${esc(spec.title)}</h1>${captions ? `<ul>${captions}</ul>` : ''}</header>
<main><div class="head">${head}</div>${rows}</main></body></html>`
}

async function loadPlaywright(fromDir) {
  const req = createRequire(path.join(fromDir, 'noop.js'))
  for (const name of ['playwright', '@playwright/test', 'playwright-core']) {
    try {
      return await import(pathToFileURL(req.resolve(name)).href)
    } catch {
      /* try the next one */
    }
  }
  return null
}

async function main(argv) {
  const opt = (k) => (argv.includes(k) ? argv[argv.indexOf(k) + 1] : undefined)
  const file = argv.find((a, i) => !a.startsWith('--') && !argv[i - 1]?.startsWith('--'))
  if (!file) {
    console.error('usage: node compose.mjs <case.json> [--html out.html] [--png out.png] [--width 2400]')
    return 1
  }
  const abs = path.resolve(file)
  const stem = abs.replace(/\.json$/i, '')
  const html = path.resolve(opt('--html') ?? `${stem}.html`)
  const png = path.resolve(opt('--png') ?? `${stem}.png`)
  fs.writeFileSync(html, renderHtml(JSON.parse(fs.readFileSync(abs, 'utf8')), path.dirname(abs)))
  console.log(html)
  const pw = await loadPlaywright(process.cwd())
  const chromium = pw?.chromium ?? pw?.default?.chromium
  if (!chromium) {
    console.warn('PNG skipped: no Playwright in this project. Run from the project that has it, or screenshot the HTML.')
    return 0
  }
  const browser = await chromium.launch()
  try {
    const page = await browser.newPage({ viewport: { width: Number(opt('--width') ?? 2400), height: 200 } })
    await page.goto(pathToFileURL(html).href)
    await page.screenshot({ path: png, fullPage: true })
  } finally {
    await browser.close() // never leave a browser behind (ai/shared-fe/14-e2e-testing.md §7)
  }
  console.log(png)
  return 0
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  main(process.argv.slice(2)).then(
    (code) => process.exit(code),
    (err) => {
      console.error(String(err?.message ?? err))
      process.exit(1)
    },
  )
}
