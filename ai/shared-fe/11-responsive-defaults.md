# Responsive Defaults — when the design draws one width

Applies when a design specifies **one** width and nothing else. Layers on top of
`02-styling-ui-conventions` §2 (breakpoint names) and `skills/fe-coding` STEP 0 (the design is the
source of truth).

---

## 1. One drawn width is a spec for that width — and a floor, not a licence

Figma files here routinely draw 1440 only, and say so: *"Dark mode, responsive: Only 1440 is drawn.
Tokens have one mode."*

Two rules, pulling in opposite directions on purpose:

- **Build the drawn width faithfully.** Every spacing, size and hierarchy comes from the frame.
- **Below it, the screen must not break.** A layout that overflows horizontally at 390px is a defect
  even when no phone frame was drawn — nobody signed off on a broken page either.

**"Does not break" is a definition, not a feeling.** At 360px CSS width:

| | |
|---|---|
| No horizontal **page** scroll | web.dev: "Forcing the user to scroll horizontally or to zoom out to see the whole page causes a poor user experience." A *container* that scrolls on purpose (§5) is fine; the `body` is not. |
| No clipped, overlapped or zero-width text | Truncation with an ellipsis is fine when the full text shows on hover (§4.1). Text sliced by a sibling is not. |
| Every control still reachable and still ≥ 24×24 | `12-interactive-affordances` §4. |
| Nothing reflows into nonsense | Two-column data that interleaves when it wraps is worse than a scroll container. |

**MUST NOT: invent a mobile design when one exists in Figma.** If the file has a phone frame, a
`Mobile / …` page, or a variant at another width, STEP 0 wins and you build that. A responsive default
is what you do in the **absence** of a design, exactly like `09-data-listing` and
`10-images-and-preview`. It never overrides one.

**Say what you did, in one line.** *"The design specifies 1440 only. I built 1440 to the frame and
made it degrade without breaking below it — the rail stacks under the main column below `lg`. There is
no mobile design, so I did not invent one."* That sentence tells the reviewer which parts were designed
and which were a default, so they know what to push back on.

---

## 2. Order the breakpoints mobile-first, or the small case never renders

Unprefixed utilities are the **small** case; prefixed utilities are the **drawn** case. Tailwind is
explicit — *"unprefixed utilities (like `uppercase`) take effect on all screen sizes, while prefixed
utilities (like `md:uppercase`) only take effect at the specified breakpoint and above"* — and warns
against the inverted habit: *"Don't use `sm:` to target mobile devices."*

```tsx
// ✅ The stacked case is the base; the drawn 1440 layout is the override.
<Row className='flex-col gap-4 lg:flex-row'>
  <Col className='min-w-0 flex-1 gap-4'>{main}</Col>
  <Col className='w-full shrink-0 gap-4 lg:w-rail'>{rail}</Col>
</Row>
```

```tsx
// ❌ `sm:` used as "mobile". Below 640px this has NO layout at all, and the 372px
//    rail is unconditional — the row is 372px + content wide before it can wrap.
<Row className='sm:flex-row'>
  <Col className='flex-1'>{main}</Col>
  <Col className='w-rail shrink-0'>{rail}</Col>
</Row>
```

Breakpoints are chosen by **where this layout stops working**, not by device names — web.dev: *"Don't
define breakpoints based on device classes, or any product, brand name, or operating system … let the
content determine how its layout changes."* A 1440 design with a fixed rail almost always breaks at
`lg`, because that is where `viewport − rail` stops fitting the main column.

---

## 3. A fixed pixel width inside a `Row` is the usual cause of horizontal overflow

`flex-wrap` is **`nowrap` by default** — MDN: *"The flex items are laid out in a single line which may
cause the flex container to overflow."* So a `Row` of fixed-width children has a hard minimum equal to
their sum, and every viewport narrower than that overflows the page.

Two fixes. Pick by whether the children are **peers**:

| Situation | Use | Why |
|---|---|---|
| A few **unlike** blocks — main + rail, header + actions | `flex-wrap` on the `Row`, plus `min-w-[…] basis-[…]` or a `lg:` width on children | Each child keeps its intended size; the row breaks where it must. |
| **Many like** items — spec tiles, photo tiles, stat cards | `grid` + `repeat(auto-fit, minmax(<floor>, 1fr))` | The browser picks the column count. No breakpoint list to maintain, and it is correct at widths you never tested. |

`auto-fit` over `auto-fill`: MDN — *"Behaves as `auto-fill`, except that after placing grid items, any
empty repeated tracks are collapsed."* With `auto-fill`, three tiles in a five-column container leave
two empty tracks and the tiles do not expand.

```tsx
// ✅ Eleven spec tiles, one declaration, correct at every width.
<Col className='grid grid-cols-[repeat(auto-fit,minmax(180px,1fr))] gap-4'>
  {specs.map((spec) => <BaseSpecItem key={spec.key} label={t(spec.label)} value={spec.value} />)}
</Col>
```

```tsx
// ❌ Hand-computed quarters. `basis-[calc(25%-12px)]` bakes in a four-up assumption
//    and repeats two magic numbers at every tile — eleven places to fix.
<Row className='flex-wrap gap-4'>
  {specs.map((spec) => <BaseSpecItem key={spec.key} className='min-w-[180px] basis-[calc(25%-12px)]' … />)}
</Row>
```

**A fixed width may stay fixed when the design says so — give it an escape.** `w-full lg:w-rail`, or
`w-rail max-w-full`. What must never ship is a fixed width with no release at any breakpoint.

---

## 4. `min-w-0` is the fix for text that refuses to truncate (MUST)

`truncate` / `line-clamp` on a flex or grid child does nothing on its own, and the child pushes the row
wider instead. Not a Tailwind quirk — MDN on `min-width`, whose initial value is `auto`: *"For flex
items and grid items, the minimum width value is either the specified suggested size … otherwise, the
`min-content` size is used."* The child's automatic minimum is its longest unbreakable word, so it
cannot shrink past it.

**Every flex/grid child holding text you are willing to truncate carries `min-w-0`.** Siblings that
must keep their size carry `shrink-0`. The pair is the rule; one without the other is half a fix.

```tsx
// ✅ The text column may shrink and truncate; the badge keeps its size.
<Row className='items-center gap-3'>
  <Col className='min-w-0 gap-0.5'>
    <TextPrimary variant='bodyStrong' className='truncate'>{safeString(vehicle.rego)}</TextPrimary>
  </Col>
  <BaseBadge tone='neutral' className='shrink-0'>{t('vehicle:active')}</BaseBadge>
</Row>
```

```tsx
// ❌ `truncate` is inert — the column's automatic minimum is the longest word,
//    so a long VIN widens the row and pushes the badge off-screen.
<Row className='items-center gap-3'>
  <Col className='gap-0.5'><TextPrimary className='truncate'>{vin}</TextPrimary></Col>
  <BaseBadge tone='neutral'>{t('vehicle:active')}</BaseBadge>
</Row>
```

### 4.1 A truncated text always shows its full text (MUST)

An ellipsis hides content; the reader must still be able to read it. **Every `truncate` / `line-clamp-*`
text gets its full value as a tooltip** — a `title` (or the project's tooltip component) with the same
string, set on the element that truncates. A name, title, error, path or ID cut to "…" with no way to see
the rest is a bug, however short the text usually is: real data is longer than the mock.

```tsx
// ✅ Cut to one line, readable in full on hover.
<TextPrimary className='truncate' title={safeString(ticket.name)}>{safeString(ticket.name)}</TextPrimary>

// ❌ "[Telemax Platform] Compass: lower flespi message retention for…" — the rest is gone.
<TextPrimary className='truncate'>{safeString(ticket.name)}</TextPrimary>
```

- The tooltip carries the **same** text, not a summary. A value that is a link keeps the link; the
  tooltip goes on the text inside it.
- A list or table with many truncated cells may instead mount one hover handler at the app root that
  sets `title` from `textContent` on any `.truncate` / `line-clamp-*` element that overflows and has no
  title of its own — the rule is met when every cut text shows in full, however it is wired.
- Touch screens have no hover: a row whose key text truncates also opens a detail (drawer, modal, page)
  where the full text is shown.

---

## 5. Tables scroll horizontally. They do not stack — unless the row is a summary.

**Default: wrap `BaseTable` in an `overflow-x-auto` container and keep the table intact.** A data
table's value is column alignment (`09-data-listing` §1); stacking each row into a card destroys
exactly that, and the reader has to re-find every value in every card.

The scroll container belongs **inside** `BaseTable`, so no screen has to remember it, and it is the one
place a horizontal scroll is allowed under §1 — the page still does not scroll sideways.

```tsx
// ✅ Inside BaseTable — the only layer allowed raw DOM (03-component-patterns).
<Col className='w-full overflow-x-auto'>
  <table className='w-full min-w-[720px] border-collapse'>…</table>
</Col>
```

**Stack into cards only when the row is already a summary a person reads one at a time** — 3–4 fields,
no cross-row comparison, and a link into a detail page. That is a card list, and it should have been a
card list at 1440 too. Never ship both a table and a card list of the same data behind a breakpoint:
two renderings drift, and only one gets tested.

**This default assumes phone users have their own app.** Where a screen genuinely is driven from a
phone, stacking may be right — say which you chose and why in your summary. It is a design decision you
made in the absence of a design.

---

## 6. Text inputs are 16px or larger on phones, or iOS zooms the page (MUST, web)

Safari on iOS zooms the whole page when the user focuses an `<input>`, `<textarea>` or `<select>` whose
computed `font-size` is **below 16px**. The page stays zoomed after typing: the layout is offset, the
submit button is off-screen and the user has to pinch back out — on the form, the one step that converts.

**Every text-entry control renders at `font-size: 16px` or more below the drawn desktop width.** Keep the
smaller desktop size if the design draws one; raise it only at the phone breakpoint.

```css
/* ✅ Desktop keeps the drawn 14–15px; phones get 16px, so focusing never zooms. */
.input, .textarea, .select { font-size: 15px; }
@media (max-width: 860px) { .input, .textarea, .select { font-size: 16px; } }
```

```tsx
// ✅ Tailwind: the unprefixed size is the phone case (§2).
<input className='text-base lg:text-sm' … />

// ❌ 14px at every width — iOS zooms on focus.
<input className='text-sm' … />
```

- **Never "fix" it with `maximum-scale=1` / `user-scalable=no`** in the viewport meta: that disables pinch
  zoom for everyone and fails WCAG 1.4.4 (Resize text).
- Applies to the control's own `font-size`, not the label or placeholder wrapper; check the computed
  value, since a `text-sm` on a parent design-system input wins over the browser default.
- Web only. React Native `TextInput` does not auto-zoom.

From the KTP Solutions website audit: the contact form's 15px inputs zoomed the page on iPhone at focus.

---

## Sources

Tailwind CSS [Responsive design](https://tailwindcss.com/docs/responsive-design) ·
MDN [`flex-wrap`](https://developer.mozilla.org/en-US/docs/Web/CSS/flex-wrap) ·
[`min-width`](https://developer.mozilla.org/en-US/docs/Web/CSS/min-width) ·
[`repeat()`](https://developer.mozilla.org/en-US/docs/Web/CSS/repeat) ·
web.dev [Responsive web design basics](https://web.dev/articles/responsive-web-design-basics) ·
WCAG [1.4.4 Resize text](https://www.w3.org/WAI/WCAG22/Understanding/resize-text.html)
