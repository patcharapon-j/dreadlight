# Omen Tracker UI Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a persistent top-center HUD element showing the GM's Omen pool, controllable via click (GM only), visible to all players.

**Architecture:** A plain JS class (`OmenTracker`) creates a DOM element and appends it to FoundryVTT's `#ui-top` container. The Omen value is stored as a hidden world setting (`omenPool`). Multi-client sync happens automatically via FoundryVTT's `updateSetting` hook — no sockets needed.

**Tech Stack:** Vanilla JS (ES modules), FoundryVTT v13 API (`game.settings`, `Hooks`), CSS custom properties from the existing design system.

---

## File Structure

| Action | Path | Responsibility |
|--------|------|----------------|
| Create | `module/apps/omen-tracker.mjs` | OmenTracker class — DOM creation, event handlers, setting sync |
| Modify | `module/settings.mjs` | Register the `omenPool` world setting |
| Modify | `dreadlight.mjs` | Import OmenTracker, call `OmenTracker.init()` in `ready` hook |
| Modify | `styles/dreadlight.css` | Omen tracker HUD styles (appended at end of file) |
| Modify | `lang/en.json` | Add `DREADLIGHT.Omen`, `DREADLIGHT.SettingOmenPool`, `DREADLIGHT.SettingOmenPoolHint` |

---

### Task 1: Register the `omenPool` world setting

**Files:**
- Modify: `module/settings.mjs:65` (before the client-scoped settings section)
- Modify: `lang/en.json` (add 3 new keys)

- [ ] **Step 1: Add setting registration**

In `module/settings.mjs`, add the following block just before the `// --- Visual & Player-Facing Settings (client-scoped) ---` comment (line 76):

```js
  // --- Omen Pool (hidden, managed via HUD tracker) ---

  game.settings.register("dreadlight", "omenPool", {
    name: "DREADLIGHT.SettingOmenPool",
    hint: "DREADLIGHT.SettingOmenPoolHint",
    scope: "world",
    config: false,
    type: Number,
    default: 0,
    requiresReload: false,
  });
```

- [ ] **Step 2: Add localization keys**

In `lang/en.json`, add these three keys after the `"DREADLIGHT.AdhocRoll"` line (line 170):

```json
  "DREADLIGHT.Omen": "Omen",
  "DREADLIGHT.SettingOmenPool": "Omen Pool",
  "DREADLIGHT.SettingOmenPoolHint": "The GM's current Omen pool value.",
```

- [ ] **Step 3: Verify in FoundryVTT**

Reload FoundryVTT (F5). Open the browser console and run:

```js
game.settings.get("dreadlight", "omenPool")
```

Expected: `0` (the default value).

- [ ] **Step 4: Commit**

```bash
git add module/settings.mjs lang/en.json
git commit -m "feat(omen): register omenPool world setting and i18n keys"
```

---

### Task 2: Create the OmenTracker class

**Files:**
- Create: `module/apps/omen-tracker.mjs`

- [ ] **Step 1: Create the `module/apps/` directory and file**

Create `module/apps/omen-tracker.mjs` with the full OmenTracker class:

```js
/**
 * Persistent HUD element displaying the GM's Omen pool.
 * Visible to all clients; only the GM can modify the value.
 */
export class OmenTracker {
  /** @type {HTMLElement|null} */
  static #element = null;

  /**
   * Initialise the tracker — call once from the `ready` hook.
   * Creates the DOM element, appends it to #ui-top, and wires up
   * the updateSetting hook for cross-client reactivity.
   */
  static init() {
    const omen = game.settings.get("dreadlight", "omenPool");
    this.#element = this.#buildElement(omen);
    document.getElementById("ui-top").appendChild(this.#element);

    // Sync across clients when the setting changes
    Hooks.on("updateSetting", (setting) => {
      if (setting.key !== "dreadlight.omenPool") return;
      this.#refresh(setting.value);
    });
  }

  /* -------------------------------------------------- */
  /*  DOM Construction                                   */
  /* -------------------------------------------------- */

  /**
   * Build the tracker DOM element from scratch.
   * @param {number} omen - Current omen value
   * @returns {HTMLElement}
   */
  static #buildElement(omen) {
    const el = document.createElement("div");
    el.classList.add("dreadlight", "omen-tracker");
    el.dataset.omen = this.#escalationBucket(omen);
    el.innerHTML = `
      <span class="omen-icon">&#9670;</span>
      <span class="omen-label">${game.i18n.localize("DREADLIGHT.Omen")}</span>
      <span class="omen-value">${omen}</span>
    `;

    if (game.user.isGM) {
      el.style.cursor = "pointer";
      el.addEventListener("click", this.#onLeftClick.bind(this));
      el.addEventListener("contextmenu", this.#onRightClick.bind(this));
    }

    return el;
  }

  /* -------------------------------------------------- */
  /*  Update                                             */
  /* -------------------------------------------------- */

  /**
   * Update the displayed value and escalation state.
   * @param {number} omen - New omen value
   */
  static #refresh(omen) {
    if (!this.#element) return;
    const valueEl = this.#element.querySelector(".omen-value");
    valueEl.textContent = omen;
    this.#element.dataset.omen = this.#escalationBucket(omen);

    // Pulse animation
    valueEl.classList.remove("omen-pulse");
    void valueEl.offsetWidth; // force reflow to restart animation
    valueEl.classList.add("omen-pulse");
  }

  /**
   * Map an omen value to an escalation bucket for CSS styling.
   * @param {number} omen
   * @returns {string} "0", "active", or "high"
   */
  static #escalationBucket(omen) {
    if (omen === 0) return "0";
    if (omen >= 5) return "high";
    return "active";
  }

  /* -------------------------------------------------- */
  /*  Event Handlers (GM only)                           */
  /* -------------------------------------------------- */

  /** Left click — increment by 1 */
  static #onLeftClick(event) {
    event.preventDefault();
    const current = game.settings.get("dreadlight", "omenPool");
    game.settings.set("dreadlight", "omenPool", current + 1);
  }

  /** Right click — decrement by 1, minimum 0 */
  static #onRightClick(event) {
    event.preventDefault();
    const current = game.settings.get("dreadlight", "omenPool");
    if (current > 0) {
      game.settings.set("dreadlight", "omenPool", current - 1);
    }
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add module/apps/omen-tracker.mjs
git commit -m "feat(omen): add OmenTracker HUD class"
```

---

### Task 3: Wire up the tracker in the entry point

**Files:**
- Modify: `dreadlight.mjs:1-16` (add import)
- Modify: `dreadlight.mjs:122-136` (add `ready` hook)

- [ ] **Step 1: Add import**

Add this import at the top of `dreadlight.mjs`, after the existing imports (after line 16):

```js
import { OmenTracker } from "./module/apps/omen-tracker.mjs";
```

- [ ] **Step 2: Add `ready` hook**

Add a new `ready` hook after the existing `Hooks.once("diceSoNiceReady", ...)` call (after line 122):

```js
Hooks.once("ready", () => {
  OmenTracker.init();
});
```

- [ ] **Step 3: Verify in FoundryVTT**

Reload FoundryVTT (F5). You should see the Omen tracker element appear at the top center of the screen (unstyled at this point — it will be a plain text "◆ Omen 0").

Open the browser console and run:

```js
await game.settings.set("dreadlight", "omenPool", 3)
```

Expected: The displayed value updates to `3` on all connected clients.

Right-click the tracker element. Expected: The context menu does NOT appear, and the value decrements to `2`.

- [ ] **Step 4: Commit**

```bash
git add dreadlight.mjs
git commit -m "feat(omen): wire OmenTracker into ready hook"
```

---

### Task 4: Add CSS styles

**Files:**
- Modify: `styles/dreadlight.css:3897` (append at end of file)

- [ ] **Step 1: Append Omen Tracker CSS**

Add the following CSS at the very end of `styles/dreadlight.css` (after line 3897):

```css

/* ----------------------------------------------------------
   OMEN TRACKER HUD
   ---------------------------------------------------------- */

.dreadlight.omen-tracker {
  position: fixed;
  top: 36px;
  left: 50%;
  transform: translateX(-50%);
  z-index: 100;
  display: flex;
  align-items: center;
  gap: 10px;
  background: linear-gradient(135deg, rgba(224, 85, 85, 0.08) 0%, rgba(8, 8, 12, 0.95) 60%);
  border: 1px solid rgba(224, 85, 85, 0.25);
  border-radius: 4px;
  padding: 6px 16px 6px 12px;
  user-select: none;
  backdrop-filter: blur(8px);
  transition: border-color 0.3s cubic-bezier(0.22, 1, 0.36, 1),
              box-shadow 0.3s cubic-bezier(0.22, 1, 0.36, 1),
              background 0.3s cubic-bezier(0.22, 1, 0.36, 1);
}

.dreadlight.omen-tracker::before {
  content: '';
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  height: 1px;
  background: linear-gradient(90deg, transparent, rgba(224, 85, 85, 0.4), transparent);
}

.dreadlight.omen-tracker:hover {
  border-color: rgba(224, 85, 85, 0.45);
  box-shadow: 0 0 12px rgba(224, 85, 85, 0.15);
}

/* Icon */
.dreadlight.omen-tracker .omen-icon {
  font-size: 14px;
  color: var(--dl-accent-red);
  filter: drop-shadow(0 0 4px rgba(224, 85, 85, 0.5));
  transition: color 0.3s, filter 0.3s;
}

/* Label */
.dreadlight.omen-tracker .omen-label {
  font-family: var(--dl-font-primary);
  font-size: 9px;
  letter-spacing: 2px;
  text-transform: uppercase;
  color: var(--dl-text-muted);
}

/* Value */
.dreadlight.omen-tracker .omen-value {
  font-family: var(--dl-font-primary);
  font-size: 20px;
  font-weight: 700;
  color: var(--dl-accent-red);
  text-shadow: 0 0 8px rgba(224, 85, 85, 0.4);
  min-width: 20px;
  text-align: center;
  transition: color 0.3s, text-shadow 0.3s;
}

/* Pulse animation on value change */
.dreadlight.omen-tracker .omen-value.omen-pulse {
  animation: omen-pulse 0.3s cubic-bezier(0.22, 1, 0.36, 1);
}

@keyframes omen-pulse {
  0%   { transform: scale(1); }
  40%  { transform: scale(1.3); }
  100% { transform: scale(1); }
}

/* --- Escalation: Dormant (omen = 0) --- */

.dreadlight.omen-tracker[data-omen="0"] {
  border-color: rgba(224, 85, 85, 0.1);
  background: linear-gradient(135deg, rgba(224, 85, 85, 0.03) 0%, rgba(8, 8, 12, 0.95) 60%);
}

.dreadlight.omen-tracker[data-omen="0"] .omen-icon {
  color: var(--dl-text-muted);
  filter: none;
}

.dreadlight.omen-tracker[data-omen="0"] .omen-value {
  color: var(--dl-text-muted);
  text-shadow: none;
}

/* --- Escalation: High (omen >= 5) --- */

.dreadlight.omen-tracker[data-omen="high"] {
  border-color: rgba(224, 85, 85, 0.5);
  box-shadow: 0 0 18px rgba(224, 85, 85, 0.15);
}

.dreadlight.omen-tracker[data-omen="high"] .omen-value {
  text-shadow: 0 0 14px rgba(224, 85, 85, 0.6);
}

.dreadlight.omen-tracker[data-omen="high"] .omen-icon {
  filter: drop-shadow(0 0 6px rgba(224, 85, 85, 0.7));
}
```

- [ ] **Step 2: Verify in FoundryVTT**

Reload FoundryVTT (F5). The Omen tracker should now appear styled at the top center of the screen:
- At omen 0: muted gray, barely visible
- Click to increment — red glow activates, value pulses
- At 5+: intense glow and stronger border

Test the three states via console:

```js
await game.settings.set("dreadlight", "omenPool", 0)  // Dormant — muted
await game.settings.set("dreadlight", "omenPool", 3)  // Active — red glow
await game.settings.set("dreadlight", "omenPool", 7)  // High — intense glow
```

- [ ] **Step 3: Commit**

```bash
git add styles/dreadlight.css
git commit -m "feat(omen): add Omen Tracker HUD styles with escalation states"
```

---

## Self-Review

**Spec coverage check:**
- [x] Minimal Sigil visual — Task 4 CSS matches spec exactly (icon, label, value, gradient, accent line)
- [x] Escalation states (dormant/active/high) — Task 4 CSS with `data-omen` attribute, Task 2 `#escalationBucket()`
- [x] Positioning (`#ui-top`, centered, z-index 100, fixed) — Task 4 CSS
- [x] GM left-click/right-click — Task 2 event handlers
- [x] Player visibility, no interaction — Task 2 `isGM` guard
- [x] World setting storage — Task 1
- [x] Reactivity via `updateSetting` hook — Task 2 `init()` hook listener
- [x] Localization keys — Task 1
- [x] Pulse animation on change — Task 2 `#refresh()` + Task 4 `@keyframes omen-pulse`

**Placeholder scan:** No TBDs, TODOs, or vague instructions. All code blocks are complete.

**Type consistency:** `#escalationBucket()` returns `"0"`, `"active"`, or `"high"` — CSS selectors match `[data-omen="0"]`, `[data-omen="active"]` (default styles), `[data-omen="high"]`. Method names consistent across all tasks.
