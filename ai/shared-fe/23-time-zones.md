# Time zones in the UI: show the user's zone, set up once

> **Applies to**: every screen, email preview, export trigger or date picker that shows a time, a date or "today".
> Stack-independent (web, React Native, Blazor). The backend half is
> [`../shared-be/05-utc-by-default.md`](../shared-be/05-utc-by-default.md): the server keeps UTC, the UI converts.

**Rule (MUST):** the UI shows every time and every "today" in **the user's time zone**, read from **one place set up
up front** (the user's setting, else the product's default zone). It never reads the zone of the computer or phone it
runs on. Changing whose zone a user sees is then a matter of updating that one setting, not of finding every screen.

- **One source of the zone.** A single provider (a user context, a store, a hook) holds the user's IANA zone, filled
  from the user's profile at sign-in. No zone set, or signed out → the product's default zone (decide it once, e.g.
  the company's home zone, and keep it in one constant). Every formatter takes the zone from that provider.
- **Convert at display, with a named zone.** A UTC instant from the API becomes local time only where it is shown,
  through the zone's rules (`Intl.DateTimeFormat(..., { timeZone })`, `date-fns-tz`, `TimeZoneInfo.ConvertTimeFromUtc`).
  A named zone (`Australia/Sydney`) carries daylight saving: each instant gets the offset **of its own moment**, so an
  event at 8 PM in summer still reads 8 PM after daylight saving ends. Never add a fixed offset (`+10`).
- **"Today" is the user's calendar day.** Compute it from now-in-UTC converted to the user's zone. When the UI asks the
  server for a date range, it sends the user's **dates**, not "local midnight converted to UTC" (see below).
- **No machine clock for anything shown.** `new Date().toLocaleString()` without `timeZone`, `DateTime.Now`,
  `DateTime.Today`, `ToLocalTime()`, a library's default local zone: all read the device, not the user. A machine clock
  is fine only to measure elapsed time (a timeout, a "still loading" timer).
- **An empty date is not a time.** A missing value must arrive as `null` and show as "-". If an API sends a sentinel
  (`DateTime.MinValue`, `0001-01-01`, epoch 0), check for it before converting: converted, it renders as a made-up time
  (year 1 uses each city's local mean time: "01/01/0001 10:12 am" in Brisbane).
- **Inject the clock.** Read "now" through an injectable clock (`TimeProvider`, a `now()` service) so tests can pin a
  moment on either side of a daylight-saving change.

**Why (the failures it prevents, TLM-5762):** the nav bar clock and several screens read the browser's zone. A
computer on Brisbane time showed Sydney users Brisbane time, an hour behind for half the year, although their zone
was saved correctly in their settings. "Today" from the machine opened Sydney users on yesterday between 23:00 and
24:00 Brisbane. And "local midnight → UTC → take the date" sent **yesterday** for every zone east of UTC at every hour
of the day: 00:00 on 25 Nov in Brisbane is 14:00 on 24 Nov UTC, so a "Past 7 days" range never included today.

---

## ❌ Don't

```ts
// The device's zone and a fixed offset: wrong for every user not on this machine's zone, and wrong half the year.
clock.text = new Date().toLocaleTimeString();
const local = new Date(utc.getTime() + 10 * 3600_000);

// "Today" from the device, then shifted to UTC before taking the date: yesterday, east of UTC.
const endDate = new Date(new Date().setHours(0, 0, 0, 0)).toISOString().slice(0, 10);
```

## ✅ Do

```ts
// One provider holds the zone; every formatter reads it.
const { timeZone } = useUserTimeZone();          // profile zone, else DEFAULT_TIME_ZONE
const label = new Intl.DateTimeFormat('en-AU', { timeZone, dateStyle: 'short', timeStyle: 'short' }).format(utc);

// "Today" is the user's calendar day; the request carries dates, not instants.
const today = new Intl.DateTimeFormat('en-CA', { timeZone }).format(now());   // "2026-11-25"
api.getRange({ from: addDays(today, -6), to: today });

// An empty date is shown as missing.
const lastSeen = record.lastSeenUtc ? format(record.lastSeenUtc, timeZone) : '-';
```

## Test it across a change

Pin the clock and the zone in a test on **both sides** of a daylight-saving change (e.g. Sydney 1 Apr vs 6 Apr): the
same UTC hour must read an hour apart. Run an end-to-end check with the browser's zone set **differently** from the
user's (e.g. browser `Australia/Brisbane`, user `Australia/Sydney`): a screen that still reads the device shows up at
once. With the browser on the user's zone the bug is invisible.

## Exceptions

- A value that is a **date only** (a birthday, a report day) is a calendar date, not an instant: keep it as a date
  type, never convert it through a zone.
- A screen that must show **another party's** zone (a vehicle's local time, a depot's opening hours) says whose zone it
  is in the label.
