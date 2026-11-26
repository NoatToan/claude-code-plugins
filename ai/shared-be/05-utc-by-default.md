# UTC by default on the backend

> **Applies to**: any backend — NestJS, Next.js route handlers + Prisma, EF Core (.NET), plain SQL / Supabase: what it
> stores, computes, compares and sends. The UI half is
> [`../shared-fe/23-time-zones.md`](../shared-fe/23-time-zones.md): the UI converts to the user's zone for display.

**Rule (MUST):** the backend stores, compares and returns times **in UTC**, and leaves the conversion to the user's
zone to the UI. It works in a local zone **only when a requirement asks for it**, and then it says whose zone (the
user's, the owner's, the company's) and reads it from the stored setting, by name.

- **Store and send UTC.** Columns are UTC instants (`timestamptz`, `DateTime` with `Kind = Utc`); API responses carry
  UTC (ISO 8601 with `Z`). "Now" is the UTC clock (`DateTime.UtcNow`, `new Date()` serialised as ISO), read once per
  operation and injected so tests can pin it.
- **Local time only on request.** A server-side job or file that people read in their own day (a daily report window,
  a scheduled email at 7:00 AM, an export's printed times, an email body) is a requirement for local time. Then:
  - the zone is a **named** zone (`Australia/Sydney`), read from the stored setting of the person it is for, with one
    documented default when none is set — never a fixed offset, never the server's own zone;
  - the server converts **each instant with its own offset**, so the result is right on both sides of a daylight-saving
    change;
  - a recurring schedule **steps in local time** (7:00 AM → next day 7:00 AM), never by fixed UTC spans (24 h, 7 days),
    which drift an hour at every change.
- **Dates from the UI are dates.** A range the UI sends as the user's calendar days (`from=2026-11-19&to=2026-11-25`)
  is read as those days in the user's zone; the server turns them into a UTC window itself.
- **A missing time is `null`.** Never a sentinel such as `DateTime.MinValue` or `0001-01-01`: the UI converts it into a
  made-up time ("01/01/0001 10:12 am") or counts from it ("Stopped 739938 days").

**Why (the failures it prevents, TLM-5762):** a scheduler stepped by fixed UTC spans moved a 7:00 AM Sydney report to
8:00 AM for half the year, with its data window shifted by the same hour. Converting on the server by default would
have spread the user's zone into data and comparisons; keeping UTC everywhere and converting at the edge means a
changed zone or a changed daylight-saving law only touches display, never stored data.

---

## ❌ Don't

```text
row.createdAt = DateTime.Now                      // the server's zone, not UTC
nextRun       = schedule.nextRun + 24h            // drifts an hour at every daylight-saving change
windowStart   = runAt - 7 days                    // same drift for the report window
response.time = format(row.createdAt, "+10:00")   // fixed offset, and the UI's job anyway
```

## ✅ Do

```text
row.createdAt = clock.UtcNow                                          // stored and returned as UTC
zone          = owner.timeZone ?? DEFAULT_TIME_ZONE                   // named zone, only because the job needs local time
nextRun       = toUtc(toLocal(schedule.nextRun, zone) + 1 day, zone)  // steps on the local clock
```

## Exceptions

- A value that is a calendar **date** with no time (a birthday, a billing day) is stored as a date, not as an instant.
- A requirement may name a different zone (a vehicle's, a depot's). Follow it, name the zone in the field or the
  output, and still store UTC underneath.
