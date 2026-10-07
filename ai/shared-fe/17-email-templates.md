# Email Templates

Applies to every transactional/notification email the system renders (Razor, MJML, React-Email,
hand-written HTML — the medium is the same). Email clients are **not** browsers: they strip `<head>`
CSS, block remote and inline images, rewrite the DOM for dark mode, and re-flow tables. These rules
exist because each one below has already shipped a broken email.

---

## 1. Reproduce the design source 1:1 — don't approximate from a description

When a design exists (Figma, an artifact, a reference HTML), **extract the actual rendered markup and
copy** and reproduce it field-by-field. Do **not** rebuild it from a prose summary of what it "should"
contain.

**Why:** a template written from a text description drifts on wording, spacing, colours, fonts and
whole missing blocks (e.g. a "What happened / What it means / How urgent" explainer that the summary
never mentioned). The reviewer then finds the differences one email at a time.

- Pull the reference HTML (render the artifact, read the source), list every block and every string.
- Diff your output against the reference: severity band, hero, map, detail rows, explainers, CTA,
  context, next-steps, help, footer. A block present in the source and absent in yours is a bug.
- Where the source is internally inconsistent (e.g. three different subject formats), see §10.

---

## 2. Hosted images only — never `data:` URIs

Every image (`logo`, map thumbnail, icons) MUST be a **hosted `https://` URL**. Never inline an image
as a `data:` URI.

**Why:** Gmail (web + app) and others **block `data:` images** — they render as a broken-image icon.
A logo that looks fine in a browser preview of the artifact is broken in the actual inbox.

- Logo → hosted asset, resolved from config (per environment, see §7), not embedded bytes.
- Maps → **reuse the system's existing map service**, don't invent one. This codebase already renders
  static maps via the **Mapbox Static Images API** with a public token (see `SafetyScoreView`); build
  the alert-location thumbnail the same way:
  `https://api.mapbox.com/styles/v1/mapbox/streets-v12/static/pin-l+d64545({lng},{lat})/{lng},{lat},{zoom}/{w}x{h}@2x?access_token=<public pk.*>`
- A public (`pk.*`) Mapbox token is not a secret and is meant to be consumed in the URL. A private
  key is (see §8).
- Provide the address + a maps link as a text fallback so the block still works with images off.

---

## 3. Inline the CSS for delivery — `<style>` in `<head>` is not reliable

Deliverable email HTML needs its styling **inline on each element**. Author with classes only if a
**CSS inliner runs at send** (e.g. `juice`, `PreMailer`), which copies the `<style>` rules onto the elements
and leaves `<style>` for what can't be inlined (`@media`, dark-mode overrides).

**Why:** **Outlook desktop (Word engine) strips most embedded `<style>`**, and some Gmail paths are
partial. A class-only template renders unstyled there. Inline styles always apply.

- ✅ Inline styles on every element (the battle-tested default), **or** classes + a build/send-time
  inliner.
- ❌ Classes in `<head><style>` with no inliner, shipped as-is.
- Keep in `<style>`: `@media` (mobile), and the dark-mode block (§5) — these can't be inlined.
- "Use classes so it's maintainable" is correct as *source*; the *sent* email must still be inlined.

---

## 4. `<style>` specificity traps (when you do keep a `<style>` block)

A base/context selector must never out-specify the block rule it sits above, and never blanket-reset a
property that block rules set.

**Why (both shipped this quarter):**

- `.page a { color:#0075FF }` (specificity 0,1,1) **beat** `.cta-a { color:#fff }` (0,1,0) → the CTA
  button label rendered blue on a blue button = **invisible**.
- `.page p { margin:0 }` (0,1,1) **beat** every `.h1/.vehicle/... { margin:… }` (0,1,0) → all vertical
  spacing collapsed = **gaps wrong**.

- ❌ `.page a { color:… }`, `.page p { margin:0 }` as base rules.
- ✅ Base as bare element selectors (`a { color:… }`) so block classes win; don't globally reset a
  property individual blocks own. For a value that MUST hold (button text colour), inline it or
  `!important` it, and **verify the button text is visible** before shipping.

---

## 5. Dark / light must be explicit

Support the recipient's OS theme with the two mechanisms clients actually honour, and never carry
meaning by background colour alone.

- `<meta name="color-scheme" content="light dark">` + `supported-color-schemes` → Apple Mail, iOS
  Mail, Outlook macOS/iOS adapt.
- `[data-ogsc]` / `[data-ogsb]` override rules in `<style>` → Outlook.com / Outlook apps (they rewrite
  the DOM with those attributes when inverting).
- **Gmail supports neither** and applies its own partial transform — so choose colours that survive
  auto-inversion, and never encode state purely in a background colour (a severity must also have a
  label/border, not just a colour).

---

## 6. The template is dumb — the backend preformats every value

The template does **no** maths, rounding, date/timezone formatting, unit conversion or string
assembly. Every value arrives **preformatted** from the backend; the template only places it and shows
or hides optional blocks when a field is absent.

**Why:** formatting logic scattered across template branches is untestable and renders differently per
email; centralising it in the backend keeps the template a pure view.

A date/time in an email arrives with its **timezone label** ("5:31 pm AEST"): the reader has no settings in view
and may be in another zone. This differs from an in-app screen, where the user's own
timezone setting is in view.

When building an email feature, **classify every content field** and say so in the handoff:

| Class | Source |
|-------|--------|
| **Backend (real)** | telemetry / DB, computed in the service |
| **Hardcoded (per-type)** | authored editorial copy per alert/notification type (labels, explainers, next-steps, help text) |
| **Template** | static chrome (section labels, footer text) |
| **Config** | support email, addresses, base URLs, tokens |
| **Not available yet** | needs new backend work — list it explicitly, don't silently omit |

Optional blocks must render **nothing** when their field is null — never a fake value.

---

## 7. No hardcoded environment URLs

Every link into the app (dashboard, deep links, unsubscribe) comes from **config, per environment** —
staging links point at the staging domain, production at production. Never hardcode a domain literal.

**Why:** a hardcoded `dashboard.example.com` in a staging email sends testers to production.

```text
❌ cta = "https://dashboard.example.com/map?vehicle=" + id
✅ cta = config.dashboardBaseUrl + "/map?vehicle=" + id   // value differs per environment config
```

---

## 8. Secrets stay placeholders in committed config

API keys (SendGrid, private map keys, Twilio) are **placeholders** in committed config files. Real values
live in a local secret store / environment variables only.

**Why:** a real SendGrid key committed to the repo is a live credential leak, and it is easy to do
while wiring a "quick test send". A public `pk.*` map token is the exception — it is designed to be
public (§2).

---

## 9. Redesign behind a per-tenant flag, as a parallel clone

Ship a redesigned template as a **new parallel version gated by a per-company/per-tenant flag
(default off)** rather than editing the live template in place.

**Why:** a template change hits every customer at once with no rollback. A flagged clone is a safe,
reversible rollout — legacy stays untouched, pilots opt in, and only additive, flag-guarded changes
touch the shared code paths.

---

## 10. One canonical subject; document spec conflicts on the ticket

Pick **one** subject-line format and apply it everywhere. When the design source is internally
inconsistent, **do not silently pick one** — comment the conflict on the ticket (quote each location
and value), state the chosen authoritative source, and ask for confirmation.

**Why:** the inbox line is where most notifications are won or lost; an undocumented guess between three
conflicting spec variants gets reworked later and loses the audit trail of why.

---

## 11. A local per-case test harness (test-only markers)

Provide a dev harness that renders **and optionally sends** one email per case, reading realistic
payloads. Keep it out of the product code path.

- When sending test emails, tag the subject with **type + identifier + order** (e.g.
  `[03 · Excessive idling · 3DEF456] …`) and send **in the spec's order** so the tester can find and
  sequence them. These markers are **test-only** — never in the production subject.
- Send test mail only to an internal recipient the tester controls; never to real customer recipient
  lists from a harness.
