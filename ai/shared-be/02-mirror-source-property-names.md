# Mirror the Source Name on Carrier Properties (Shared Backend)

> **Applies to**: any DTO / message / view-model / API-response property that simply **carries** a value
> read straight from a source field (an entity column, an upstream record, another DTO). Cross-stack
> backend rule, any language or mapper. The backend counterpart to `ai/shared-fe/` (and to the FE rule
> that types mirror the backend response field-for-field). Examples below are pseudocode.

**Rule (MUST):** a carrier property **MUST NOT re-word** the name of the value it carries. When a property
passes a value through unchanged, name it after the **source field**, not a re-worded synonym. If the
source is `isEngineStarted`, the carrier is `isEngineStarted` — not `isEngineOn`. If the source is
`engineCoolantTemp`, the carrier is `engineCoolantTemp` — not `engineTemp`. Rename only when you genuinely
**transform** the value (aggregate, derive, change meaning); a straight pass-through keeps the source's
name. Casing follows the target's convention (`IsEngineStarted` ↔ `isEngineStarted`); the words do not change.

**And keep the sibling's stem.** When the type already exposes a related property for the same concept, a
new companion **MUST** keep that established stem, not drop it. A message that already has `alertRuleName`
gets `alertRuleId` for the rule's id — **never** a stem-dropped `ruleId`. Half-renamed siblings
(`alertRuleName` beside `ruleId`) read as two different things and break `grep alertRule`.

**Why (the failure it prevents):** a re-worded pass-through desyncs two names for one value. Three costs:

1. **Traceability dies.** `grep isEngineStarted` no longer finds the property that carries it, so the next
   reader can't follow the value from source to email/response without reading the mapper line by line.
2. **It invites a meaning flip.** `isEngineOn` reads as the negation-prone twin of `isEngineStarted`; the
   day someone wires `isEngineOn = !record.isEngineStarted` "to make the name true," the bug looks correct.
   Identical names make the mapping self-checking — `x = source.x` is obviously right.
3. **It fragments the vocabulary.** One codebase ends up with `engineTemp`, `engineTemperature` and
   `engineCoolantTemp` for the same reading, and no one can tell if they mean the same thing.

---

## ❌ Don't — re-word a pass-through

```text
// The properties invent new names for values they copy verbatim.
message = LowBatteryAlertMessage {
    isEngineOn = record.isEngineStarted,     // ← name ≠ source; reads as its own negation
    engineTemp = record.engineCoolantTemp,   // ← abbreviated + drops "Coolant"
}
```

## ✅ Do — keep the source's name

```text
message = LowBatteryAlertMessage {
    isEngineStarted   = record.isEngineStarted,     // x = source.x — self-checking
    engineCoolantTemp = record.engineCoolantTemp,
}
```

### Sibling stem — the id companion of a named property

```text
// ❌ The message already exposes alertRuleName; a stem-dropped id companion desyncs the pair.
alertRuleName: string?
ruleId:        int?        // ← drops "alertRule"; grep alertRule misses it

// ✅ Keep the sibling's stem.
alertRuleName: string?
alertRuleId:   int?        // sibling of alertRuleName — one vocabulary, grep-able
```

---

## Exceptions — when a different name is correct

- **You actually transform the value** — an aggregate, a computed/derived field, a unit conversion, a
  join of several sources. Then the name describes the *result*, not any one input (e.g.
  `averageSpeedKmh`, `totalTripDistanceKm`).
- **A unit/type suffix for clarity** is fine **as long as the stem is preserved and consistent** within
  the type — `totalDistance` → `totalDistanceKm` keeps the stem; `engineCoolantTemp` → `engineTemp` does
  not (it drops a word). Pick one suffix convention per message and hold it.
- **A deliberate abstraction** across genuinely differently-named sources (the DTO is the seam between two
  vocabularies). Then it is a decision, not a slip — add a one-line comment saying which sources it
  unifies and why, so the next reader knows the mismatch is intentional.

When none of these apply, the property is a pass-through: give it the source's name.
