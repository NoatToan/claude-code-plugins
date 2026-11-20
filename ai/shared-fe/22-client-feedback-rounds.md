# Client feedback rounds: source first, questions first, verify what the eye sees

> **Applies to**: a round of client or stakeholder feedback on a built product (a demo, a prototype, a release
> candidate), processed as a batch: analyse → implement → verify → publish the evidence. Stack-independent. Pairs
> with [21-before-after-evidence.md](21-before-after-evidence.md) (how the evidence looks) and
> [20-review-finding-classes.md](20-review-finding-classes.md) (which items need a person, not a fix).

**Rule (MUST):** before writing code for a round, (1) trace every reference the client sent back to its **source**,
(2) put every point you would otherwise decide yourself in front of the user **as a question**, and (3) plan how each
item will be checked **visually at the real device size**, not only through the DOM.

Each rule below comes from a round that went wrong. The failure story is the reason it exists.

## 1. Trace the reference to its source, then copy it 1:1

When feedback says "like in this video" or "like this animation", the video was nearly always recorded from something
that already exists: a Figma Make, a prototype, a component library, another app. Find that source and read its code:
the asset files (Lottie, SVG), sizes, colours, easing and timings. Then reproduce it. Do not rebuild it from what the
video looks like.

- **Why:** a booth demo got custom Face ID and Visa animations built from the client's video. The user then said the
  videos came from the Figma Make. Everything was redone from the Make source and the custom work was thrown away. One
  item on the review page still described the discarded version afterwards.
- **How:** ask "where was this recorded from?" in the first message of the round. Once you have the source, list the
  files you will copy from (component path, asset path) in the plan.
- **Proving 1:1:** run the source in a small reference harness, using its own files unchanged. Record source and build
  with the same tool, starting at the same moment. Publish a side-by-side video plus a strip of frames taken at the
  same timestamps. "Looks the same to me" is not evidence.
- **Subagent limit:** a subagent may not have the session's MCP connections (Figma, Make). Read the source in the
  main session before delegating.

## 2. Questions before implementation, not after

List every point the feedback leaves open, and the default you would pick for each. Send that list *before*
implementing: the same message as the analysis, one round. Examples: which flows a change also applies to, light or
dark variant, the exact wording of a new step, where a new step goes.

- **Why:** four such points were decided silently and implemented. The user had to ask "any Q&A for me?" before they
  surfaced. A wrong default found after deploy costs a redo, a redeploy and a new evidence set.
- On the review page, every self-decided point is marked as **awaiting confirmation** until the user answers.

## 3. Verify what the eye sees, at the real size

An assertion that an element exists and is visible says nothing about where it is. For every overlay, animation or
new visual:

- **Check centring and overflow at the real device width** (e.g. a 402–414 px phone frame). Assert the element's box
  against its container: centre offset ≤ 1–2 px, no edge outside.
  - **Why:** a 500 px animation box on a 402 px phone overflowed to the right. Every test was green. The user caught
    it from a screenshot.
- **Measure before the transform or animation starts.** Read a rect after a `scale(0.4)` spring has begun and you get
  the shrunk size. Decorations sized from it come out wrong.
  - **Why:** success "pulse rings" were sized from the mid-spring check icon and came out too small.
- **Measure stable boxes, not moving content.** Assert on the container of an animation (the Lottie box), not on its
  drawn paths. Paths slide in as part of the animation, and under CPU load they land at different points in time. The
  check that measured the paths was flaky; the box check is exact.
- **Screenshots wait for the animation to finish.** A shot taken mid-fade looks like a translucency bug.
- **Copy direction and origin from the source, not from convention.** The source drew a circle from 3 o'clock (the
  default for `pathLength`). The build added a `rotate(-90deg)` "to start at 12" and no longer matched.
- **Animation work ships with a recorded test.** Use a Playwright spec with video on that plays each animation and
  asserts timing, centring and texts. Make it the default deliverable; do not wait to be asked.

## 4. A change is not done until everything that describes it agrees

When a change alters behaviour or timing, update everything that describes it in the same commit:

- the flow verifier's timing windows (a new 7 s Face ID + securing chain broke the flow check)
- the e2e thresholds
- the README numbers
- the review-page text for **earlier** items the change supersedes

- **Why:** after one round, the README still said "centred ≤ 6 px" while the test asserted ≤ 1 px. A review card
  described an animation that had been replaced. The reader believes whichever line they see first. See "Keep the whole
  document true" in [21-before-after-evidence.md](21-before-after-evidence.md).

## 5. Verify that each step took effect

Several tooling steps failed silently in one session, and each cost a run:

- a process substitution `read <(...)` that wrote nothing
- a scripted replace whose pattern never matched because of quoting
- `pkill -f <pattern>` that also killed the waiter watching the deploy
- a dependency major version that changed its default export (e.g. `lottie-react` 3)

After any write, kill or install, check the result (`git diff --stat`, `pgrep`, a one-line import) before building on
it. Pin a dependency to the version the source uses.

## Checklist for a round

- [ ] Every "like this video" item is traced to its source, and the files to copy are named in the plan
- [ ] Open points and their defaults were sent to the user before implementation; unanswered ones are marked on the
      review page
- [ ] Every new visual is checked at the real device width: centred, no overflow, measured before transforms
- [ ] Animations have a recorded spec, and a source-vs-build side-by-side when a source exists
- [ ] Verifier timings, test thresholds, README numbers and earlier review items agree with the new behaviour
- [ ] Evidence is checked on the deployed URL, not only on local
