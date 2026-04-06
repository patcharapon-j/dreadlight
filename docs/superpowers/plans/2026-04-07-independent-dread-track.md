# Independent Dread Track Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Decouple Dread from Soul loss and make it a standalone 0–5 track that the GM controls per campaign.

**Architecture:** Remove the auto-derivation logic and `override` field from the data model, remove the `dreadTable` config entry, add click handlers to make the Dread pips directly editable on the character sheet, and rewrite the relevant sections of three rules documents.

**Tech Stack:** FoundryVTT v13, ES modules, Handlebars templates, Markdown rules docs

---

### Task 1: Simplify the Dread Data Model

**Files:**
- Modify: `module/data/investigator.mjs:52-55` (schema) and `module/data/investigator.mjs:149-164` (derivation)

- [ ] **Step 1: Remove `dread.override` from the schema**

In `module/data/investigator.mjs`, replace lines 52–55:

```javascript
dread: new fields.SchemaField({
  value: new fields.NumberField({ required: true, initial: 0, min: 0, max: 5, integer: true }),
  override: new fields.BooleanField({ required: true, initial: false }),
}),
```

With:

```javascript
dread: new fields.SchemaField({
  value: new fields.NumberField({ required: true, initial: 0, min: 0, max: 5, integer: true }),
}),
```

- [ ] **Step 2: Remove auto-derivation logic from `prepareDerivedData()`**

In `module/data/investigator.mjs`, delete lines 149–164 (the entire `if (!this.dread.override) { ... }` block):

```javascript
    // Auto-derive dread from soul lost unless override is true
    if (!this.dread.override) {
      const soulMax = this.tracks.soul.max;
      const soulCurrent = this.tracks.soul.value;
      const soulLost = Math.max(0, soulMax - soulCurrent);

      let dreadValue;
      if (soulLost <= 1) dreadValue = 0;
      else if (soulLost <= 3) dreadValue = 1;
      else if (soulLost <= 5) dreadValue = 2;
      else if (soulLost <= 7) dreadValue = 3;
      else if (soulLost <= 9) dreadValue = 4;
      else dreadValue = 5;

      this.dread.value = dreadValue;
    }
```

- [ ] **Step 3: Remove `dreadTable` from CONFIG**

In `dreadlight.mjs`, remove this line from the `CONFIG.DREADLIGHT` object (line 35):

```javascript
    dreadTable: [0, 0, 1, 1, 2, 2, 3, 3, 4, 4, 5],
```

- [ ] **Step 4: Test in FoundryVTT**

Reload the browser (F5). Open an investigator sheet. Verify:
- No console errors
- Dread pips still display correctly
- Changing Soul track value no longer changes Dread value
- Dread value persists as whatever it was last set to

- [ ] **Step 5: Commit**

```bash
git add module/data/investigator.mjs dreadlight.mjs
git commit -m "feat: decouple Dread from Soul — remove auto-derivation and override"
```

---

### Task 2: Make Dread Pips Clickable on the Character Sheet

**Files:**
- Modify: `module/sheets/investigator-sheet.mjs:174-187` (add click handler alongside existing track handlers)

- [ ] **Step 1: Add Dread click handler in `_onRender`**

In `module/sheets/investigator-sheet.mjs`, find the section where track button click handlers are bound (inside `_onRender`, after the `for (const trackKey of ["body", "mind", "soul"])` loop, around line 187). Add the following after that loop:

```javascript
    // Dread button: left-click = +1, right-click = −1
    const dreadBtn = this.element.querySelector(".track-btn.dread");
    if (dreadBtn) {
      dreadBtn.addEventListener("click", () => {
        const val = this.actor.system.dread.value;
        if (val < 5) this.actor.update({ "system.dread.value": val + 1 });
      });
      dreadBtn.addEventListener("contextmenu", (ev) => {
        ev.preventDefault();
        const val = this.actor.system.dread.value;
        if (val > 0) this.actor.update({ "system.dread.value": val - 1 });
      });
    }
```

- [ ] **Step 2: Test in FoundryVTT**

Reload the browser (F5). Open an investigator sheet. Verify:
- Left-clicking the Dread track increments the value (up to 5)
- Right-clicking the Dread track decrements the value (down to 0)
- The pips update visually after each click
- The value persists after closing and reopening the sheet

- [ ] **Step 3: Commit**

```bash
git add module/sheets/investigator-sheet.mjs
git commit -m "feat: make Dread pips clickable (left +1, right -1)"
```

---

### Task 3: Rewrite Chapter 4 — Dread and Corruption Rules

**Files:**
- Modify: `H:\My Drive\Project Crimson Echo\Dreadlight Core Rules\04 - Dread and Corruption.md`

- [ ] **Step 1: Rewrite the "Dread Dice" section**

Replace the entire `## Dread Dice` section (starting with `### Dread Rating` through the end of `### All-Dread Pools`) with the new independent track rules. The key changes:

1. **Remove** the "Dread Rating" subsection with the Soul Lost → Dread table
2. **Replace** with a new "Dread Rating" subsection explaining Dread as a standalone 0–5 track
3. **Add** a new "Gaining Dread" subsection with GM guidance and example triggers table
4. **Add** a new "Losing Dread" subsection with scene-based relief and player actions
5. **Keep** all other subsections unchanged: "How Dread Dice Work", "Dire Success", "Dread Dice and Pool Size", "Dread Dice Interactions", "All-Dread Pools"

The new `### Dread Rating` subsection:

```markdown
### Dread Rating

Your Dread rating is a standalone value from 0 to 5. It is **not** derived from any other stat. The GM assigns Dread based on campaign-defined triggers — what "Dread" represents depends on the campaign.

In a cosmic horror game, Dread might represent supernatural corruption. In a psychological thriller, it could be paranoia or moral compromise. In a survival scenario, it might be creeping desperation. The GM decides what Dread means and what causes it to rise and fall.

**Maximum Dread: 5.** This is the cap regardless of source.

### Gaining Dread

The GM determines what causes Dread for their campaign. The following are **examples and guidance**, not a fixed table.

| Example Trigger | Suggested Gain | Notes |
|---|---|---|
| Minor exposure (strange omen, unsettling scene) | +1 | The baseline nudge |
| Significant encounter (entity contact, forbidden knowledge) | +1–2 | Core horror moments |
| Major transgression (supernatural bargain, crossing a moral line) | +2–3 | Player-driven escalation |
| Voluntary acceptance (player embraces the dread for narrative power) | +1 | Player agency — trade safety for power |

**Campaign examples:**
- **Psychological thriller:** witness a betrayal (+1), commit violence (+2), discover a conspiracy (+1)
- **Survival horror:** enter unknown territory (+1), use the last supplies (+1), encounter the threat (+2)
- **Cosmic horror:** read a forbidden tome (+1–2), contact an entity (+2–3), perform a ritual (+2)

### Losing Dread

Two paths to relief: **scene-based** (passive, narrative) and **player actions** (active, deliberate).

**Scene-Based Relief:**

| Method | Effect |
|---|---|
| Safe haven scene (characters decompress in genuine safety) | −1 Dread |
| Cathartic moment (a breakthrough, confession, or moment of genuine peace) | −1 Dread |
| Extended downtime between scenarios (weeks or months of normalcy) | Reset Dread to 0 |

**Player Actions:**

| Method | Effect | Limit |
|---|---|---|
| Anchor interaction (engage with your Anchor meaningfully) | −1 Dread (also recovers +1 Mind) | Once per session |
| Confront the source (face what's causing the dread head-on) | −1 Dread | GM discretion |
| Severing Contact (month of mundane life, no supernatural exposure) | Reset Dread to 0 (also recovers all Soul) | Loses all beneficial manifestation effects |

**What does NOT reduce Dread:**
- Cracks (recover Mind only)
- Normal rest (sleep doesn't help)
- Soul recovery (Soul and Dread are independent)
```

- [ ] **Step 2: Verify no broken cross-references**

Check that references to `[[07 - Recovery and Healing]]` and `[[13 - Reference Tables]]` still make sense. The cross-reference from the Soul Loss table saying "pushing → Dread dice 1s → Soul loss" is still correct (pushing dread 1s still costs Soul).

- [ ] **Step 3: Commit**

```bash
cd "H:\My Drive\Project Crimson Echo\Dreadlight Core Rules"
git add "04 - Dread and Corruption.md"
git commit -m "rules: rewrite Dread as independent track — remove Soul derivation, add gain/loss guidance"
```

If this folder is not a git repo, skip the commit.

---

### Task 4: Update Chapter 7 — Recovery and Healing

**Files:**
- Modify: `H:\My Drive\Project Crimson Echo\Dreadlight Core Rules\07 - Recovery and Healing.md`

- [ ] **Step 1: Rewrite the "Dread Recovery" section**

Replace the existing `## Dread Recovery` section (lines 115–124) with:

```markdown
## Dread Recovery

Dread recovers independently — it is not tied to Soul recovery.

| Method | Effect | Limit |
|---|---|---|
| Safe haven scene | −1 Dread | GM determines what qualifies |
| Cathartic moment | −1 Dread | GM discretion |
| Anchor interaction | −1 Dread (also recovers +1 Mind) | Once per session |
| Confront the source | −1 Dread | GM discretion |
| Severing Contact | Reset Dread to 0 (also recovers all Soul, loses beneficial manifestations) | 1 month of mundane life |
| Extended downtime | Reset Dread to 0 | Between scenarios |

There is no passive Dread recovery from rest. Dread must be actively reduced through safe scenes, meaningful actions, or extended time away from whatever is causing it.

**Resolve L3 (Iron Soul)** doesn't reduce Dread directly — it lets you suppress one Dread Die for a single roll, once per session. It's a coping mechanism, not a cure.
```

- [ ] **Step 2: Update the Recovery Summary table**

Replace the Dread row in the Recovery Summary table (line 148):

```markdown
| **Dread** | N/A (follows Soul) | Only through Soul recovery | N/A | Weeks-Months |
```

With:

```markdown
| **Dread** | N/A (no passive recovery) | Yes — safe scenes, player actions, or extended downtime | N/A | Scenes-Months |
```

- [ ] **Step 3: Update the Soul Recovery "Severing Contact" entry**

In the Soul Recovery table (line 89), the existing entry says:

```markdown
| **Severing Contact** | Completely avoid all supernatural contact for 1 month | Recover **all Soul**. Reset Dread to 0. **Lose all beneficial manifestation effects.** |
```

This is still correct — Severing Contact resets both Soul and Dread. No change needed.

- [ ] **Step 4: Commit**

```bash
cd "H:\My Drive\Project Crimson Echo\Dreadlight Core Rules"
git add "07 - Recovery and Healing.md"
git commit -m "rules: update Dread recovery — independent track with scene-based and player-action paths"
```

If this folder is not a git repo, skip the commit.

---

### Task 5: Update Chapter 13 — Reference Tables

**Files:**
- Modify: `H:\My Drive\Project Crimson Echo\Dreadlight Core Rules\13 - Reference Tables.md`

- [ ] **Step 1: Replace the "Dread Rating Reference" section**

Replace the existing `## Dread Rating Reference` section (lines 145–157) with:

```markdown
## Dread Quick Reference

Dread is a standalone 0–5 track. The GM assigns gains and players reduce it through specific actions.

**Gaining Dread (GM-defined triggers, examples):**

| Trigger | Suggested Gain |
|---|---|
| Minor exposure | +1 |
| Significant encounter | +1–2 |
| Major transgression | +2–3 |
| Voluntary acceptance | +1 |

**Losing Dread:**

| Method | Effect | Limit |
|---|---|---|
| Safe haven scene | −1 | GM discretion |
| Cathartic moment | −1 | GM discretion |
| Anchor interaction | −1 (also +1 Mind) | Once per session |
| Confront the source | −1 | GM discretion |
| Extended downtime | Reset to 0 | Between scenarios |
| Severing Contact | Reset to 0 | 1 month, loses manifestations |
```

- [ ] **Step 2: Update the Recovery Quick Reference table**

In the `## Recovery Quick Reference` section (lines 250–257), the table currently has no Dread row. Add one:

```markdown
| **Dread** | N/A | N/A | Safe scenes: −1. Anchor: −1/session. Downtime: reset to 0. |
```

- [ ] **Step 3: Commit**

```bash
cd "H:\My Drive\Project Crimson Echo\Dreadlight Core Rules"
git add "13 - Reference Tables.md"
git commit -m "rules: update reference tables — Dread as independent track"
```

If this folder is not a git repo, skip the commit.

---

### Task 6: Final Verification

**Files:**
- Read-only check: all modified files

- [ ] **Step 1: Verify FoundryVTT system works end-to-end**

Reload FoundryVTT (F5). Test the complete flow:
1. Open an investigator sheet
2. Verify Dread pips are at 0
3. Left-click Dread 3 times — should show 3 filled pips
4. Reduce Soul track to 0 — Dread should NOT change (still 3)
5. Right-click Dread twice — should show 1 filled pip
6. Open the roll dialog for any attribute — verify pool preview shows 1 dread die
7. Make a roll — verify dread die appears in the chat card
8. Close and reopen the sheet — verify Dread persists at 1

- [ ] **Step 2: Check for console errors**

Open browser dev tools (F12). Check the console for any errors related to `dread`, `override`, or `dreadTable`.

- [ ] **Step 3: Verify rules document consistency**

Skim all three updated rules docs. Check:
- No references to "Soul Lost → Dread" derivation remain
- No references to `dread.override` remain
- Cross-references between chapters still make sense
- The Anchor entry mentions both Mind +1 and Dread −1

- [ ] **Step 4: Final commit (if any cleanup needed)**

```bash
git add -A
git commit -m "chore: final cleanup for independent Dread track"
```
