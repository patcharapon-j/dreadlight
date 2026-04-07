# Insight — Passive Notification Module for FoundryVTT

**Date:** 2026-04-07
**Status:** Design approved
**Type:** System-agnostic FoundryVTT module

## Overview

Insight is a FoundryVTT module that lets the GM deliver passive information to individual players through elegant, cinematic notifications. Designed for passive checks, secret rolls, and narrative reveals — moments where a character notices something without actively looking.

The module is **system-agnostic** with built-in theme presets (Dreadlight, Fantasy) and full CSS custom property support for custom themes.

## Core Interaction

### GM Workflow
1. GM clicks a dedicated button (scene controls or floating action button) to open a **Compose Dialog**
2. Dialog provides: target player selection, title field, body text (rich text — bold/italic), optional image, optional theme override
3. GM sends — notification is delivered via FoundryVTT socket to the target player's client

### Player Experience
1. A thin gradient line slides in from the right edge at center-right of the screen (Stage 1 — with sound)
2. After a beat, a card materializes: two offset panels creating a fractured depth effect, the back layer shifts subtly (Stage 2)
3. Content fades in with staggered timing — label, title, divider, body text (Stage 3)
4. Notification persists until the player clicks "Dismiss"
5. If multiple notifications arrive, they **queue** — one at a time, each gets its full cinematic entrance

## Architecture

**Socket-based, ephemeral.** No database writes, no settings storage, no journal entries. GM dialog sends a socket message; the player's client renders and animates the notification in the DOM. Notifications are lost on page refresh — this is intentional; they're meant to be read and dismissed.

### Components

| Component | Purpose |
|---|---|
| **ComposeDialog** | AppV2 dialog for GM to write and send notifications |
| **SocketHandler** | Registers socket namespace, sends/receives notification payloads |
| **NotificationRenderer** | Creates DOM elements, manages the three-stage animation lifecycle |
| **ThemeEngine** | Loads theme presets, applies CSS custom properties |
| **SoundManager** | Plays theme-matched sounds at Stage 1 and Stage 2 |
| **QueueManager** | Ensures one notification at a time, sequences dismiss → next reveal |

### Data Flow

```
GM ComposeDialog
    → SocketHandler.send({ target, title, body, image?, theme? })
    → FoundryVTT socket (game.socket)
    → Target player's SocketHandler.receive()
    → QueueManager.enqueue(payload)
    → NotificationRenderer.render() (when queue is ready)
    → SoundManager.play() (at Stage 1 & 2)
    → Player dismisses → QueueManager.next()
```

### Socket Payload

```javascript
{
  type: "insight.notification",
  target: "player-user-id",
  title: "A Faint Presence",
  body: "The hairs on your neck rise...",  // supports <b>, <i> tags
  image: null,                              // optional image URL
  theme: null,                              // optional override, defaults to module setting
  sense: "Perception"                       // optional label above title
}
```

## Visual Design: "Fracture"

The notification uses a **layered depth** design with two offset panels creating a fractured/corrupted feel. The back panel shifts subtly via CSS animation, adding an unsettling organic quality.

### Three-Stage Animation

| Stage | Timing | Element | Animation |
|---|---|---|---|
| 1 — Line | 0ms | Gradient line (gold-to-purple for Dreadlight, amber for Fantasy) | `scaleX(0→1)` from right, 0.5s spring easing + sound |
| 2 — Card | 600ms | Offset panels appear, back panel begins glitch-shift | `max-height: 0→350px`, `opacity: 0→1`, 0.5s spring + sound |
| 3 — Content | 900ms+ | Icon, sense label, title, divider, body, dismiss (staggered ~150ms each) | `opacity: 0→1`, `translateY(4px→0)`, 0.35s ease |

**Dismiss animation:** Card slides right with opacity fade (0.4s), back panel fades separately.

**Spring easing:** `cubic-bezier(0.22, 1, 0.36, 1)` — matches Dreadlight system easing.

### Structural Elements

- **Gradient line:** 2px, horizontal, gradient from gold to secondary color, with box-shadow glow
- **Back panel:** Offset by `translate(3px, 2px)`, subtle `fracture-shift` keyframe animation (4s loop)
- **Front panel:** Main card with radial gradient atmospheric glow (two ellipses at opposing corners)
- **Sense label row:** Small icon (square for Dreadlight, circle for Fantasy) + uppercase label
- **Title:** Bold, larger font, with text-shadow
- **Divider:** 1px gradient line, gold fading to secondary color
- **Body text:** Secondary color, italic for Fantasy, left accent border (2px)
- **Dismiss:** Right-aligned, muted, uppercase, hover highlights

### Position

- **Location:** Right edge of screen, vertically centered (`right: 40px; top: 50%; transform: translateY(-50%)`)
- **Width:** 340px
- **Z-index:** Above game canvas, below Foundry UI dialogs (z-index: 100)

## Theme System

### Theme Presets

#### Dreadlight (Tech Horror)
| Token | Value |
|---|---|
| `--insight-bg` | `#08080c` |
| `--insight-bg-back` | `#0a0a12` |
| `--insight-border` | `rgba(201, 169, 110, 0.12)` |
| `--insight-border-back` | `rgba(168, 139, 245, 0.1)` |
| `--insight-line-from` | `#c9a96e` |
| `--insight-line-to` | `rgba(168, 139, 245, 0.6)` |
| `--insight-title-color` | `#ededf4` |
| `--insight-body-color` | `#8e8ea3` |
| `--insight-label-color` | `#555568` |
| `--insight-accent` | `#c9a96e` |
| `--insight-accent-secondary` | `#a88bf5` |
| `--insight-font-title` | `'Monaspace Krypton', monospace` |
| `--insight-font-body` | `'Monaspace Neon', monospace` |
| `--insight-font-label` | `'Monaspace Krypton', monospace` |
| `--insight-glow-1` | `rgba(168, 139, 245, 0.06)` |
| `--insight-glow-2` | `rgba(201, 169, 110, 0.04)` |
| `--insight-icon-radius` | `2px` |
| `--insight-body-style` | `normal` |

#### Fantasy (Classic Adventure)
| Token | Value |
|---|---|
| `--insight-bg` | `#120d08` |
| `--insight-bg-back` | `#15100a` |
| `--insight-border` | `rgba(212, 168, 87, 0.15)` |
| `--insight-border-back` | `rgba(139, 90, 43, 0.12)` |
| `--insight-line-from` | `#d4a857` |
| `--insight-line-to` | `rgba(139, 90, 43, 0.5)` |
| `--insight-title-color` | `#e8d5a8` |
| `--insight-body-color` | `#b8a88a` |
| `--insight-label-color` | `rgba(212, 168, 87, 0.5)` |
| `--insight-accent` | `#d4a857` |
| `--insight-accent-secondary` | `#c8956e` |
| `--insight-font-title` | `'IM Fell English', serif` |
| `--insight-font-body` | `'Crimson Pro', serif` |
| `--insight-font-label` | `'Crimson Pro', serif` |
| `--insight-glow-1` | `rgba(212, 168, 87, 0.06)` |
| `--insight-glow-2` | `rgba(139, 90, 43, 0.04)` |
| `--insight-icon-radius` | `50%` |
| `--insight-body-style` | `italic` |

### Custom Theming

Other system developers can override any `--insight-*` CSS custom property. The module also exposes a `CONFIG.INSIGHT.themes` registry where themes can be registered programmatically:

```javascript
CONFIG.INSIGHT.themes.register("my-theme", {
  label: "My System Theme",
  cssFile: "modules/my-module/styles/insight-theme.css"
});
```

## Sound Design

Each theme ships with its own sound set. Sounds are short, subtle, and non-intrusive.

| Theme | Stage 1 (Line) | Stage 2 (Card Expand) |
|---|---|---|
| Dreadlight | Low eerie tone/whisper (~0.8s) | Atmospheric swell, unsettling resonance (~1.2s) |
| Fantasy | Soft mystical chime (~0.6s) | Warm arcane shimmer/bell (~1.0s) |

Sounds are played via FoundryVTT's `AudioHelper.play()` for proper volume control integration. Sound can be disabled per-client in module settings.

## GM Compose Dialog

An AppV2 dialog (`InsightComposeDialog`) with the following fields:

- **Target:** Dropdown of connected players (multi-select supported for sending to multiple players)
- **Sense label:** Optional short text (e.g., "Perception", "Insight", "Keen Senses") — displayed as the small uppercase label
- **Title:** Required, short title for the notification
- **Body:** Required, rich text area supporting bold (`<b>`) and italic (`<i>`)
- **Image:** Optional, file picker for an image URL (journal art, token image, etc.)
- **Send button:** Dispatches via socket

The dialog stays open after sending so the GM can quickly compose another notification for a different player. A small confirmation flash appears on send.

## Module Settings

| Setting | Scope | Type | Default | Description |
|---|---|---|---|---|
| `theme` | world | String | `"dreadlight"` | Active theme preset |
| `soundEnabled` | client | Boolean | `true` | Enable/disable notification sounds |
| `soundVolume` | client | Number | `0.5` | Notification sound volume (0–1) |
| `animationSpeed` | client | String | `"normal"` | `"normal"`, `"fast"`, `"instant"` |
| `position` | world | String | `"center-right"` | Notification position on screen |

## Module Structure

```
modules/insight/
├── module.json              # Module manifest
├── insight.mjs              # Entry point — hooks, socket, settings
├── module/
│   ├── compose-dialog.mjs   # GM compose dialog (AppV2)
│   ├── notification.mjs     # Notification renderer + animation
│   ├── queue.mjs            # Queue manager
│   ├── socket.mjs           # Socket handler
│   ├── themes.mjs           # Theme engine + preset loader
│   └── sound.mjs            # Sound manager
├── styles/
│   ├── insight.css          # Core notification styles (CSS custom properties)
│   ├── theme-dreadlight.css # Dreadlight theme preset
│   └── theme-fantasy.css    # Fantasy theme preset
├── templates/
│   ├── compose-dialog.hbs   # GM compose dialog template
│   └── notification.hbs     # Notification HTML template
├── sounds/
│   ├── dreadlight-line.ogg  # Dreadlight Stage 1 sound
│   ├── dreadlight-reveal.ogg# Dreadlight Stage 2 sound
│   ├── fantasy-line.ogg     # Fantasy Stage 1 sound
│   └── fantasy-reveal.ogg   # Fantasy Stage 2 sound
└── lang/
    └── en.json              # Localization strings
```

## FoundryVTT Integration

- **Minimum version:** FoundryVTT v12 (AppV2 support)
- **Socket namespace:** `module.insight`
- **Scene controls:** Adds a button to the token controls group (eye icon)
- **No system dependencies** — works with any game system
- **No compendium packs** — pure runtime module

## Out of Scope (v1)

- Notification history/log (future v2 feature)
- Macro/API for programmatic notification sending (future — useful for system integration)
- Player-to-GM notifications
- Animated/particle effects beyond the fracture shift
- Multiple simultaneous notifications (queue only)
