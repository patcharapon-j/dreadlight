# D66 Table Roller — Design Spec

> Adds D66 random table rolling for Critical Injuries (Body), Trauma (Mind), and Soul Manifestations.

## Overview

The Dreadlight rules use D66 tables (two d6s read as tens + ones digit, 36 results from 11–66) for consequence lookups when tracks break or critical hits land. This feature adds the table data, roll mechanic, chat cards, automatic trigger prompts, and manual roll access.

---

## 1. Data Layer

### 1.1 Table Storage

New file: `module/data/d66-tables.mjs`

Exports three table objects registered on `CONFIG.DREADLIGHT.d66Tables` with keys `body`, `mind`, `soul`. Each table is keyed by D66 result string (e.g., `"11"`, `"12"`, ... `"66"`).

```js
// Structure per entry
{
  name: "Winded",
  effect: "You are knocked breathless. Suffer the Exhausted condition.",
  healTime: "1 shift",
  lethal: false
}
```

- `name` — short title
- `effect` — what happens to the character
- `healTime` — recovery duration (e.g., "1 shift", "1 day", "permanent")
- `lethal` — boolean, true for instant-death results (Body 65–66, Mind 66, Soul 66)

All entries transcribed from Chapter 13 of the core rules.

### 1.2 Registration

In `dreadlight.mjs` init hook, import and assign:

```js
CONFIG.DREADLIGHT.d66Tables = d66Tables;
```

---

## 2. D66 Roll Mechanic

### 2.1 Roll Function

New file: `module/dice/d66-roll.mjs`

Exports an async `rollD66(tableKey, actor)` function:

1. Rolls `2d6` as two separate `1d6` Roll instances (needed to read individual results)
2. First die = tens digit, second die = ones digit → combine to D66 key (e.g., 3 and 5 → `"35"`)
3. Looks up result in `CONFIG.DREADLIGHT.d66Tables[tableKey]`
4. Returns `{ roll1, roll2, d66Key, entry, tableKey }`

### 2.2 Dice So Nice Integration

Both dice use the `dreadlight-base` colorset. The roll triggers DSN animation before posting the chat card.

---

## 3. Chat Card

### 3.1 Result Card

New template: `templates/chat/d66-result.hbs`

Structure (top to bottom):
- **Accent line** — gradient colored by table type:
  - Body: `--dl-track-body` (#55b87a green)
  - Mind: `--dl-track-mind` (#6b9df5 blue)
  - Soul: `--dl-track-soul` (#a88bf5 purple)
- **Character portrait header** — same frameless style as existing roll cards (portrait background, gradient fade, name overlay)
- **Table label** — e.g., "CRITICAL INJURY", "TRAUMA", "SOUL MANIFESTATION" in gold letter-spaced text
- **Dice display** — two dice showing the tens and ones values, with D66 result number (e.g., "35")
- **Result name** — prominently displayed
- **Effect text** — description of the consequence
- **Heal time badge** — small tag showing recovery duration
- **Lethal treatment** — lethal results (death entries) get red pulsing border and a skull/death icon, similar to dire success styling

### 3.2 Trigger Notification Card

New template: `templates/chat/d66-prompt.hbs`

Posted when a track reaches 0. Structure:
- Accent line colored by track type
- Character name and portrait header
- Message: "[Character]'s [Body/Mind/Soul] is broken"
- Button: "Roll [Critical Injury / Trauma / Manifestation]"
- Button click calls `rollD66()` for the appropriate table and posts the result card

### 3.3 Chat Message Handling

Extend `module/dice/chat-message.mjs` to:
- Register click listeners for D66 prompt buttons
- Handle rendering D66 result cards
- Store roll data in chat message flags (`flags.dreadlight.d66`) for reconstruction

---

## 4. Automatic Trigger

### 4.1 Track Break Detection

Use the `updateActor` hook (not sheet-specific handling) to detect when a track's value changes to 0 from a non-zero value. This ensures detection works regardless of how the track was modified (sheet clicks, macros, API calls).

When detected:
- Post the trigger notification card (section 3.2) to chat
- The GM clicks the button when narratively appropriate

### 4.2 Trigger Conditions

| Trigger | Table | Notes |
|---|---|---|
| Body track reaches 0 | `body` (Critical Injury) | Also triggers on crit threshold hits, but that's manual-only for Phase 1 |
| Mind track reaches 0 | `mind` (Trauma) | |
| Soul track reaches 0 | `soul` (Manifestation) | |

Crit-threshold triggers (damage >= weapon crit value) are manual-only for now — automatic detection would require hooking into damage application, which isn't built yet.

---

## 5. Manual Trigger

### 5.1 UI Access

Add a small icon button (e.g., a d66/table icon) next to each track in the tracks bar on the character sheet. Clicking it directly calls `rollD66()` for that track's table and posts the result card.

No confirmation dialog needed — the GM can see the result and decide how to apply it narratively.

### 5.2 Styling

The button uses the existing icon button patterns from the tracks bar. Muted by default, gold hover glow on mouseover, consistent with the sheet's interactive element styling.

---

## 6. File Changes Summary

| File | Change |
|---|---|
| `module/data/d66-tables.mjs` | **New** — table data for body, mind, soul |
| `module/dice/d66-roll.mjs` | **New** — `rollD66()` function |
| `templates/chat/d66-result.hbs` | **New** — result card template |
| `templates/chat/d66-prompt.hbs` | **New** — trigger notification card template |
| `module/dice/chat-message.mjs` | **Modify** — add D66 button listeners and rendering |
| `dreadlight.mjs` | **Modify** — register tables on CONFIG, preload new templates |
| `templates/actors/parts/tracks.hbs` | **Modify** — add manual roll buttons to tracks |
| `module/sheets/investigator-sheet.mjs` | **Modify** — add manual roll click handler, track break detection |
| `styles/dreadlight.css` | **Modify** — D66 card styles, prompt card styles, lethal treatment |
| `lang/en.json` | **Modify** — add D66-related localization keys |

---

## 7. Out of Scope

- Vehicle damage D66 table (no vehicle actor type yet)
- Automatic consequence application (auto-adding conditions/marks from D66 results)
- Crit-threshold auto-detection (requires damage application system)
- Editable/custom D66 tables (these are fixed game rules)
