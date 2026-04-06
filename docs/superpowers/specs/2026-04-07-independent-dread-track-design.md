# Independent Dread Track Design

> Decouple Dread from Soul loss. Make Dread a standalone 0–5 track (like VtM V5 Hunger) that the GM controls per campaign.

## Core Change

Dread is no longer derived from Soul loss. It becomes an independent, GM-assigned resource that represents whatever narrative pressure fits the campaign — supernatural corruption, paranoia, moral decay, creeping desperation.

- **Scale:** 0–5 (unchanged)
- **Storage:** Direct value on the character, no derivation
- **Control:** GM assigns gains; players can reduce through specific actions

## Gaining Dread

The GM defines what causes Dread for their campaign. The rules provide **guidance with suggested values**, not a fixed table.

### Example Triggers (Horror Campaign)

| Trigger | Suggested Gain |
|---|---|
| Minor exposure (strange omen, unsettling scene) | +1 |
| Significant encounter (entity contact, forbidden knowledge) | +1–2 |
| Major transgression (supernatural bargain, crossing a line) | +2–3 |
| Voluntary acceptance (player embraces the dread for narrative power) | +1 |

### Campaign Flexibility

The GM redefines these triggers to match the campaign's theme:
- **Psychological thriller:** witness a betrayal (+1), commit violence (+2)
- **Survival horror:** enter unknown territory (+1), use the last supplies (+1)
- **Cosmic horror:** read a forbidden tome (+1–2), contact an entity (+2–3)

## Losing Dread

Two paths: **scene-based relief** (passive/narrative) and **player actions** (active/deliberate).

### Scene-Based Relief

| Method | Effect |
|---|---|
| Safe haven scene (characters decompress in safety) | −1 Dread |
| Cathartic moment (breakthrough, confession, genuine peace) | −1 Dread |
| Extended downtime between scenarios (weeks/months) | Reset Dread to 0 |

### Player Actions

| Method | Effect | Limit |
|---|---|---|
| Anchor interaction | −1 Dread (also recovers +1 Mind) | Once per session |
| Confront the source (face what's causing the dread) | −1 Dread | GM discretion |
| Severing Contact (month of mundane life) | Reset Dread to 0 (also recovers all Soul) | Loses beneficial manifestations |

### What Does NOT Reduce Dread

- **Cracks** — still only recover Mind (+1). They do not reduce Dread.
- **Normal rest** — sleeping does not reduce Dread.
- **Soul recovery** — recovering Soul no longer affects Dread.

## Interaction with Existing Mechanics

### Unchanged

| Mechanic | Status |
|---|---|
| Dice pools | Dread dice still replace base dice, expand pool if Dread > attribute |
| Roll outcomes | Clean/tainted/dire/failure categories unchanged |
| Pushing — dread 1s | Still cause Soul loss |
| Pushing — base 1s | Still cause Mind loss |
| GM Dread Pool | Fully separate resource, no cross-contamination |
| Conditions | Unchanged |
| Marks / Spiral | Unchanged |

### Changed

| Mechanic | Change |
|---|---|
| Soul track | Now purely a health pool. Losing Soul does not affect Dread. |
| Soul recovery | No longer reduces Dread. |
| Dread recovery | Independent — see "Losing Dread" above. |
| Anchor | Now also reduces Dread (−1) in addition to Mind recovery (+1). |
| Severing Contact | Still resets both Soul and Dread to 0 (preserved as nuclear option). |

### Resolve Talent

**Resolve L3 (Iron Soul)** unchanged — suppresses one Dread Die for a single roll, once per session. It's a coping mechanism, not a cure. With Dread having its own reduction paths, Iron Soul is less critical but still valuable for clutch moments.

## FoundryVTT Implementation

### Data Model — `module/data/investigator.mjs`

- **Remove** `dread.override` BooleanField
- **Remove** auto-derivation logic in `prepareDerivedData()` (the Soul→Dread calculation, lines 149–164)
- **Keep** `dread.value` NumberField (0–5), now directly editable with no derivation

### Configuration — `dreadlight.mjs`

- **Remove** `CONFIG.DREADLIGHT.dreadTable` (unused lookup array)

### Character Sheet — `module/sheets/investigator-sheet.mjs` + `templates/actors/parts/tracks.hbs`

- Make Dread pips **clickable** (click to increment, right-click to decrement, clamped 0–5)
- Remove any override toggle UI

### Dice System — No Changes

- `dreadlight-roll.mjs` — `buildPool()` reads `system.dread.value` directly, doesn't care how it got there
- `chat-message.mjs` — displays dread gain info, doesn't auto-apply
- `roll-dialog.mjs` — reads dread.value for pool preview

### Rules Documents — `H:\My Drive\Project Crimson Echo\Dreadlight Core Rules\`

- **Rewrite** `04 - Dread and Corruption.md` — remove Soul derivation table, replace Dread Rating section with independent track rules, add gaining/losing guidance
- **Update** `07 - Recovery and Healing.md` — remove "Dread follows Soul" section, add independent Dread recovery rules
- **Update** `13 - Reference Tables.md` — remove Soul→Dread lookup table if present

## Migration

No data migration needed. Existing characters have `dread.value` already stored. The `dread.override` field becomes unused and can be removed from the schema — FoundryVTT silently ignores extra fields in stored data.
