# Omen Tracker UI — Design Spec

**Date**: 2026-04-07
**Status**: Draft

## Overview

A persistent, top-center HUD element that displays the GM's Omen pool to all connected clients. The GM can adjust the value with click interactions; players can see it but not modify it.

Omen is a global GM resource, separate from individual investigator Dread values. It accumulates from roll failures (+1) and push Dread 6s (+1 per Dread 6). The GM spends Omen to trigger narrative consequences.

## Visual Design

### Style: Minimal Sigil

A compact horizontal bar matching the Dreadlight design language:

```
[ ◆  OMEN  3 ]
```

- **Icon**: Diamond sigil (◆), dread-red with drop-shadow glow
- **Label**: "OMEN" in 9px uppercase, letter-spacing 2px, muted gray (`#555568`)
- **Value**: 20px bold number, dread-red (`#e05555`) with text-shadow glow
- **Container**: Rounded 4px, backdrop-filter blur(8px), subtle red gradient background
- **Top accent line**: 1px gradient (transparent → red → transparent)
- **Hover**: Border brightens, 12px box-shadow glow appears
- **Transition**: All changes use `cubic-bezier(0.22, 1, 0.36, 1)` matching the system easing

### Escalation States

Visual intensity scales with the Omen count via a `data-omen` attribute:

| State | Omen Value | Visual |
|-------|-----------|--------|
| Dormant | 0 | Muted gray icon/value, near-invisible border (`rgba(224,85,85,0.1)`), no glow |
| Active | 1–4 | Dread-red icon/value, visible border (`rgba(224,85,85,0.25)`), subtle glow |
| High | 5+ | Intensified glow (14px text-shadow, 18px box-shadow), stronger border (`rgba(224,85,85,0.5)`) |

The threshold for "High" is hardcoded at 5 (matching the default `dreadMax` setting). This is a cosmetic threshold only — there is no functional maximum.

### Positioning

- Anchored to `#ui-top` in the FoundryVTT UI layer
- Horizontally centered, 8px below the scene navigation bar
- `z-index: 100` to float above the canvas but below dialogs/sheets
- `position: fixed` so it stays visible during canvas pan/zoom

## Interaction

### GM (isGM === true)

- **Left click**: Increment Omen by 1. Brief CSS scale animation on the value (pulse up then back).
- **Right click**: Decrement Omen by 1, minimum 0. Suppress the browser context menu on this element. Brief CSS scale animation (pulse down then back).
- **Cursor**: `pointer`

### Players (isGM === false)

- No click handlers registered
- **Cursor**: `default`
- Element is identical visually — players see the same tracker, same escalation states

## Data Storage

### World Setting

```js
game.settings.register("dreadlight", "omenPool", {
  name: "DREADLIGHT.SettingOmenPool",
  hint: "DREADLIGHT.SettingOmenPoolHint",
  scope: "world",       // Shared across all clients
  config: false,         // Not shown in settings UI — managed via the tracker
  type: Number,
  default: 0,
  requiresReload: false
});
```

- **Scope**: `world` — single value shared by all connected clients
- **Config**: `false` — hidden from the settings menu; the tracker is the only interface
- **Permissions**: Only GM can write (`scope: "world"` enforces this by default in FoundryVTT)

### Reactivity

When the GM clicks to change the value:
1. `game.settings.set("dreadlight", "omenPool", newValue)` is called
2. FoundryVTT broadcasts the setting change to all clients automatically
3. Each client's tracker listens for the `updateSetting` hook filtered to `dreadlight.omenPool`
4. The tracker re-renders with the new value and updates `data-omen` for CSS escalation

No socket communication or custom hooks needed — world settings handle multi-client sync natively.

## Implementation

### Module

A standalone module (not an AppV2 window) that creates and manages a DOM element directly:

```
module/apps/omen-tracker.mjs    — OmenTracker class (plain JS, not Application subclass)
```

- On `ready` hook: creates the tracker DOM element from a template string, appends it to `#ui-top`
- Listens for `updateSetting` hook to update the displayed value and `data-omen` attribute
- Click/contextmenu handlers bound on creation, guarded by `game.user.isGM`
- Exposes a static `OmenTracker.init()` method called from `dreadlight.mjs`

This avoids AppV2's window chrome (header bar, close button, drag handles) which would be inappropriate for a persistent HUD element.

### Markup

Generated as an inline template string within the class (no `.hbs` file needed for this minimal markup):

```html
<div class="dreadlight omen-tracker" data-omen="${omen}">
  <span class="omen-icon">&#9670;</span>
  <span class="omen-label">${game.i18n.localize("DREADLIGHT.Omen")}</span>
  <span class="omen-value">${omen}</span>
</div>
```

### CSS

Added to `styles/dreadlight.css` under a new `/* --- Omen Tracker HUD --- */` section. Uses existing design tokens (colors, easing, border patterns). Scoped under `.dreadlight.omen-tracker` to avoid conflicts.

### Registration

In `dreadlight.mjs` `init` hook:
- Register the `omenPool` world setting

In `dreadlight.mjs` `ready` hook:
- Call `OmenTracker.init()` to create and mount the tracker element

### Localization

New keys in `lang/en.json`:

```json
"DREADLIGHT.Omen": "Omen",
"DREADLIGHT.SettingOmenPool": "Omen Pool",
"DREADLIGHT.SettingOmenPoolHint": "The GM's current Omen pool value."
```

## Scope Boundaries

**In scope:**
- Static HUD display with click interaction
- World setting storage and multi-client sync
- Visual escalation states
- GM/player permission split

**Out of scope (future work):**
- Auto-tracking from roll results (currently "GM gains Omen" is a chat reminder only)
- Omen spending UI (GM just clicks to decrement)
- Sound effects or screen shake on Omen changes
- Configurable escalation thresholds
