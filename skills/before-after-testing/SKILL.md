---
name: before-after-testing
description: Proves a fix, redesign or migration end to end with before/after evidence — one automated spec run against the current build (must fail on the issue) and against the change (must pass), then one composed image per case (design → before → after, captioned, changed element boxed) posted where the work is reviewed. TRIGGER on "before/after", "before after", "test lại trước/sau", "so sánh trước và sau", "evidence", "verify the fix end to end", "chứng minh đã fix", "ảnh before after", "QC bug verify", a client feedback round's verify step, and whenever a bug fix or visual change is about to be reported as done.
---

# Before/after testing

A claim with no artifact proves nothing, and a folder of loose screenshots only makes sense to whoever took them.
The evidence of an end-to-end check is **one composed image per case**, from **one spec run twice**: before fails on
the issue, after passes. Full rule and its reasons: `ai/shared-fe/21-before-after-evidence.md` — read it once per
session before the first run.

**Scope → cases → one spec → run before → run after → classify → compose → look → post → clean up**

---

## STEP 0 — Does it apply?

Applies to every change with something observable end to end: a bug fix, a redesign, a copy or layout change, an
export, a migration a user can see. **Skip** a change with nothing observable (refactor, log line, internal job with
no visible output) and **say so in the report** — never post an empty or a passing "before".

A round of client feedback is processed as a batch first (`ai/shared-fe/22-client-feedback-rounds.md`): trace each
item to its source and ask the open questions before coding; this skill is its verify step.

## STEP 1 — Cases, data, targets (write them down before running anything)

For each case, one line each:

- **Expected** — the result the ticket / feedback / spec states, in its words. This is the spec's assertion.
- **Data** — the account, record, dates the reporter used. Same data on both sides.
- **Before** = the build people run today (production, or staging before the deploy), on that data. It must
  **reproduce** the issue. **After** = the change (local branch, preview, or staging after the deploy).
- **Design** — the frame that draws this screen, exported from the design tool itself with its node link (the
  `figma-to-code` route, never a screenshot of someone's screen). No frame covers it → write "no frame draws this".
- **Viewports** — every device size the change targets (desktop and the real mobile width), not only the default.

Read-only on any production target: no writes, no test data created there. Credentials never go in a spec, a
screenshot, a caption or a comment — sign in through the project's auth setup, not typed values.

## STEP 2 — One spec, two runs

Use the project's own e2e runner (`ai/shared-fe/14-e2e-testing.md`; never add a second runner). One spec per case
group, the target chosen by an env var, the screenshots prefixed by side so the runs never overwrite each other:

```ts
// evidence.ts — helper the spec imports
import fs from 'node:fs'
import type { Locator, Page } from '@playwright/test'

export const SIDE = process.env.EVIDENCE_SIDE === 'after' ? 'after' : 'before'

/** Full-page screenshot `<side>-<name>.png` + a sidecar box per area a reviewer compares. */
export async function evidenceShot(page: Page, name: string, areas: { locator: Locator; label: string }[] = []) {
  const file = `evidence/${SIDE}-${name}.png`
  await page.screenshot({ path: file, fullPage: true })
  const scroll = await page.evaluate(() => ({ x: window.scrollX, y: window.scrollY }))
  const boxes = []
  for (const a of areas) {
    const box = await a.locator.first().boundingBox()
    if (box) boxes.push({ x: box.x + scroll.x, y: box.y + scroll.y, w: box.width, h: box.height, label: a.label })
  }
  if (boxes.length) fs.writeFileSync(file.replace(/\.png$/, '.box.json'), JSON.stringify(boxes))
}
```

- The spec asserts **Expected** — the same assertion on both runs. Take the screenshot **before** the assertion
  so a failing "before" still leaves its evidence.
- Box the same element on both sides; when the fix removes it, box where it was.
- **Box what was put in, not only what came out.** When the case starts from an input (a search box, a filter, a form
  field), box the input too, so its value shows in the image: `[{ locator: input, label: 'Input' },
  { locator: results, label: 'Suggestions' }]`, assert the input's value before the screenshot, and add a caption
  `Input: "<value>" typed in <where>`. A reviewer cannot compare two result lists without seeing what produced them.
- **Never cover what you point at.** The composer draws a box as an outline inside the element's own edge and lists the
  box names above each column ("Boxed: Input · Suggestions"); it paints no text on a screenshot. Do not add overlays,
  arrows or labels of your own on the image: a label drawn above a box covered the field label and the typed value.
- Verify each step took effect (wait for the response or the rendered value) instead of assuming a click landed.
- Data and ids come per target from env/fixtures, never hardcoded to one environment's seed.
- A control that "sometimes" fails: repeat it in the test, count, and put the count in the failure message.
- A step that drives an API puts the real status and the start of the body in its assertion message.
- **Exports** (PDF, CSV, spreadsheet): read the file with a text extractor and compare **cell by cell, by column
  position** — and render a page of it for the image. Export the format that can actually carry the claim.

Run it: `EVIDENCE_SIDE=before BASE_URL=<before> <runner> <spec>`, then the same with `after`.

## STEP 3 — Classify every result (before you compose anything)

| Result | Before | After |
|---|---|---|
| **reproduced / fixed** | fails on the Expected assertion | passes |
| **does not reproduce** | passes | — report it with the data tried; ask for the reporter's data. No composite. |
| **script error** | failed before reaching its assertion (selector, timeout, login, missing data) | same |
| **not reachable here** | a threshold, volume or date range puts the case out of reach in this environment | — |

A script error is **fixed and re-run**, never posted as a finding — "failed" and "never reached its assertion"
look alike in a summary and mean opposite things. "Not reachable here" is reported as such, with what would reach
it; reach it elsewhere (seed the volume locally) and say in the caption that this row was proven on a seed.

## STEP 4 — Compose one image per case

Write `evidence/<case>.json` and run the composer that ships with this skill (Node only; the PNG is rendered with
the project's own Playwright, else only the HTML is written):

```bash
node <rulesRoot>/skills/before-after-testing/compose.mjs evidence/<case>.json
```

```json
{
  "title": "<KEY>: <the case in a few words>",
  "captions": ["Expected: <from the ticket>", "Before: <what the current build shows>",
               "After: <what the change shows>", "Data: <account, record, dates>"],
  "labels": { "before": "Before (<environment>, current build)", "after": "After (<environment>, <branch or build>)" },
  "rows": [
    { "name": "Desktop 1440", "design": "design-desktop.png", "designLink": "<design node url>",
      "before": "before-desktop.png", "after": "after-desktop.png" },
    { "name": "Mobile 390", "design": null, "designNote": "no frame draws this",
      "before": "before-mobile.png", "after": "after-mobile.png" }
  ]
}
```

Any row with a `design` key turns on the design column (three columns: design → before → after). Sidecar
`<image>.box.json` files are drawn automatically (outline inside the element, names above the column). A reader who never opened the ticket must understand the image
from its title and captions alone.

## STEP 5 — Look, then post

- **Open every composite and look at it** before posting — zoom into each box: nothing on the screenshot is covered
  (field labels, the typed value, neighbouring rows), the box is on the right element, the before really shows
  the issue, the after really shows the fix, the design column matches what the build draws. Note any difference
  between design and build that nobody filed — it goes in the report as a question, not a silent pass.
- Post each composite on its own ticket/PR (the tracker from the project config) with: environment of each side,
  data used, what before showed, what after shows, the commit/build of the change.
- A parent ticket or a review page gets a results table — one row per case, before/after columns, totals — plus
  every composite. **Re-read the whole document** when adding results: an older section still saying "not tested"
  next to a new "passed" table must be reconciled in the same edit.
- Evidence files (specs' screenshots, composites) live in the e2e workspace or a gitignored `evidence/`, never
  committed into the product repo unless the project says otherwise.

## Finish

Close every browser, dev server and proxy you opened (`ai/shared-fe/14-e2e-testing.md` §7). Report: cases run,
the classification table, links to the posted composites, and anything not reachable or not reproduced with the
reason.
