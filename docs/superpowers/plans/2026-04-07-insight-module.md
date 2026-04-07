# Insight Module Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a system-agnostic FoundryVTT module that delivers cinematic "Fracture" notifications from GM to individual players via socket, with Dreadlight and Fantasy theme presets.

**Architecture:** Socket-based ephemeral notifications. GM opens a compose dialog, picks a player, writes content, sends. The target player's client receives via `game.socket`, enqueues the notification, and renders a three-stage animated "Fracture" card (line → card expand → content fade). One notification visible at a time; queue handles sequencing. Themes are CSS custom property presets.

**Tech Stack:** FoundryVTT v12+ APIs (ApplicationV2, HandlebarsApplicationMixin, game.socket, AudioHelper), vanilla CSS with custom properties, Handlebars templates, Web Audio API for procedural sound generation.

**Module root:** `C:\Users\patch\AppData\Local\FoundryVTT\Data\modules\insight\`

**Testing:** No automated test framework. Each task includes manual verification steps — reload FoundryVTT (F5) and confirm behavior in browser. Use two browser tabs (one GM, one player) to test socket communication.

**Important FoundryVTT v13 patterns (from the Dreadlight system):**
- AppV2 dialogs: `HandlebarsApplicationMixin(ApplicationV2)` with `static DEFAULT_OPTIONS`, `static PARTS`, `_prepareContext()`
- Settings: `game.settings.register("insight", key, config)`
- Socket: `game.socket.emit("module.insight", payload)` / `game.socket.on("module.insight", handler)`
- Scene controls: `Hooks.on("getSceneControlButtons", controls => { ... })`

---

## File Map

```
modules/insight/
├── module.json                  # Module manifest (FoundryVTT v12+ format)
├── insight.mjs                  # Entry point — init/ready hooks, wires all components
├── module/
│   ├── settings.mjs             # Module settings registration
│   ├── socket.mjs               # Socket send/receive handler
│   ├── queue.mjs                # Notification queue (one-at-a-time sequencing)
│   ├── notification.mjs         # DOM renderer + three-stage animation lifecycle
│   ├── sound.mjs                # Procedural sound generation via Web Audio API
│   ├── themes.mjs               # Theme preset definitions + CSS variable applicator
│   └── compose-dialog.mjs       # GM compose dialog (AppV2)
├── styles/
│   └── insight.css              # All notification styles (themes via CSS custom properties)
├── templates/
│   ├── notification.hbs         # Notification HTML structure
│   └── compose-dialog.hbs       # GM compose dialog template
└── lang/
    └── en.json                  # Localization strings
```

---

### Task 1: Module Scaffold

**Files:**
- Create: `modules/insight/module.json`
- Create: `modules/insight/insight.mjs`
- Create: `modules/insight/lang/en.json`

- [ ] **Step 1: Create module.json**

```json
{
  "id": "insight",
  "title": "Insight — Passive Notifications",
  "description": "Deliver passive perception, secret checks, and narrative reveals to individual players with cinematic notifications.",
  "version": "0.1.0",
  "compatibility": {
    "minimum": "12",
    "verified": "13"
  },
  "authors": [
    {
      "name": "Dreadlight Dev"
    }
  ],
  "esmodules": ["insight.mjs"],
  "styles": ["styles/insight.css"],
  "languages": [
    {
      "lang": "en",
      "name": "English",
      "path": "lang/en.json"
    }
  ],
  "socket": true
}
```

- [ ] **Step 2: Create minimal entry point**

```javascript
// insight.mjs — Insight Module Entry Point

Hooks.once("init", () => {
  console.log("Insight | Initializing module");
});

Hooks.once("ready", () => {
  console.log("Insight | Module ready");
});
```

- [ ] **Step 3: Create localization file**

```json
{
  "INSIGHT.ModuleTitle": "Insight",

  "INSIGHT.SettingTheme": "Notification Theme",
  "INSIGHT.SettingThemeHint": "Visual theme for Insight notifications.",
  "INSIGHT.ThemeDreadlight": "Dreadlight",
  "INSIGHT.ThemeFantasy": "Fantasy",

  "INSIGHT.SettingSoundEnabled": "Enable Sounds",
  "INSIGHT.SettingSoundEnabledHint": "Play sounds when notifications appear.",
  "INSIGHT.SettingSoundVolume": "Sound Volume",
  "INSIGHT.SettingSoundVolumeHint": "Volume level for notification sounds.",
  "INSIGHT.SettingAnimationSpeed": "Animation Speed",
  "INSIGHT.SettingAnimationSpeedHint": "Speed of notification animations.",
  "INSIGHT.AnimationNormal": "Normal",
  "INSIGHT.AnimationFast": "Fast",
  "INSIGHT.AnimationInstant": "Instant",

  "INSIGHT.ComposeTitle": "Send Insight",
  "INSIGHT.ComposeTarget": "Target Player",
  "INSIGHT.ComposeTargetHint": "Select which player receives this notification.",
  "INSIGHT.ComposeSense": "Sense Label",
  "INSIGHT.ComposeSenseHint": "Optional label (e.g., Perception, Insight).",
  "INSIGHT.ComposeNotifTitle": "Title",
  "INSIGHT.ComposeTitleHint": "Short title for the notification.",
  "INSIGHT.ComposeBody": "Body",
  "INSIGHT.ComposeBodyHint": "The message content. Supports <b>bold</b> and <i>italic</i>.",
  "INSIGHT.ComposeImage": "Image",
  "INSIGHT.ComposeImageHint": "Optional image URL.",
  "INSIGHT.ComposeSend": "Send",
  "INSIGHT.ComposeSent": "Sent!",

  "INSIGHT.Dismiss": "Dismiss",
  "INSIGHT.SceneControl": "Send Insight"
}
```

- [ ] **Step 4: Create empty CSS file**

Create `modules/insight/styles/insight.css` with a placeholder comment:

```css
/* Insight — Passive Notification Module
   Styles loaded via module.json */
```

- [ ] **Step 5: Verify module loads**

1. Open FoundryVTT → Settings → Manage Modules → Enable "Insight — Passive Notifications"
2. Reload the world (F5)
3. Check browser console for `Insight | Initializing module` and `Insight | Module ready`

- [ ] **Step 6: Commit**

```bash
cd "C:/Users/patch/AppData/Local/FoundryVTT/Data/modules/insight"
git init
git add module.json insight.mjs lang/en.json styles/insight.css
git commit -m "feat: module scaffold with manifest, entry point, and i18n"
```

---

### Task 2: Module Settings

**Files:**
- Create: `modules/insight/module/settings.mjs`
- Modify: `modules/insight/insight.mjs`

- [ ] **Step 1: Create settings.mjs**

```javascript
// module/settings.mjs — Module settings registration

export function registerSettings() {

  game.settings.register("insight", "theme", {
    name: "INSIGHT.SettingTheme",
    hint: "INSIGHT.SettingThemeHint",
    scope: "world",
    config: true,
    type: String,
    default: "dreadlight",
    choices: {
      dreadlight: "INSIGHT.ThemeDreadlight",
      fantasy: "INSIGHT.ThemeFantasy",
    },
  });

  game.settings.register("insight", "soundEnabled", {
    name: "INSIGHT.SettingSoundEnabled",
    hint: "INSIGHT.SettingSoundEnabledHint",
    scope: "client",
    config: true,
    type: Boolean,
    default: true,
  });

  game.settings.register("insight", "soundVolume", {
    name: "INSIGHT.SettingSoundVolume",
    hint: "INSIGHT.SettingSoundVolumeHint",
    scope: "client",
    config: true,
    type: Number,
    default: 0.5,
    range: { min: 0, max: 1, step: 0.1 },
  });

  game.settings.register("insight", "animationSpeed", {
    name: "INSIGHT.SettingAnimationSpeed",
    hint: "INSIGHT.SettingAnimationSpeedHint",
    scope: "client",
    config: true,
    type: String,
    default: "normal",
    choices: {
      normal: "INSIGHT.AnimationNormal",
      fast: "INSIGHT.AnimationFast",
      instant: "INSIGHT.AnimationInstant",
    },
  });

  console.log("Insight | Settings registered");
}
```

- [ ] **Step 2: Wire settings into entry point**

Replace `insight.mjs` with:

```javascript
// insight.mjs — Insight Module Entry Point
import { registerSettings } from "./module/settings.mjs";

Hooks.once("init", () => {
  console.log("Insight | Initializing module");
  registerSettings();
});

Hooks.once("ready", () => {
  console.log("Insight | Module ready");
});
```

- [ ] **Step 3: Verify settings appear**

1. Reload FoundryVTT (F5)
2. Go to Settings → Module Settings
3. Confirm "Notification Theme", "Enable Sounds", "Sound Volume", and "Animation Speed" appear under the Insight section

- [ ] **Step 4: Commit**

```bash
git add module/settings.mjs insight.mjs
git commit -m "feat: register module settings (theme, sound, animation speed)"
```

---

### Task 3: Theme Engine

**Files:**
- Create: `modules/insight/module/themes.mjs`

- [ ] **Step 1: Create themes.mjs with preset definitions**

```javascript
// module/themes.mjs — Theme presets and CSS variable applicator

const THEMES = {
  dreadlight: {
    label: "Dreadlight",
    vars: {
      "--insight-bg": "#08080c",
      "--insight-bg-back": "#0a0a12",
      "--insight-border": "rgba(201, 169, 110, 0.12)",
      "--insight-border-back": "rgba(168, 139, 245, 0.1)",
      "--insight-line-from": "#c9a96e",
      "--insight-line-to": "rgba(168, 139, 245, 0.6)",
      "--insight-title-color": "#ededf4",
      "--insight-body-color": "#8e8ea3",
      "--insight-label-color": "#555568",
      "--insight-accent": "#c9a96e",
      "--insight-accent-secondary": "#a88bf5",
      "--insight-divider-from": "rgba(201, 169, 110, 0.15)",
      "--insight-divider-to": "rgba(168, 139, 245, 0.08)",
      "--insight-glow-1": "rgba(168, 139, 245, 0.06)",
      "--insight-glow-2": "rgba(201, 169, 110, 0.04)",
      "--insight-icon-radius": "2px",
      "--insight-body-style": "normal",
      "--insight-font-title": "'Monaspace Krypton', monospace",
      "--insight-font-body": "'Monaspace Neon', monospace",
      "--insight-font-label": "'Monaspace Krypton', monospace",
      "--insight-dismiss-hover": "#a88bf5",
      "--insight-line-glow": "rgba(201, 169, 110, 0.3)",
      "--insight-title-shadow": "0 1px 6px rgba(0,0,0,0.6)",
    },
  },

  fantasy: {
    label: "Fantasy",
    vars: {
      "--insight-bg": "#120d08",
      "--insight-bg-back": "#15100a",
      "--insight-border": "rgba(212, 168, 87, 0.15)",
      "--insight-border-back": "rgba(139, 90, 43, 0.12)",
      "--insight-line-from": "#d4a857",
      "--insight-line-to": "rgba(139, 90, 43, 0.5)",
      "--insight-title-color": "#e8d5a8",
      "--insight-body-color": "#b8a88a",
      "--insight-label-color": "rgba(212, 168, 87, 0.5)",
      "--insight-accent": "#d4a857",
      "--insight-accent-secondary": "#c8956e",
      "--insight-divider-from": "rgba(212, 168, 87, 0.2)",
      "--insight-divider-to": "rgba(139, 90, 43, 0.08)",
      "--insight-glow-1": "rgba(212, 168, 87, 0.06)",
      "--insight-glow-2": "rgba(139, 90, 43, 0.04)",
      "--insight-icon-radius": "50%",
      "--insight-body-style": "italic",
      "--insight-font-title": "'IM Fell English', serif",
      "--insight-font-body": "'Crimson Pro', serif",
      "--insight-font-label": "'Crimson Pro', serif",
      "--insight-dismiss-hover": "#d4a857",
      "--insight-line-glow": "rgba(212, 168, 87, 0.25)",
      "--insight-title-shadow": "0 1px 4px rgba(0,0,0,0.5)",
    },
  },
};

/**
 * Apply a theme's CSS custom properties to a DOM element.
 * @param {HTMLElement} element - The notification container element
 * @param {string} [themeId] - Theme ID. Defaults to the module setting.
 */
export function applyTheme(element, themeId) {
  const id = themeId ?? game.settings.get("insight", "theme");
  const theme = THEMES[id] ?? THEMES.dreadlight;
  for (const [prop, value] of Object.entries(theme.vars)) {
    element.style.setProperty(prop, value);
  }
}

/**
 * Get the current theme ID from settings.
 * @returns {string}
 */
export function getCurrentTheme() {
  return game.settings.get("insight", "theme");
}

/**
 * Get all registered theme IDs.
 * @returns {string[]}
 */
export function getThemeIds() {
  return Object.keys(THEMES);
}

/**
 * Register a custom theme. Called by other modules/systems to add themes.
 * @param {string} id - Unique theme identifier
 * @param {object} config - Theme config with `label` and `vars` properties
 */
export function registerTheme(id, config) {
  if (!config.label || !config.vars) {
    console.error(`Insight | Invalid theme config for "${id}": needs label and vars`);
    return;
  }
  THEMES[id] = config;
  console.log(`Insight | Registered custom theme: ${config.label}`);
}
```

- [ ] **Step 2: Verify in console**

1. Reload FoundryVTT (F5)
2. In browser console, confirm no errors from the module
3. (Themes will be exercised when the notification renderer is built)

- [ ] **Step 3: Commit**

```bash
git add module/themes.mjs
git commit -m "feat: theme engine with Dreadlight and Fantasy presets"
```

---

### Task 4: Sound Manager

**Files:**
- Create: `modules/insight/module/sound.mjs`

- [ ] **Step 1: Create sound.mjs with procedural audio**

Uses the Web Audio API to generate short synthesized tones — no audio files needed. Each theme has a distinct sonic character.

```javascript
// module/sound.mjs — Procedural sound generation via Web Audio API

/**
 * Sound profiles per theme. Each has a `line` and `reveal` function
 * that create and play a short procedural sound.
 */
const PROFILES = {
  dreadlight: {
    /** Stage 1: Low eerie tone with slight detuning */
    line(ctx, gain) {
      const osc = ctx.createOscillator();
      const oscSub = ctx.createOscillator();
      const filter = ctx.createBiquadFilter();
      const env = ctx.createGain();

      osc.type = "sine";
      osc.frequency.setValueAtTime(180, ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(120, ctx.currentTime + 0.8);

      oscSub.type = "sine";
      oscSub.frequency.setValueAtTime(183, ctx.currentTime);
      oscSub.frequency.exponentialRampToValueAtTime(122, ctx.currentTime + 0.8);
      oscSub.detune.setValueAtTime(8, ctx.currentTime);

      filter.type = "lowpass";
      filter.frequency.setValueAtTime(600, ctx.currentTime);

      env.gain.setValueAtTime(0, ctx.currentTime);
      env.gain.linearRampToValueAtTime(gain * 0.4, ctx.currentTime + 0.1);
      env.gain.linearRampToValueAtTime(gain * 0.25, ctx.currentTime + 0.5);
      env.gain.linearRampToValueAtTime(0, ctx.currentTime + 0.8);

      osc.connect(filter);
      oscSub.connect(filter);
      filter.connect(env);
      env.connect(ctx.destination);

      osc.start(ctx.currentTime);
      oscSub.start(ctx.currentTime);
      osc.stop(ctx.currentTime + 0.9);
      oscSub.stop(ctx.currentTime + 0.9);
    },

    /** Stage 2: Atmospheric swell with harmonic overtones */
    reveal(ctx, gain) {
      const osc = ctx.createOscillator();
      const osc2 = ctx.createOscillator();
      const filter = ctx.createBiquadFilter();
      const env = ctx.createGain();

      osc.type = "triangle";
      osc.frequency.setValueAtTime(220, ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(260, ctx.currentTime + 0.6);
      osc.frequency.exponentialRampToValueAtTime(200, ctx.currentTime + 1.2);

      osc2.type = "sine";
      osc2.frequency.setValueAtTime(330, ctx.currentTime);
      osc2.frequency.exponentialRampToValueAtTime(390, ctx.currentTime + 0.6);
      osc2.frequency.exponentialRampToValueAtTime(310, ctx.currentTime + 1.2);

      filter.type = "lowpass";
      filter.frequency.setValueAtTime(400, ctx.currentTime);
      filter.frequency.linearRampToValueAtTime(900, ctx.currentTime + 0.6);
      filter.frequency.linearRampToValueAtTime(300, ctx.currentTime + 1.2);

      env.gain.setValueAtTime(0, ctx.currentTime);
      env.gain.linearRampToValueAtTime(gain * 0.3, ctx.currentTime + 0.3);
      env.gain.linearRampToValueAtTime(gain * 0.2, ctx.currentTime + 0.8);
      env.gain.linearRampToValueAtTime(0, ctx.currentTime + 1.2);

      osc.connect(filter);
      osc2.connect(filter);
      filter.connect(env);
      env.connect(ctx.destination);

      osc.start(ctx.currentTime);
      osc2.start(ctx.currentTime);
      osc.stop(ctx.currentTime + 1.3);
      osc2.stop(ctx.currentTime + 1.3);
    },
  },

  fantasy: {
    /** Stage 1: Soft mystical chime */
    line(ctx, gain) {
      const osc = ctx.createOscillator();
      const osc2 = ctx.createOscillator();
      const env = ctx.createGain();

      osc.type = "sine";
      osc.frequency.setValueAtTime(880, ctx.currentTime);

      osc2.type = "sine";
      osc2.frequency.setValueAtTime(1320, ctx.currentTime);

      env.gain.setValueAtTime(0, ctx.currentTime);
      env.gain.linearRampToValueAtTime(gain * 0.25, ctx.currentTime + 0.02);
      env.gain.exponentialRampToValueAtTime(gain * 0.08, ctx.currentTime + 0.3);
      env.gain.linearRampToValueAtTime(0, ctx.currentTime + 0.6);

      osc.connect(env);
      osc2.connect(env);
      env.connect(ctx.destination);

      osc.start(ctx.currentTime);
      osc2.start(ctx.currentTime);
      osc.stop(ctx.currentTime + 0.7);
      osc2.stop(ctx.currentTime + 0.7);
    },

    /** Stage 2: Warm arcane shimmer */
    reveal(ctx, gain) {
      const notes = [523.25, 659.25, 783.99]; // C5, E5, G5 major chord
      const oscs = notes.map(freq => {
        const osc = ctx.createOscillator();
        osc.type = "sine";
        osc.frequency.setValueAtTime(freq, ctx.currentTime);
        return osc;
      });

      const env = ctx.createGain();
      env.gain.setValueAtTime(0, ctx.currentTime);
      env.gain.linearRampToValueAtTime(gain * 0.2, ctx.currentTime + 0.1);
      env.gain.linearRampToValueAtTime(gain * 0.15, ctx.currentTime + 0.5);
      env.gain.linearRampToValueAtTime(0, ctx.currentTime + 1.0);

      oscs.forEach(osc => {
        osc.connect(env);
        osc.start(ctx.currentTime);
        osc.stop(ctx.currentTime + 1.1);
      });

      env.connect(ctx.destination);
    },
  },
};

/** @type {AudioContext|null} */
let audioCtx = null;

/**
 * Get or create the shared AudioContext.
 * @returns {AudioContext}
 */
function getContext() {
  if (!audioCtx) audioCtx = new AudioContext();
  return audioCtx;
}

/**
 * Play a notification sound.
 * @param {"line"|"reveal"} stage - Which stage sound to play
 * @param {string} [themeId] - Theme ID. Defaults to the module setting.
 */
export function playSound(stage, themeId) {
  if (!game.settings.get("insight", "soundEnabled")) return;

  const id = themeId ?? game.settings.get("insight", "theme");
  const profile = PROFILES[id] ?? PROFILES.dreadlight;
  const fn = profile[stage];
  if (!fn) return;

  const ctx = getContext();
  if (ctx.state === "suspended") ctx.resume();

  const volume = game.settings.get("insight", "soundVolume");
  fn(ctx, volume);
}
```

- [ ] **Step 2: Verify sound plays in console**

1. Reload FoundryVTT (F5)
2. In console, import and test:
   ```javascript
   import("./modules/insight/module/sound.mjs").then(m => m.playSound("line", "dreadlight"))
   ```
3. Confirm a low eerie tone plays

- [ ] **Step 3: Commit**

```bash
git add module/sound.mjs
git commit -m "feat: procedural sound generation with Dreadlight and Fantasy profiles"
```

---

### Task 5: Notification Template and CSS

**Files:**
- Create: `modules/insight/templates/notification.hbs`
- Modify: `modules/insight/styles/insight.css`

- [ ] **Step 1: Create notification.hbs template**

```handlebars
<div class="insight-notification" data-id="{{id}}">
  <div class="insight-fracture-line"></div>
  <div class="insight-fracture-card">
    <div class="insight-fracture-bg-back"></div>
    <div class="insight-fracture-bg-front">
      <div class="insight-fracture-inner">
        {{#if sense}}
        <div class="insight-label-row">
          <div class="insight-icon">&#x25C8;</div>
          <div class="insight-sense">{{sense}}</div>
        </div>
        {{/if}}
        <div class="insight-title">{{title}}</div>
        <div class="insight-divider"></div>
        {{#if image}}
        <img class="insight-image" src="{{image}}" alt="">
        {{/if}}
        <div class="insight-body">{{{body}}}</div>
      </div>
      <button class="insight-dismiss" data-action="dismiss">
        &#x2715; {{localize "INSIGHT.Dismiss"}}
      </button>
    </div>
  </div>
</div>
```

- [ ] **Step 2: Write the full CSS**

Replace `styles/insight.css` with the complete notification styles. All visual properties use `var(--insight-*)` tokens so themes control appearance.

```css
/* ============================================================
   INSIGHT — Passive Notification Module
   Fracture design with CSS custom property theming
   ============================================================ */

/* ----------------------------------------------------------
   FONT FACES
   ---------------------------------------------------------- */

@font-face {
  font-family: 'Monaspace Krypton';
  src: url('https://cdn.jsdelivr.net/gh/githubnext/monaspace@v1.101/fonts/webfonts/MonaspaceKrypton-Regular.woff') format('woff');
  font-weight: 400;
  font-display: swap;
}

@font-face {
  font-family: 'Monaspace Krypton';
  src: url('https://cdn.jsdelivr.net/gh/githubnext/monaspace@v1.101/fonts/webfonts/MonaspaceKrypton-Bold.woff') format('woff');
  font-weight: 700;
  font-display: swap;
}

@font-face {
  font-family: 'Monaspace Neon';
  src: url('https://cdn.jsdelivr.net/gh/githubnext/monaspace@v1.101/fonts/webfonts/MonaspaceNeon-Regular.woff') format('woff');
  font-weight: 400;
  font-display: swap;
}

@import url('https://fonts.googleapis.com/css2?family=Crimson+Pro:ital,wght@0,400;0,500;0,600;0,700;1,400&family=IM+Fell+English:ital@0;1&display=swap');

/* ----------------------------------------------------------
   NOTIFICATION CONTAINER
   ---------------------------------------------------------- */

.insight-notification {
  position: fixed;
  right: 40px;
  top: 50%;
  transform: translateY(-50%);
  width: 340px;
  z-index: 100;
  pointer-events: auto;
  opacity: 0;
  translate: 40px 0;
}

.insight-notification.insight-visible {
  opacity: 1;
  translate: 0 0;
  transition: opacity 0.5s cubic-bezier(0.22, 1, 0.36, 1),
              translate 0.5s cubic-bezier(0.22, 1, 0.36, 1);
}

/* ----------------------------------------------------------
   STAGE 1: FRACTURE LINE
   ---------------------------------------------------------- */

.insight-fracture-line {
  height: 2px;
  background: linear-gradient(90deg,
    transparent 0%,
    var(--insight-line-from) 15%,
    var(--insight-line-from) 60%,
    var(--insight-line-to) 85%,
    transparent 100%);
  box-shadow: 0 0 8px var(--insight-line-glow);
  border-radius: 1px;
  transform: scaleX(0);
  transform-origin: right center;
}

.insight-fracture-line.insight-visible {
  transform: scaleX(1);
  transition: transform 0.5s cubic-bezier(0.22, 1, 0.36, 1);
}

/* ----------------------------------------------------------
   STAGE 2: FRACTURE CARD
   ---------------------------------------------------------- */

.insight-fracture-card {
  position: relative;
  overflow: hidden;
  max-height: 0;
  opacity: 0;
}

.insight-fracture-card.insight-visible {
  max-height: 500px;
  opacity: 1;
  transition: max-height 0.5s cubic-bezier(0.22, 1, 0.36, 1),
              opacity 0.5s cubic-bezier(0.22, 1, 0.36, 1);
}

/* Back panel — offset for fracture depth effect */
.insight-fracture-bg-back {
  position: absolute;
  inset: 0;
  background: var(--insight-bg-back);
  border: 1px solid var(--insight-border-back);
  border-radius: 4px;
  translate: 3px 2px;
}

.insight-fracture-bg-back.insight-glitch {
  animation: insight-fracture-shift 4s ease-in-out infinite;
}

@keyframes insight-fracture-shift {
  0%, 100% { translate: 3px 2px; }
  25% { translate: 4px 1px; }
  75% { translate: 2px 3px; }
}

/* Front panel — main card */
.insight-fracture-bg-front {
  position: relative;
  background: var(--insight-bg);
  border: 1px solid var(--insight-border);
  border-radius: 4px;
  z-index: 1;
  overflow: hidden;
}

/* Atmospheric radial glow */
.insight-fracture-bg-front::before {
  content: '';
  position: absolute;
  inset: 0;
  background:
    radial-gradient(ellipse at 80% 20%, var(--insight-glow-1) 0%, transparent 50%),
    radial-gradient(ellipse at 20% 80%, var(--insight-glow-2) 0%, transparent 50%);
  pointer-events: none;
}

/* ----------------------------------------------------------
   STAGE 3: CONTENT
   ---------------------------------------------------------- */

.insight-fracture-inner {
  padding: 16px 18px;
  position: relative;
  z-index: 1;
}

/* Sense label row */
.insight-label-row {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 6px;
}

.insight-icon {
  width: 16px;
  height: 16px;
  border: 1px solid color-mix(in srgb, var(--insight-accent) 25%, transparent);
  border-radius: var(--insight-icon-radius);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 9px;
  color: var(--insight-accent);
  opacity: 0;
}

.insight-sense {
  font-family: var(--insight-font-label);
  font-size: 8px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 2px;
  color: var(--insight-label-color);
  opacity: 0;
}

.insight-title {
  font-family: var(--insight-font-title);
  font-size: 13px;
  font-weight: 700;
  color: var(--insight-title-color);
  margin-bottom: 10px;
  text-shadow: var(--insight-title-shadow);
  opacity: 0;
  translate: 0 4px;
}

.insight-divider {
  height: 1px;
  background: linear-gradient(90deg,
    var(--insight-divider-from) 0%,
    var(--insight-divider-to) 60%,
    transparent 100%);
  margin-bottom: 10px;
  opacity: 0;
}

.insight-image {
  width: 100%;
  max-height: 140px;
  object-fit: cover;
  border-radius: 3px;
  margin-bottom: 10px;
  opacity: 0;
  border: 1px solid var(--insight-border);
}

.insight-body {
  font-family: var(--insight-font-body);
  font-size: 11px;
  line-height: 1.7;
  color: var(--insight-body-color);
  font-style: var(--insight-body-style);
  border-left: 2px solid color-mix(in srgb, var(--insight-accent) 10%, transparent);
  padding-left: 12px;
  opacity: 0;
  translate: 0 4px;
}

.insight-body b, .insight-body strong {
  color: var(--insight-title-color);
  font-weight: 600;
}

.insight-body i, .insight-body em {
  font-style: italic;
}

/* Dismiss button */
.insight-dismiss {
  display: block;
  width: 100%;
  font-family: var(--insight-font-label);
  font-size: 8px;
  text-transform: uppercase;
  letter-spacing: 1.5px;
  color: var(--insight-label-color);
  padding: 10px 18px 14px;
  cursor: pointer;
  position: relative;
  z-index: 1;
  text-align: right;
  background: none;
  border: none;
  border-top: 1px solid var(--insight-border);
  opacity: 0;
  transition: color 0.2s ease;
}

.insight-dismiss:hover {
  color: var(--insight-dismiss-hover);
}

/* ----------------------------------------------------------
   CONTENT FADE-IN (applied by JS)
   ---------------------------------------------------------- */

.insight-fade-in {
  opacity: 1 !important;
  translate: 0 0 !important;
  transition: opacity 0.35s ease, translate 0.35s ease;
}

/* ----------------------------------------------------------
   DISMISS ANIMATION
   ---------------------------------------------------------- */

.insight-notification.insight-dismissing {
  opacity: 0;
  translate: 60px 0;
  transition: opacity 0.4s cubic-bezier(0.55, 0, 1, 0.45),
              translate 0.4s cubic-bezier(0.55, 0, 1, 0.45);
}

/* ----------------------------------------------------------
   ANIMATION SPEED VARIANTS
   ---------------------------------------------------------- */

.insight-speed-fast .insight-fracture-line.insight-visible {
  transition-duration: 0.25s;
}
.insight-speed-fast .insight-fracture-card.insight-visible {
  transition-duration: 0.25s;
}
.insight-speed-fast .insight-fade-in {
  transition-duration: 0.15s;
}
.insight-speed-fast.insight-visible {
  transition-duration: 0.25s;
}

.insight-speed-instant .insight-fracture-line.insight-visible,
.insight-speed-instant .insight-fracture-card.insight-visible,
.insight-speed-instant .insight-fade-in,
.insight-speed-instant.insight-visible {
  transition-duration: 0s;
}

/* ----------------------------------------------------------
   COMPOSE DIALOG
   ---------------------------------------------------------- */

.insight-compose {
  background: #1a1a24;
  font-family: system-ui, -apple-system, sans-serif;
  color: #e0e0e8;
}

.insight-compose .window-header {
  background: #12121a;
  border-bottom: 1px solid rgba(255, 255, 255, 0.08);
}

.insight-compose .window-header .window-title {
  color: #e0e0e8;
  font-size: 12px;
  font-weight: 600;
}

.insight-compose-form {
  display: flex;
  flex-direction: column;
  gap: 12px;
  padding: 14px;
}

.insight-compose-form label {
  display: flex;
  flex-direction: column;
  gap: 4px;
  font-size: 11px;
  font-weight: 500;
  color: #8e8ea3;
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.insight-compose-form input,
.insight-compose-form select,
.insight-compose-form textarea {
  background: #0e0e14;
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 4px;
  color: #ededf4;
  font-family: system-ui, -apple-system, sans-serif;
  font-size: 13px;
  padding: 8px 10px;
}

.insight-compose-form input:focus,
.insight-compose-form select:focus,
.insight-compose-form textarea:focus {
  border-color: rgba(201, 169, 110, 0.4);
  outline: none;
  box-shadow: 0 0 0 2px rgba(201, 169, 110, 0.1);
}

.insight-compose-form textarea {
  min-height: 80px;
  resize: vertical;
  line-height: 1.5;
}

.insight-compose-form .hint {
  font-size: 10px;
  color: #555568;
  font-weight: 400;
  text-transform: none;
  letter-spacing: 0;
}

.insight-send-btn {
  background: rgba(201, 169, 110, 0.12);
  border: 1px solid rgba(201, 169, 110, 0.25);
  border-radius: 4px;
  color: #c9a96e;
  font-size: 12px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 1px;
  padding: 10px;
  cursor: pointer;
  transition: all 0.2s ease;
}

.insight-send-btn:hover {
  background: rgba(201, 169, 110, 0.2);
  border-color: rgba(201, 169, 110, 0.4);
}

.insight-send-btn.insight-sent {
  background: rgba(85, 184, 122, 0.15);
  border-color: rgba(85, 184, 122, 0.3);
  color: #55b87a;
}

/* Image row */
.insight-image-row {
  display: flex;
  gap: 8px;
  align-items: flex-end;
}

.insight-image-row input {
  flex: 1;
}

.insight-image-row button {
  background: rgba(255, 255, 255, 0.05);
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 4px;
  color: #8e8ea3;
  padding: 8px 10px;
  cursor: pointer;
  font-size: 13px;
  flex-shrink: 0;
}

.insight-image-row button:hover {
  color: #c9a96e;
  border-color: rgba(201, 169, 110, 0.3);
}
```

- [ ] **Step 3: Verify CSS loads**

1. Reload FoundryVTT (F5)
2. In browser DevTools, confirm `insight.css` appears in the loaded stylesheets
3. Check console for no CSS parsing errors

- [ ] **Step 4: Commit**

```bash
git add templates/notification.hbs styles/insight.css
git commit -m "feat: notification template and complete CSS with theme variables"
```

---

### Task 6: Notification Renderer

**Files:**
- Create: `modules/insight/module/notification.mjs`

- [ ] **Step 1: Create notification.mjs**

This module handles creating the notification DOM element, running the three-stage animation, and handling dismiss.

```javascript
// module/notification.mjs — Notification renderer and animation lifecycle

import { applyTheme } from "./themes.mjs";
import { playSound } from "./sound.mjs";

/**
 * Timing presets for animation stages (milliseconds).
 * Each value is the delay from the start of the animation.
 */
const TIMINGS = {
  normal: {
    line: 100,
    card: 600,
    contentStart: 900,
    contentStagger: 150,
    dismissDelay: 400,
  },
  fast: {
    line: 50,
    card: 300,
    contentStart: 450,
    contentStagger: 80,
    dismissDelay: 200,
  },
  instant: {
    line: 0,
    card: 0,
    contentStart: 0,
    contentStagger: 0,
    dismissDelay: 0,
  },
};

/**
 * Render a notification to the screen with three-stage animation.
 * @param {object} data - Notification payload
 * @param {string} data.id - Unique notification ID
 * @param {string} data.title - Notification title
 * @param {string} data.body - HTML body content
 * @param {string} [data.sense] - Sense label (e.g., "Perception")
 * @param {string} [data.image] - Optional image URL
 * @param {string} [data.theme] - Optional theme override
 * @param {Function} onDismiss - Called when the notification is dismissed
 * @returns {HTMLElement} The notification container element
 */
export async function renderNotification(data, onDismiss) {
  // Load and render template
  const templatePath = "modules/insight/templates/notification.hbs";
  const html = await renderTemplate(templatePath, data);

  // Create container and insert into DOM
  const wrapper = document.createElement("div");
  wrapper.innerHTML = html;
  const el = wrapper.firstElementChild;

  // Apply animation speed class
  const speed = game.settings.get("insight", "animationSpeed");
  if (speed !== "normal") el.classList.add(`insight-speed-${speed}`);

  // Apply theme CSS variables
  applyTheme(el, data.theme);

  // Insert into document body
  document.body.appendChild(el);

  // Get timing preset
  const timing = TIMINGS[speed] ?? TIMINGS.normal;

  // Cache element references
  const line = el.querySelector(".insight-fracture-line");
  const card = el.querySelector(".insight-fracture-card");
  const bgBack = el.querySelector(".insight-fracture-bg-back");
  const contentEls = [
    el.querySelector(".insight-icon"),
    el.querySelector(".insight-sense"),
    el.querySelector(".insight-title"),
    el.querySelector(".insight-divider"),
    el.querySelector(".insight-image"),
    el.querySelector(".insight-body"),
    el.querySelector(".insight-dismiss"),
  ].filter(Boolean);

  // Stage 1: Line slides in + container becomes visible
  setTimeout(() => {
    el.classList.add("insight-visible");
    line.classList.add("insight-visible");
    playSound("line", data.theme);
  }, timing.line);

  // Stage 2: Card expands + back panel begins glitch
  setTimeout(() => {
    card.classList.add("insight-visible");
    bgBack.classList.add("insight-glitch");
    playSound("reveal", data.theme);
  }, timing.card);

  // Stage 3: Content fades in with stagger
  contentEls.forEach((contentEl, i) => {
    setTimeout(() => {
      contentEl.classList.add("insight-fade-in");
    }, timing.contentStart + (i * timing.contentStagger));
  });

  // Dismiss handler
  const dismissBtn = el.querySelector(".insight-dismiss");
  dismissBtn.addEventListener("click", () => {
    dismissNotification(el, onDismiss);
  });

  return el;
}

/**
 * Dismiss a notification with exit animation, then remove from DOM.
 * @param {HTMLElement} el - The notification element
 * @param {Function} onDismiss - Callback after removal
 */
function dismissNotification(el, onDismiss) {
  el.classList.add("insight-dismissing");
  el.addEventListener("transitionend", () => {
    el.remove();
    onDismiss?.();
  }, { once: true });

  // Safety fallback — remove after 600ms if transitionend doesn't fire
  setTimeout(() => {
    if (el.parentNode) {
      el.remove();
      onDismiss?.();
    }
  }, 600);
}
```

- [ ] **Step 2: Verify renderer manually**

1. Reload FoundryVTT (F5)
2. In console, test rendering:
   ```javascript
   import("./modules/insight/module/notification.mjs").then(m => {
     m.renderNotification({
       id: "test-1",
       title: "A Faint Presence",
       body: "The hairs on your neck rise. Through the static hum, you catch something.",
       sense: "Perception",
     }, () => console.log("Dismissed!"));
   });
   ```
3. Confirm the three-stage Fracture animation plays and dismiss works

- [ ] **Step 3: Commit**

```bash
git add module/notification.mjs
git commit -m "feat: notification renderer with three-stage Fracture animation"
```

---

### Task 7: Queue Manager

**Files:**
- Create: `modules/insight/module/queue.mjs`

- [ ] **Step 1: Create queue.mjs**

```javascript
// module/queue.mjs — Notification queue (one at a time)

import { renderNotification } from "./notification.mjs";

/** @type {object[]} */
const queue = [];

/** @type {boolean} */
let active = false;

/**
 * Add a notification to the queue.
 * If nothing is currently showing, render immediately.
 * @param {object} data - Notification payload
 */
export function enqueue(data) {
  // Assign a unique ID if not present
  if (!data.id) data.id = `insight-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;

  queue.push(data);
  if (!active) next();
}

/**
 * Render the next notification in the queue.
 * Called after dismiss or when the queue gets its first entry.
 */
function next() {
  if (queue.length === 0) {
    active = false;
    return;
  }

  active = true;
  const data = queue.shift();

  renderNotification(data, () => {
    // Small delay between dismiss and next notification
    setTimeout(next, 300);
  });
}

/**
 * Get the current queue length (for debugging).
 * @returns {number}
 */
export function getQueueLength() {
  return queue.length + (active ? 1 : 0);
}
```

- [ ] **Step 2: Verify queuing behavior**

1. Reload FoundryVTT (F5)
2. In console, test queuing multiple notifications:
   ```javascript
   import("./modules/insight/module/queue.mjs").then(m => {
     m.enqueue({ title: "First Notice", body: "You hear something.", sense: "Perception" });
     m.enqueue({ title: "Second Notice", body: "You smell something.", sense: "Insight" });
   });
   ```
3. Confirm first notification appears, dismiss it, then second appears

- [ ] **Step 3: Commit**

```bash
git add module/queue.mjs
git commit -m "feat: notification queue with one-at-a-time sequencing"
```

---

### Task 8: Socket Handler

**Files:**
- Create: `modules/insight/module/socket.mjs`

- [ ] **Step 1: Create socket.mjs**

```javascript
// module/socket.mjs — Socket communication for GM → Player notifications

import { enqueue } from "./queue.mjs";

const SOCKET_NAME = "module.insight";

/**
 * Register the socket listener. Called once during `ready` hook.
 */
export function registerSocket() {
  game.socket.on(SOCKET_NAME, handleMessage);
  console.log("Insight | Socket listener registered");
}

/**
 * Handle incoming socket messages.
 * @param {object} payload - The socket payload
 */
function handleMessage(payload) {
  if (payload.type !== "insight.notification") return;

  // Only process if this client's user is the target
  if (payload.target !== game.user.id) return;

  enqueue({
    id: payload.id,
    title: payload.title,
    body: payload.body,
    sense: payload.sense ?? null,
    image: payload.image ?? null,
    theme: payload.theme ?? null,
  });
}

/**
 * Send a notification to a target player via socket.
 * @param {object} data - Notification content
 * @param {string} data.target - Target user ID
 * @param {string} data.title - Notification title
 * @param {string} data.body - Notification body (HTML allowed)
 * @param {string} [data.sense] - Sense label
 * @param {string} [data.image] - Image URL
 * @param {string} [data.theme] - Theme override
 */
export function sendNotification(data) {
  const payload = {
    type: "insight.notification",
    id: `insight-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    target: data.target,
    title: data.title,
    body: data.body,
    sense: data.sense || null,
    image: data.image || null,
    theme: data.theme || null,
  };

  game.socket.emit(SOCKET_NAME, payload);

  // If GM is also the target (e.g., sending to self for testing),
  // handle locally since socket.emit doesn't echo back to sender
  if (payload.target === game.user.id) {
    handleMessage(payload);
  }
}
```

- [ ] **Step 2: Verify socket (requires two browser tabs)**

1. Reload FoundryVTT (F5)
2. Open a second browser tab logged in as a Player
3. In the GM tab console:
   ```javascript
   import("./modules/insight/module/socket.mjs").then(m => {
     const playerUser = game.users.find(u => !u.isGM);
     m.sendNotification({
       target: playerUser.id,
       title: "Test Notice",
       body: "This came via socket!",
       sense: "Perception",
     });
   });
   ```
4. Confirm the notification appears in the Player's tab

- [ ] **Step 3: Commit**

```bash
git add module/socket.mjs
git commit -m "feat: socket handler for GM-to-player notification delivery"
```

---

### Task 9: Compose Dialog

**Files:**
- Create: `modules/insight/templates/compose-dialog.hbs`
- Create: `modules/insight/module/compose-dialog.mjs`

- [ ] **Step 1: Create compose-dialog.hbs template**

```handlebars
<form class="insight-compose-form" autocomplete="off">
  <label>
    {{localize "INSIGHT.ComposeTarget"}}
    <select name="target">
      {{#each players}}
      <option value="{{this.id}}">{{this.name}}</option>
      {{/each}}
    </select>
  </label>

  <label>
    {{localize "INSIGHT.ComposeSense"}}
    <input type="text" name="sense" placeholder="Perception, Insight, Keen Senses..." value="{{sense}}">
    <span class="hint">{{localize "INSIGHT.ComposeSenseHint"}}</span>
  </label>

  <label>
    {{localize "INSIGHT.ComposeNotifTitle"}}
    <input type="text" name="title" placeholder="A Faint Presence..." value="{{title}}" required>
  </label>

  <label>
    {{localize "INSIGHT.ComposeBody"}}
    <textarea name="body" placeholder="The hairs on your neck rise..." required>{{body}}</textarea>
    <span class="hint">{{localize "INSIGHT.ComposeBodyHint"}}</span>
  </label>

  <label>
    {{localize "INSIGHT.ComposeImage"}}
    <div class="insight-image-row">
      <input type="text" name="image" placeholder="Optional image path..." value="{{image}}">
      <button type="button" data-action="browse-image"><i class="fas fa-file-image"></i></button>
    </div>
  </label>

  <button type="button" class="insight-send-btn" data-action="send">
    {{localize "INSIGHT.ComposeSend"}}
  </button>
</form>
```

- [ ] **Step 2: Create compose-dialog.mjs**

```javascript
// module/compose-dialog.mjs — GM compose dialog for sending notifications

import { sendNotification } from "./socket.mjs";

const { HandlebarsApplicationMixin, ApplicationV2 } = foundry.applications.api;

export class InsightComposeDialog extends HandlebarsApplicationMixin(ApplicationV2) {

  static DEFAULT_OPTIONS = {
    id: "insight-compose-dialog",
    classes: ["insight-compose"],
    position: { width: 360, height: "auto" },
    window: {
      title: "INSIGHT.ComposeTitle",
      minimizable: true,
      resizable: false,
    },
    actions: {
      send: InsightComposeDialog.#onSend,
      "browse-image": InsightComposeDialog.#onBrowseImage,
    },
  };

  static PARTS = {
    form: { template: "modules/insight/templates/compose-dialog.hbs" },
  };

  /** @override */
  async _prepareContext(options) {
    const context = await super._prepareContext(options);

    // Get connected non-GM players
    context.players = game.users
      .filter(u => !u.isGM && u.active)
      .map(u => ({ id: u.id, name: u.name }));

    // Preserve form values between re-renders
    context.sense = this._lastSense ?? "";
    context.title = "";
    context.body = "";
    context.image = this._lastImage ?? "";

    return context;
  }

  /**
   * Handle Send button click.
   * @param {PointerEvent} event
   * @param {HTMLElement} target
   */
  static #onSend(event, target) {
    const form = this.element.querySelector("form");
    const formData = new FormData(form);

    const title = formData.get("title")?.trim();
    const body = formData.get("body")?.trim();
    const targetUser = formData.get("target");

    if (!title || !body || !targetUser) {
      ui.notifications.warn("Please fill in the target, title, and body fields.");
      return;
    }

    sendNotification({
      target: targetUser,
      title: title,
      body: body,
      sense: formData.get("sense")?.trim() || null,
      image: formData.get("image")?.trim() || null,
    });

    // Remember sense and image for next send
    this._lastSense = formData.get("sense")?.trim() || "";
    this._lastImage = formData.get("image")?.trim() || "";

    // Flash the button green briefly
    const btn = target;
    btn.classList.add("insight-sent");
    btn.textContent = game.i18n.localize("INSIGHT.ComposeSent");
    setTimeout(() => {
      btn.classList.remove("insight-sent");
      btn.textContent = game.i18n.localize("INSIGHT.ComposeSend");
    }, 1200);

    // Clear title and body for next notification
    form.querySelector('[name="title"]').value = "";
    form.querySelector('[name="body"]').value = "";
  }

  /**
   * Handle image file picker.
   * @param {PointerEvent} event
   * @param {HTMLElement} target
   */
  static async #onBrowseImage(event, target) {
    const fp = new FilePicker({
      type: "image",
      callback: (path) => {
        const input = this.element.querySelector('[name="image"]');
        input.value = path;
      },
    });
    fp.browse();
  }
}
```

- [ ] **Step 3: Verify compose dialog opens**

1. Reload FoundryVTT (F5)
2. In GM console:
   ```javascript
   import("./modules/insight/module/compose-dialog.mjs").then(m => {
     new m.InsightComposeDialog().render(true);
   });
   ```
3. Confirm the dialog opens with player dropdown, sense, title, body, and image fields
4. Fill in fields and click Send — confirm notification appears on the target player's tab

- [ ] **Step 4: Commit**

```bash
git add templates/compose-dialog.hbs module/compose-dialog.mjs
git commit -m "feat: GM compose dialog for sending Insight notifications"
```

---

### Task 10: Scene Controls and Entry Point Wiring

**Files:**
- Modify: `modules/insight/insight.mjs`

- [ ] **Step 1: Wire everything together in the entry point**

Replace `insight.mjs` with the final version that connects all components:

```javascript
// insight.mjs — Insight Module Entry Point
import { registerSettings } from "./module/settings.mjs";
import { registerSocket } from "./module/socket.mjs";
import { InsightComposeDialog } from "./module/compose-dialog.mjs";

/** @type {InsightComposeDialog|null} */
let composeDialog = null;

Hooks.once("init", () => {
  console.log("Insight | Initializing module");
  registerSettings();
});

Hooks.once("ready", () => {
  registerSocket();
  console.log("Insight | Module ready");
});

// Add scene control button (GM only)
Hooks.on("getSceneControlButtons", (controls) => {
  if (!game.user.isGM) return;

  const tokenControls = controls.find(c => c.name === "token");
  if (!tokenControls) return;

  tokenControls.tools.push({
    name: "insight",
    title: "INSIGHT.SceneControl",
    icon: "fas fa-eye",
    button: true,
    onClick: () => {
      if (!composeDialog) composeDialog = new InsightComposeDialog();
      composeDialog.render(true);
    },
  });
});
```

- [ ] **Step 2: Verify the scene control button**

1. Reload FoundryVTT (F5)
2. As GM, look at the left-side scene controls — under the Token Controls group, a new eye icon should appear
3. Click it — the Insight compose dialog should open
4. Send a test notification to a player

- [ ] **Step 3: Full end-to-end test**

1. Open two browser tabs: GM + Player
2. GM clicks the eye icon → compose dialog opens
3. GM selects a player, fills in sense/title/body, clicks Send
4. Confirm: line slides in on Player's screen, card expands, content fades in, sound plays
5. Player clicks Dismiss — notification exits
6. GM sends two notifications rapidly — confirm they queue and show one at a time

- [ ] **Step 4: Commit**

```bash
git add insight.mjs
git commit -m "feat: wire scene controls, socket, and compose dialog into entry point"
```

---

### Task 11: Polish and Final Verification

**Files:**
- Possibly tweak: any files with minor issues found during verification

- [ ] **Step 1: Test Dreadlight theme**

1. Set module theme to "Dreadlight" in settings
2. Send a notification — verify: Monaspace fonts, gold-to-purple gradient line, dark background, angular icon, tech-noir feel

- [ ] **Step 2: Test Fantasy theme**

1. Set module theme to "Fantasy" in settings
2. Send a notification — verify: IM Fell English title font, Crimson Pro italic body, warm amber gradient, round icon, parchment tones

- [ ] **Step 3: Test animation speed settings**

1. Set animation speed to "Fast" — verify animations are quicker
2. Set animation speed to "Instant" — verify everything appears immediately
3. Set back to "Normal"

- [ ] **Step 4: Test sound settings**

1. Toggle "Enable Sounds" off — send notification — confirm no sound
2. Toggle back on — send notification — confirm sound plays
3. Adjust volume slider — confirm volume changes

- [ ] **Step 5: Test image support**

1. Send a notification with an image URL — confirm image renders in the notification
2. Send without image — confirm layout is still correct

- [ ] **Step 6: Test edge cases**

1. Send notification to self (GM) — confirm it renders
2. Send with no sense label — confirm layout adjusts (no label row)
3. Send with bold/italic HTML in body — confirm formatting renders
4. Rapidly click Dismiss then get next — confirm queue doesn't break

- [ ] **Step 7: Final commit**

```bash
git add -A
git commit -m "feat: Insight v0.1.0 — passive notification module complete"
```
