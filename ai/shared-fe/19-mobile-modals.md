# Mobile Modals — one modal view, opened through an imperative handle

Applies to every web screen with filters or a secondary flow (sort, settings, a picker, an info panel)
that a phone user can reach. Layers on top of `11-responsive-defaults` (no horizontal page scroll),
`12-interactive-affordances` (§4 hit targets, §4c portals) and `03-component-patterns` (Modal
Architecture). Like those, it is a default for the **absence** of a mobile design: a drawn phone frame
wins (`skills/fe-coding` STEP 0).

---

## 1. On a phone, filters open in ONE modal view (MUST)

Below the width where the desktop filter bar fits, the bar collapses to **one trigger** — a "Filters"
button that shows how many filters are active — and every filter lives in **one** modal view: a
full-height sheet or a bottom sheet. Not a sideways-scrolling row of pills, not a pill per filter that
each opens its own popover.

**Why.** The desktop bar shrunk to 360px turns into two failure modes, and both have shipped:

- **The sideways chip row.** Half the filters sit off-screen with no sign they exist (the scrollbar is
  usually hidden for looks), the row competes with the page's vertical scroll for the same thumb, and
  any popover opened from inside it is clipped by the row's `overflow-x-auto` (`12` §4c).
- **The popover stack.** Each pill opens its own floating panel; a picker inside one of them opens a
  second; a native `<select>` opens a third, OS-drawn. The user is three layers deep, every layer has
  its own dismiss gesture, and each choice re-queries the list behind them while they are still
  choosing — the list jumps under the panel.

NN/g's testing of mobile faceted search lands on the same shape: one tray/sheet that holds the facets,
with the result count and an explicit "apply", beats facets scattered across the page.

```tsx
// ✅ Phone: one trigger with the active count; everything else is inside the modal.
<Row className='items-center gap-2'>
  <BaseSearchField className='min-w-0 flex-1' … />
  <BaseButton variant='outline' className='h-11 shrink-0' onClick={() => refFilters.current?.open()}>
    <IconSliders className='size-4' aria-hidden />
    {t('filters:title')}
    {activeCount ? <BaseBadge tone='brand'>{activeCount}</BaseBadge> : null}
  </BaseButton>
</Row>
<FilterModal ref={refFilters} value={applied} onApply={setApplied} />
```

```tsx
// ❌ The desktop bar squeezed into a phone: a hidden-scrollbar row of pills, each a popover.
<Row className='-mx-4 gap-2 overflow-x-auto px-4 [scrollbar-width:none]'>
  <PillSelect …/> <CountryPopover …/> <HoursPopover …/> <MoreFiltersPanel …/> …
</Row>
```

The **desktop bar does not change.** This rule is about the phone layout; the wide layout the users
already rely on keeps its pills and popovers (the project's design docs decide those). Pick one
breakpoint — where the bar stops fitting on one or two lines — and switch there.

Other secondary UI on the same screen follows the same rule on phones: an info popover (a "sources"
list, a legend) or an account menu opens as a sheet, not a floating panel over a filter row.

---

## 2. No nested popups — sub-choices render INSIDE the same modal (MUST)

A modal that opens another popup has recreated the stack from §1. Inside the modal:

| The choice | Render it as |
|---|---|
| on/off | a switch row (`role='switch'`) |
| ≤ ~8 options | inline radio chips or a segmented control, wrapping onto new lines — never a sideways row |
| a long or searchable list (country, time zone, 20+ tags) | a **sub-view**: a row "Country — Germany ›" that slides the modal's body to a list with its own search field and a Back button in the modal header |
| a range | the slider inline, with tap presets next to it (no drag-only control) |

One modal, one scroll container, one close gesture. A sub-view is a **step**, not a layer: it replaces
the body, the header shows Back (← returns to the list of filters) and the title of the step, and Esc /
the system back gesture go back one step before they close the modal.

**No combobox popovers and no `FloatingPanel` inside the modal.** A native `<select>` is tolerated only
where the platform picker is the point (a date input) — for anything you style, use the table above.

---

## 3. Draft state, Apply once, Reset, and a result count (MUST)

The modal edits a **draft copy** of the applied filters. Nothing is written while the user is choosing.

- **Apply** writes the draft to the source of truth (URL state — nuqs / router query — or the store)
  **in one update**, then closes. One history entry or one replace, one list request.
- **Reset** clears the draft to the defaults inside the modal; the user still presses Apply (or Reset
  applies and closes — pick one per product and keep it everywhere; say which in the button label).
- **Close** (✕, scrim, Esc, back) **discards** the draft. Reopening starts from the applied values.
- **Result count** on the Apply button — "Show 128 jobs" — when a count is cheap: a `count` endpoint, a
  facet total, or a client-side filter over data already loaded. Debounce it (≥ 250 ms) and never fetch
  the full list per keystroke to get it. If no cheap count exists, the button says "Show results" and
  your summary says why there is no count.

**Why.** Applying live from inside a modal re-queries and re-renders the list the user cannot see, and
URL-backed filters stack (or replace) one history entry per tap. Draft + Apply makes the modal a single
decision, which is also what makes Back predictable.

```tsx
// ✅ One write on Apply.
const apply = () => {
  setUrl({ q: draft.q, source: draft.source, tech: draft.tech, posted: draft.posted }) // one update
  refModal.current?.close()
}
```

```tsx
// ❌ Every control writes the URL as it changes — six list requests while choosing six filters.
<BaseSwitch checked={remote} onChange={(v) => setUrl({ remote: v })} />
```

---

## 4. The Imperative Handle modal pattern

The modal **owns** its open state and its draft. The parent holds a ref and calls `open()`; it never
keeps an `isOpen` flag, and it does not re-render when the modal opens or closes.

```tsx
// FilterModal.tsx
export interface FilterModalHandle {
  open: () => void
  close: () => void
}

interface FilterModalProps {
  value: Filters
  onApply: (next: Filters) => void
  // React 19: `ref` is a plain prop. React ≤ 18: wrap the component in forwardRef<FilterModalHandle, …>.
  ref?: Ref<FilterModalHandle>
}

export function FilterModal({ value, onApply, ref }: FilterModalProps) {
  const [open, setOpen] = useState(false)
  const [draft, setDraft] = useState(value)

  useImperativeHandle(ref, () => ({
    open: () => {
      setDraft(value) // every open starts from what is applied
      setOpen(true)
    },
    close: () => setOpen(false),
  }), [value])

  return (
    <BaseSheet open={open} onClose={() => setOpen(false)} title={t('filters:title')}
      footer={<>
        <BaseButton variant='ghost' onClick={() => setDraft(EMPTY_FILTERS)}>{t('filters:reset')}</BaseButton>
        <BaseButton onClick={() => { onApply(draft); setOpen(false) }}>{t('filters:show')}</BaseButton>
      </>}>
      {/* sections, sub-views — all reading/writing `draft` */}
    </BaseSheet>
  )
}

// Parent
const refFilters = useRef<FilterModalHandle>(null)
<BaseButton onClick={() => refFilters.current?.open()}>{t('filters:title')}</BaseButton>
<FilterModal ref={refFilters} value={applied} onApply={setApplied} />
```

Rules for the handle:

- **Type it.** Export a `…Handle` interface; `useRef<…Handle>(null)`; call through `?.`. No `any`, no
  string commands.
- **Expose verbs, not state.** `open()` / `close()` (and `back()` if the modal has steps). Never expose
  `setDraft` or the DOM node — that is the parent reaching into the child, which the handle exists to
  stop.
- **`open()` resets the draft** from the applied value. Stale drafts from a previous visit are a bug.
- **Build the shell once** — a reusable `ModalView`/`BaseModal` with the handle, focus management,
  scroll lock and back-button handling (§5) — and write each feature modal as content inside it. The
  house's centralized `refModalChildComponent.current?.onOpen(<Content />)` (`03` Modal Architecture)
  is the same idea for one-off content modals; a modal that holds a draft across sub-views is a
  component with its own handle.

**When to use which.**

| Use the imperative handle | Use a controlled `open` prop |
|---|---|
| The parent only ever *opens* it (a trigger button) | The open state is itself app state — in the URL (`?modal=filters`), restored on reload, or driven by a route |
| The modal owns a draft the parent must not see until Apply | Several components must react to it being open (a toolbar that hides, an analytics effect) |
| Opening must not re-render the parent (a long virtualised list behind it) | The modal is closed by an outside event the parent owns (a mutation finishing in the parent) |

Don't mix them: a component with both `open` and a handle has two owners of the same flag.

---

## 5. The modal itself is accessible (MUST)

| Requirement | How |
|---|---|
| Dialog semantics | Native `<dialog>` with `showModal()` (top layer, inert background for free), or `role='dialog'` + `aria-modal='true'` + `aria-labelledby` on the title, portalled to `body` (`12` §4c) |
| Focus moves in, is trapped, and returns | First field (or the dialog) focused on open; Tab cycles inside; on close, focus goes back to the trigger |
| Esc closes | Esc in a sub-view goes back one step; at the top it closes and discards the draft |
| The phone's back gesture closes it | Push one history entry on open; `popstate` closes; closing by ✕/Apply pops that entry first, **then** writes URL state — otherwise the pop undoes the write |
| Page behind does not scroll | Lock `body` overflow while open (restore the previous value), `overscroll-behavior: contain` on the modal's scroll body |
| Safe areas | Header/footer padded with `env(safe-area-inset-top|bottom)`; `dvh`, never `100vh`, for a full-height sheet |
| Targets | ≥ 44×44 CSS px for every row, chip and button inside the modal (`12` §4 — this is a phone view) |
| Motion | The slide-up respects `prefers-reduced-motion` (`motion-reduce:animate-none` or a fade) |
| Layering | One z-index token scale; the modal sits above sticky bars and below toasts |

WAI-ARIA APG's dialog pattern is the reference for focus behaviour. A sheet that looks right but leaves
focus on the page behind is the most common failure — check it with the keyboard, not by reading.

---

## 6. No horizontal page scroll at 360px (MUST)

This is `11-responsive-defaults` §1, restated because the filter row is where it breaks most often:
at 360px CSS width the **page** never scrolls sideways — and with §1 there is no reason left for a
filter **container** to scroll sideways either. The phone header is: search field (`min-w-0 flex-1`) +
Filters button (`shrink-0`). Long values (a country name, a time zone) truncate inside their row.

---

## 7. Check it — run on a phone viewport after it compiles

1. 360×740 and 390×844, touch emulation on: `document.documentElement.scrollWidth <= innerWidth`.
2. Exactly one trigger opens filters; it shows the active count.
3. Open → choose three filters → the list behind does **not** refetch → Apply → **one** URL update.
4. Reopen → the draft shows the applied values. Change something → ✕ → reopen → change is gone.
5. Every long list opens as a sub-view inside the modal; no popover ever appears on top of it.
6. Keyboard: focus starts inside, Tab stays inside, Esc backs out of a sub-view then closes, focus
   returns to the trigger. System back closes it without leaving the page.
7. Resize to the desktop width: the desktop bar is pixel-identical to before the change.

Report the one line: what you checked, at which widths, and anything left failing.

---

## Sources

WAI-ARIA APG [Dialog (Modal) Pattern](https://www.w3.org/WAI/ARIA/apg/patterns/dialog-modal/) ·
MDN [`<dialog>`](https://developer.mozilla.org/en-US/docs/Web/HTML/Element/dialog) ·
[`overscroll-behavior`](https://developer.mozilla.org/en-US/docs/Web/CSS/overscroll-behavior) ·
[`env()`](https://developer.mozilla.org/en-US/docs/Web/CSS/env) ·
[`History.pushState`](https://developer.mozilla.org/en-US/docs/Web/API/History/pushState) ·
React [`useImperativeHandle`](https://react.dev/reference/react/useImperativeHandle) ·
[`ref` as a prop (React 19)](https://react.dev/blog/2024/12/05/react-19#ref-as-a-prop) ·
NN/g [Mobile Faceted Search with a Tray](https://www.nngroup.com/articles/mobile-faceted-search/) ·
Material Design 3 [Bottom sheets](https://m3.material.io/components/bottom-sheets/overview) ·
WCAG 2.2 [2.5.5 Target Size (Enhanced)](https://www.w3.org/WAI/WCAG22/Understanding/target-size-enhanced.html) ·
[2.4.3 Focus Order](https://www.w3.org/WAI/WCAG22/Understanding/focus-order.html)
