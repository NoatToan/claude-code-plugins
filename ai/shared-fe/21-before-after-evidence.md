# Before/after evidence for a verified fix

> **Applies to**: any change verified end to end — a bug fix, a redesign, a migration — and the evidence posted with
> it, wherever that lands (a ticket, a PR, a review page). Stack-independent: none of this depends on the test runner,
> the language or the tracker.

**Rule (MUST):** the evidence is **one composed image or page per case**, showing the states side by side, titled,
captioned, with the changed area marked. Never a folder of loose screenshots and never a claim with no artifact.

- **Before** = the build people are running today, on the data the reporter used. It must reproduce the thing being
  fixed. **After** = the change, on the same case. **Same automated spec for both runs**, asserting the expected result
  the ticket states: before fails on it, after passes.
- A run that fails for any other reason — a selector, a timeout, missing data — is a **script error**. Fix it; never
  post it as a finding. Distinguish in the report between *failed* and *never reached its assertion*: they look the
  same in a summary and mean opposite things.
- **The image says what it shows.** A reader who never opened the ticket must understand it: the case in a few words,
  the expected result, what each side shows, and the data used. Box the element that changed on both sides, and where
  it was when the fix removes it.

## Three columns, not two: design → before → after

When the change has a design, the evidence has **three** columns, in that order. The design is not decoration: holding
it beside the two builds is what catches a difference nobody filed — an item the design draws that the build drops, or
one the build adds that the design omits. Both may be deliberate and already settled in code; neither has usually been
put in front of a reviewer.

Export the frame from the design tool itself, not a screenshot of someone's screen, and link the node so a reader can
open it. When no frame covers a case, say so in that column: "no frame draws this" is information, an empty cell is not.

## Evidence that is not on screen

An exported file (PDF, spreadsheet, CSV) is compared **cell by cell from the file**, read with a text extractor, *and*
shown as a rendered page. The cells are the proof; the page makes it reviewable. Two traps, each worth a wasted run:

- **Export the artifact that can carry the claim.** Testing "the export keeps the grouping" against a format the spec
  says carries no grouping proves nothing, however green it looks.
- **Parse by column position, not by whitespace.** Layout extractors separate narrow columns with a single space, so
  splitting on runs of spaces merges two cells and the two sides look different when they are not.

## A case the data cannot reach is not a failure

When a threshold, a volume or a date range puts a case out of reach in the environment you are in, the report says
**"not reachable here, and this is what would reach it"** — not "fail", and never a quiet pass. Then reach it elsewhere:
seed the volume locally and record in the evidence that this row was proven on a seed, and why.

## Turn "flaky" into a number

"It sometimes does not work" is not actionable. Write the repetition into the test: exercise the control every way it
can be used, count how often it behaves, put the count in the failure message. A control that misbehaved in three runs
may measure clean once the test stops racing itself — which turns a suspected defect into a fixed test and saves someone
hunting a bug that is not there.

## When a test drives an API, print what it actually got

A poll reporting "it never finished" when the call answered `401`, `404` or an HTML fallback page costs run after run.
Put the real status and the start of the body into the assertion message. Better still, prefer the path a user takes:
the UI needs no knowledge of which endpoint serves what, how an enum serialises, or which header carries the token —
and it is what the requirement is written about.

## Environment parity is where specs die

A spec written against a local host usually fails elsewhere for reasons unrelated to the change: timeouts sized for a
local run expire **before the first assertion**, so the report says nothing; a value formatted per account breaks a
parser that assumed one format and reads as a product bug; accounts and ids hardcoded to one environment's seed; a route
present on one build and not the other. Take the data per target, verify a step took effect instead of assuming a click
landed, and leave the reason in a comment where the next person will hit it.

## Keep the whole document true

When a run adds a results section, re-read every older section in the same document. A page whose new table says
"passed" while an older card still says "not tested yet" is worse than one that says nothing: the reader believes
whichever is nearer. Reconciling the old section is part of posting the new one.
