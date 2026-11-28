# Stable Layout and Render Scope

Applies to every screen whose content changes state while the user looks at it: answer feedback,
loading, play / pause, revealed text, download or playback progress. Layers on top of
`02-styling-ui-conventions` ("Conditional UI — Avoid Layout Flicker"), `11-responsive-defaults` (no
breakage below the drawn width) and `12-interactive-affordances` (what a pressable looks like).

Six rules. The first three are critical and have a short form in `skills/fe-coding/SKILL.md` §5;
all six have a line in the `07-ai-workflow-integration.md` §9 checklist.

> **Flutter.** The examples are React / Next.js (TSX + Tailwind) because that is what this plugin
> generates. The principles are framework-neutral; the Flutter equivalents are named under each rule
> (`SizedBox` / `Stack` slots, `Row` + `Expanded`, `GridView` / `Wrap`, `AnimatedSwitcher`,
> `const` / `StatelessWidget`, a scoped `StreamBuilder` / `ValueListenableBuilder`, `InkWell` vs
> `GestureDetector`).

---

## 1. No layout shift on state change (MUST)

**Rule.** When an element changes state, nothing **above or beside** it moves. Content that is already
on screen keeps its position through every state the element can be in.

Do one of these, in order of preference:

1. **Show the state on the element itself** — a badge, an icon swap, a border/background colour, an
   overlay inside the element's own box. A ✓ / ✗ badge on the chosen option, not a banner inserted
   above the options.
2. **Reserve the space up front** — a fixed-size slot, a `min-height`, or a placeholder with the same
   box that is present in every state. The revealed text, the hint, the result line live in a slot
   that exists before they do.
3. **Swap inside the same box** — a loading spinner replaces the content **inside a box of the same
   size**; the button keeps its width while its label becomes a spinner; the play icon and the pause
   icon are the same size.

**Why.** A layout shift under the pointer is a mis-tap. The failure that produced this rule: a quiz
screen inserted a "Correct!" / "Try again" banner above the option list when the learner answered. The
list jumped down by the banner's height mid-tap, so the next tap landed on a different option than
the one aimed at — and on a slow device the banner appeared *after* the finger was already moving.
The same family: a play button whose label changes from "Play" to "Pause" and re-wraps the row; a
"show translation" control that pushes the button below it out from under the thumb; a spinner that
collapses a card to 24px while it loads and expands it again when data arrives. None of these fail a
test or a type check. They only fail in the hand.

```tsx
// ❌ Answer feedback inserted above the options — every option moves down when the state changes
<Col className='gap-3'>
  {answered && (
    <TextPrimary className='rounded-card bg-success-50 p-3'>{t(isCorrect ? 'quiz.correct' : 'quiz.retry')}</TextPrimary>
  )}
  {options.map((option) => (
    <BaseButton key={option.id} onClick={() => onPick(option.id)}>{option.label}</BaseButton>
  ))}
</Col>

// ✅ Feedback is a badge on the chosen option, inside its own box — nothing else moves
<Col className='gap-3'>
  {options.map((option) => (
    <BaseButton
      key={option.id}
      onClick={() => onPick(option.id)}
      className={clsx('relative', stateBorder[resultFor(option.id)])}
      aria-describedby={resultFor(option.id) !== EAnswerResult.NONE ? `${option.id}-result` : undefined}
    >
      {option.label}
      <BaseResultBadge id={`${option.id}-result`} result={resultFor(option.id)} className='absolute right-2 top-2' />
    </BaseButton>
  ))}
</Col>
```

```tsx
// ❌ Spinner replaces the card with a 24px box — the list below jumps twice per load
{isLoading ? <BaseSpinner /> : <SummaryCard data={data} />}

// ✅ Same box in every state: the skeleton has the card's shape and size
<SummaryCard data={data} isLoading={isLoading} />   // renders a same-size skeleton inside
```

```tsx
// ❌ Revealed text mounts a new line and pushes the controls below it
{showTranslation && <TextPrimary>{safeString(item.translation)}</TextPrimary>}

// ✅ The slot is always there; only its content toggles
<TextPrimary className='min-h-6' aria-live='polite'>
  {showTranslation ? safeString(item.translation) : ''}
</TextPrimary>
```

The reserved height is a token-backed class (`min-h-6`), never an inline pixel value. Colour is never
the only signal — the badge carries an icon and an accessible label.

**Flutter.** Put the changing part in a fixed `SizedBox` / `ConstrainedBox(minHeight:)` slot, or in a
`Stack` over the element (`Positioned` badge). Swap with `AnimatedSwitcher` inside that fixed box — not
by inserting a widget into the parent `Column`. Keep the icons in a play/pause swap the same size.

**Exceptions.**
- A block at the **end** of a layout (nothing below or beside it to push) may mount normally.
- A block that genuinely **appears** as new content in the middle of a layout (an error section, an
  expandable panel the user opened) follows `02-styling-ui-conventions` "Conditional UI" and the §9
  checklist: it transitions its height in (`grid-rows-[0fr→1fr]` + opacity), it does not hold a
  permanent empty gap. This rule is about the **state of an element that stays**.
- Content **after** the element in reading order may move if the user caused it on purpose and is not
  pointing there (expanding an accordion pushes the next sections down) — the element itself and
  everything before it may not.

---

## 2. Use the horizontal space (MUST on wide / tablet layouts)

**Rule.** At the wide breakpoint, small summary tiles and stat cards sit side by side in a responsive
grid or an equal-column flex row. Do not stack full-width cards that hold one number and a label each.
Long lists (rows the user scans or scrolls) stay full width **below** the grid.

**Why.** A stack of full-width tiles on a tablet or desktop is mostly empty space: four "streak / due /
learned / minutes" tiles, each 1000px wide with 60px of content, push the list the user actually came
for below the fold, and the eye has to travel the full width to pair a label with its value. The same
four tiles in one row are read in a glance and leave the list on screen. This was reported as "the
home screen looks like a phone app stretched onto a tablet".

```tsx
// ❌ Each small tile takes the full width at every size — mostly empty on a tablet
<Col className='gap-4'>
  {stats.map((stat) => <StatTile key={stat.id} stat={stat} />)}
  <ItemList items={items} />
</Col>

// ✅ Mobile-first: stacked on a phone, equal columns from md up; the long list stays full width below
<Col className='gap-6'>
  <Col className='gap-4 md:grid md:grid-cols-2 lg:grid-cols-4'>
    {stats.map((stat) => <StatTile key={stat.id} stat={stat} />)}
  </Col>
  <ItemList items={items} />
</Col>
```

Mobile-first still holds (`fe-coding` §5): the unprefixed classes are the phone layout and the grid is
an enhancement from `md:` / `lg:`, never `grid-cols-1` as the base. Tiles in one row have equal widths
and the same height (`items-stretch`), so a longer label does not make one tile taller than the rest.

**Flutter.** `Row` with an `Expanded` per tile (equal flex), or `GridView` /
`SliverGrid` with `SliverGridDelegateWithMaxCrossAxisExtent`, or `Wrap` for a variable count — chosen by
`LayoutBuilder` / `MediaQuery` width. The long list is a separate `ListView` / `SliverList` below.

**Exceptions.** A card whose content genuinely needs the width (a chart, a table, a paragraph) stays
full width. On a phone, everything stacks.

---

## 3. Keep re-render scope small (MUST)

**Rule.**
- **Ephemeral UI state lives in the component that owns it** — local `useState` (or a hook inside that
  component), not a global store. Playing / paused for one player, expanded / collapsed, the selected
  tab of one panel, the playback speed of one control.
- **Subscribe to fast-changing values in the smallest leaf.** Playback position, download or upload
  progress, a countdown, a live timer — the component that *draws* the value subscribes; its parents
  do not.
- **Split the static parts out.** A presentational child that does not depend on the fast value is its
  own component, so it is not re-rendered by the value's ticks.
- **Global state only for data shared across screens** — the signed-in user, the installed content
  list, settings. Shareable view state (filters, the open record) belongs in the URL, per
  `09-data-listing`.

**Why.** A playback position updates 4–60 times a second. Held in a global store or in the screen's
state, every tick re-renders the whole screen — the header, the list, every option, every image — and
the device drops frames exactly while audio is playing, which is when the user is looking. On a
low-end tablet the failure looked like "the screen stutters while audio plays and taps are ignored for
a moment". A global `isPlaying` also couples every player on the screen: pausing one re-renders all of
them, and a second player cannot exist without a bug.

```tsx
// ❌ Position in a global store, read by the screen — the whole screen re-renders on every tick
const LessonScreen = () => {
  const position = usePlayerStore((state) => state.position);
  const isPlaying = usePlayerStore((state) => state.isPlaying);
  return (
    <Col>
      <LessonHeader />                {/* re-rendered on every tick */}
      <ItemList items={items} />      {/* re-rendered on every tick */}
      <ProgressBar value={position} />
    </Col>
  );
};

// ✅ Local playing state in the player; the position subscription lives in the leaf that draws it
const LessonScreen = () => (
  <Col>
    <LessonHeader />
    <ItemList items={items} />
    <AudioPlayer source={audioSource} />
  </Col>
);

const AudioPlayer = ({ source }: IAudioPlayerProps) => {
  const [isPlaying, setIsPlaying] = useState(false);       // owned here, not global
  return (
    <Row className='items-center gap-3'>
      <BasePlayButton isPlaying={isPlaying} onToggle={() => setIsPlaying(!isPlaying)} />
      <PlaybackProgress source={source} />                {/* only this re-renders per tick */}
    </Row>
  );
};
```

This rule is about **where state lives**, not about sprinkling `memo` / `useCallback` — the house rule
(`07` §6) stays "avoid `useCallback`, `useMemo` only for expensive work". Moving the subscription down
fixes the cause; memoising the parents only hides it.

**Flutter.** Ephemeral state in a `StatefulWidget` (or a local `ValueNotifier`), not in an app-wide
provider. Wrap **only** the widget that draws the fast value in a `StreamBuilder` /
`ValueListenableBuilder` / a Riverpod `Consumer` with `select`, never the whole `Scaffold` body. Mark
static subtrees `const` and split them into `StatelessWidget`s so the builder does not rebuild them.

**Exceptions.** State that another screen or a sibling far away in the tree must read (the mini-player
in the app shell that continues across screens) is legitimately shared — share the *coarse* state
(which item, playing or not) and still subscribe to the position only in the leaf that draws it.

---

## 4. Smooth progress (SHOULD)

**Rule.** A progress indicator driven by coarse events (a position update every 200–1000 ms, a
download callback per chunk) animates between updates instead of jumping. Use a CSS `transition` on
the bar's transform / width, or interpolate with `requestAnimationFrame` from the last known value and
rate. Respect `prefers-reduced-motion`.

**Why.** A bar that jumps 10% per second reads as stuttering or frozen, and users tap "play" again
because they think it stopped — which pauses it. Interpolation costs one class.

```tsx
// ❌ Jumps once per event
<Col className='h-1 bg-surface-muted'>
  <Col className='h-full bg-brand-600' style={{ width: `${percent}%` }} />
</Col>

// ✅ Interpolates between events; transform (not width) keeps it on the compositor
<Col className='h-1 overflow-hidden bg-surface-muted'>
  <Col
    className='h-full origin-left bg-brand-600 transition-transform duration-300 ease-linear motion-reduce:transition-none'
    style={{ transform: `scaleX(${percent / 100})` }}
  />
</Col>
```

The `style` here is a dynamic value, not a design value — tokens still come from classes.

**Flutter.** Ask the player for a higher-frequency position stream (or poll in a `Ticker`), or drive
the indicator from an `AnimationController` / `TweenAnimationBuilder` that animates from the previous
value to the new one over the update interval.

**Exceptions.** A step indicator ("3 of 8") moves in whole steps by design.

---

## 5. Press feedback only on real buttons (MUST)

**Rule.** Buttons, chips, toggles and icon buttons keep their press effect (ripple, pressed colour,
scale). Cards, list rows and other tappable **containers** get no ripple / splash / highlight flash —
they show hover and focus per `12-interactive-affordances`, and navigate on tap.

**Why.** A ripple spreading across a whole card or a full-width row looks like a glitch on a large
surface, flashes the card's content, and on a list makes every scroll that starts on a row "press" it.
Users read a container ripple as "something happened" when nothing did. The press effect is a signal
that belongs to controls; on a container it is noise.

```tsx
// ❌ A whole card with an active-state flash
<Link href={detailHref} className='block rounded-card bg-surface p-4 active:bg-brand-100'>…</Link>

// ✅ Card: hover + focus ring, no press flash. The button inside keeps its pressed state.
<Link href={detailHref} className='block rounded-card bg-surface p-4 transition-colors hover:bg-surface-hover focus-visible:outline-2'>
  …
  <BaseButton className='active:scale-95'>{t('common.start')}</BaseButton>
</Link>
```

**React Native.** `Pressable` on a card has no `android_ripple`; a button primitive has it.
**Flutter.** A card or row uses `GestureDetector` or an `InkWell` with
`splashFactory: NoSplash.splashFactory`, `highlightColor: Colors.transparent` (or set it once in the
theme for cards / list tiles); `ElevatedButton`, `FilledButton`, `IconButton`, `Chip` keep their ink.

**Exceptions.** A platform list where the press highlight is the native convention the design asks for
(a settings list on the native style) — follow the design.

---

## 6. Media controls always show playback state (MUST for audio / video)

**Rule.**
- The play control **always shows that playback is happening** — a progress ring around it or a bar
  next to it that moves while audio plays. Icon swap alone is not enough.
- For language / listening content, offer **playback speed** as small chips next to the main play
  control (for example `1×`, `0.75×`, `0.5×`), the selected one visibly marked. The speed is local
  state of that control (rule 3) unless the product makes it a saved setting.

**Why.** On a muted device, or with the volume at zero, a play button that only swaps its icon looks
exactly like a broken button: the user taps, hears nothing, sees nothing move, and reports the audio
as missing. A moving ring proves playback is running and the problem is the volume. Speed chips exist
because learners replay a phrase slower; hidden in a menu, the control is never found.

```tsx
// ✅ Ring shows progress; speed chips sit next to the play control
<Row className='items-center gap-3'>
  <BasePlayButton isPlaying={isPlaying} onToggle={onToggle}>
    <PlaybackRing source={source} />   {/* leaf subscription, rule 3; interpolated, rule 4 */}
  </BasePlayButton>
  <Row className='gap-1' role='radiogroup' aria-label={t('player.speed')}>
    {PLAYBACK_SPEEDS.map((speed) => (
      <BaseChip key={speed} role='radio' aria-checked={speed === rate} selected={speed === rate} onClick={() => setRate(speed)}>
        {`${speed}×`}
      </BaseChip>
    ))}
  </Row>
</Row>
```

**Flutter.** A `CircularProgressIndicator(value:)` (or a custom painter) around the play
`IconButton`, fed by the scoped position builder; speed as `ChoiceChip`s in a `Wrap` beside it.

**Exceptions.** Ambient or decorative media with no user control.

---

## Check it

Not a re-read of the diff — open the screen at phone **and** tablet / desktop width:

1. Trigger every state of every changing element (answer, load, play, pause, reveal). Does anything
   above or beside it move?
2. At the wide breakpoint, are small tiles side by side and the long list full width below them?
3. With React DevTools "Highlight updates" (Flutter: the rebuild counter / "Highlight repaints"),
   play audio. Does only the progress leaf flash?
4. Watch a progress bar for five seconds. Does it glide or step?
5. Press a card and a button. Only the button shows a press effect?
6. Mute the device and press play. Can you still see that it is playing?

Report what you checked in one line.
