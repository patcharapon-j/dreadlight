# NPC & Creature Sheet Design

**Date:** 2026-04-07
**Status:** Approved
**Scope:** Two new actor types (npc, creature) with data models, sheets, templates, and styles

## Overview

Dreadlight needs actor types beyond the player-character Investigator. The game rules define three NPC tiers (Minor, Important, Major) for human adversaries/allies, and a distinct Creature stat block for supernatural threats. This spec adds both as new actor types with dedicated sheets.

## Design Decisions

| Decision | Choice | Rationale |
|---|---|---|
| Actor type split | Two types: `npc` + `creature` | Mirrors rules' natural division (human vs supernatural) |
| NPC tier system | Progressive reveal (Minor/Important/Major) | Sheet grows with complexity; Minor = notecard, Major = full stats |
| Creature abilities | Rich-text field (not structured items) | Abilities are too varied/narrative to standardize into fields |
| Creature attacks | Structured array, rollable | Attacks follow a consistent mechanical pattern; roll infrastructure exists |
| Soul Damage | Number + text description | Quick-glance number for base value, text for trigger conditions |
| Important NPC key stats | Up to 3 attributes + 2 talents | Flexible without requiring upgrade to Major tier |
| Creature layout | Single-column compact stat block | Dense, scannable during play — like a monster manual entry |
| Multiple attacks | Array of 1-3 attack entries | Minimal cost, avoids stuffing mechanical data into free-text |

## 1. Actor Types & Registration

Two new actor types added to `system.json`:

- **`npc`** — Minor, Important, and Major NPCs (human adversaries, allies, witnesses)
- **`creature`** — Supernatural threats

Both register data models in `CONFIG.Actor.dataModels` and sheets via `Actors.registerSheet` (matching existing deprecated-global pattern used for investigator).

## 2. NPC Data Model (`NpcData`)

File: `module/data/npc.mjs`

### Schema

```
tier: StringField — "minor" | "important" | "major" (initial: "minor")
appearance: StringField — one-line description
notes: HTMLField — free-form GM notes (all tiers)

// Important + Major tiers:
keyAttributes: ArrayField of SchemaField — [{ attr: StringField, value: NumberField(2-5) }]
  - Up to 3 entries
  - attr choices: str, agl, log, per, ins, emp
keyTalents: ArrayField of SchemaField — [{ name: StringField, level: NumberField(0-3) }]
  - Up to 2 entries
body: SchemaField — { value: NumberField(0+), max: NumberField(4-12, initial: 6) }
mind: SchemaField — { value: NumberField(0+), max: NumberField(4-12, initial: 6) }

// Major tier only:
attributes: SchemaField — same structure as investigator
  - str, agl, log, per, ins, emp: each { value: NumberField(0-6, initial: 3) }
soul: SchemaField — { value: NumberField(0+), max: NumberField(0+) }
```

### Derived Data

- **Major tier:** `body.max = str + agl`, `mind.max = log + emp`, `soul.max = ins + per` (same derivation as investigator)
- **Important tier:** tracks use manually-set max values (no derivation from attributes)
- Track values clamped to max; broken state when value === 0

### Item Ownership

- **Major NPCs:** talents, weapons, armor, equipment (same as investigators)
- **Important NPCs:** weapons and equipment only
- **Minor NPCs:** no items

## 3. Creature Data Model (`CreatureData`)

File: `module/data/creature.mjs`

### Schema

```
appearance: StringField — evocative description
threatLevel: StringField — "minor" | "moderate" | "major" (initial: "moderate")
  - Display label only, no mechanical effect

attributes: ArrayField of SchemaField — [{ attr: StringField, value: NumberField(1-8) }]
  - Flexible 0-6 entries; GM picks which attributes the creature has
  - attr choices: str, agl, log, per, ins, emp

body: SchemaField — { value: NumberField(0+, initial: 6), max: NumberField(1-30, initial: 6) }
armor: NumberField(0-10, initial: 0)

attacks: ArrayField of SchemaField — [{
  name: StringField,
  attribute: StringField — which attribute key the pool is based on,
  damage: NumberField(0+),
  critThreshold: NumberField(1-6, initial: 6),
  range: StringField — choices: engaged, short, medium, long, extreme
}]
  - 1-3 entries; each independently rollable

soulDamage: SchemaField — {
  value: NumberField(0-10),
  description: StringField — trigger conditions
}

abilities: HTMLField — free-form special abilities text
weakness: HTMLField — free-form weakness text
notes: HTMLField — GM notes
```

### Key Differences from NPC

- Attributes are a **flexible array** (0-6 entries) rather than a fixed six-attribute block
- Only Body track (no Mind/Soul tracks — creatures don't have human psychology)
- Armor is a simple number (not an item with gear dice like investigator armor)
- Attacks are embedded structured fields, not items
- Soul Damage is an outgoing threat stat (damage the creature deals to investigators)

## 4. NPC Sheet (`NpcSheet`)

File: `module/sheets/npc-sheet.mjs`

### Class

```javascript
class NpcSheet extends HandlebarsApplicationMixin(ActorSheetV2)
```

### Configuration

- Classes: `["dreadlight", "sheet", "actor", "npc"]`
- Size: 560x500, resizable
- Form: `submitOnChange: true`
- DragDrop: items from `.item-row`

### Progressive Reveal by Tier

**Minor:**
- Portrait, name, tier selector dropdown
- Notes field (rich text)
- That's it — a notecard

**Important:**
- Everything from Minor, plus:
- Key attributes section (up to 3 attribute boxes, each with dropdown + value; rollable)
- Key talents section (up to 2 talent entries with name + level)
- Body and Mind tracks with pips (manually-set max)
- Notable gear (items list — weapons + equipment only)

**Major:**
- Portrait, name, tier selector
- Full six attributes (rollable, same layout as investigator)
- Three tracks: Body, Mind, Soul with pips (derived max from attributes)
- Full item management: talents, weapons, armor, equipment
- Notes field

### Actions

| Action | Behavior |
|---|---|
| `changeTier` | Tier selector dropdown, triggers re-render |
| `rollAttribute` | Opens DreadlightRollDialog for attribute roll |
| `addKeyAttribute` | Adds a key attribute entry (Important tier, max 3) |
| `removeKeyAttribute` | Removes key attribute by index |
| `addKeyTalent` | Adds a key talent entry (Important tier, max 2) |
| `removeKeyTalent` | Removes key talent by index |
| Track buttons | Left-click +1, right-click -1 (same as investigator) |
| Item management | Open, delete, drag-drop (standard pattern) |

## 5. Creature Sheet (`CreatureSheet`)

File: `module/sheets/creature-sheet.mjs`

### Class

```javascript
class CreatureSheet extends HandlebarsApplicationMixin(ActorSheetV2)
```

### Configuration

- Classes: `["dreadlight", "sheet", "actor", "creature"]`
- Size: 480x620, resizable
- Form: `submitOnChange: true`

### Layout (Single-Column Compact Stat Block)

Top to bottom:
1. **Header** — portrait (red border accent `#e05555`), name, threat level label, appearance text (italic)
2. **Attributes** — flexible row of attribute boxes (only the ones defined, with add/remove controls)
3. **Body + Armor** — body track with pips, armor value beside it
4. **Attacks** — each attack is a card: name, pool (attribute reference), damage, crit threshold, range, ROLL button. "Add Attack" button below (max 3).
5. **Soul Damage** — prominent number with purple accent (`#a88bf5`) + trigger description text
6. **Special Abilities** — rich-text editor with gold accent header
7. **Weakness** — rich-text editor with green accent header (`#55b87a`)
8. **Notes** — rich-text editor

### Actions

| Action | Behavior |
|---|---|
| `rollAttack` | Opens simplified roll dialog using attack's attribute pool; posts to chat with creature portrait |
| `addAttack` | Adds attack entry (max 3) |
| `removeAttack` | Removes attack by index |
| `addAttribute` | Adds an attribute entry with dropdown selector (max 6) |
| `removeAttribute` | Removes attribute by index |
| Track button | Left-click +1, right-click -1 for body |

### Roll Integration

Creature attacks use the existing `DreadlightRoll` class. The roll dialog is simplified:
- No talent/gear bonus selection
- Base pool = attack's attribute value + optional modifier from dialog
- Results use standard outcome system (success/tainted/dire/failure)
- Chat cards display creature portrait with the same result template

## 6. Templates

### New Files

| File | Purpose |
|---|---|
| `templates/actors/npc-sheet.hbs` | Main NPC sheet with conditional tier rendering |
| `templates/actors/creature-sheet.hbs` | Creature stat block |
| `templates/actors/partials/npc-header.hbs` | Portrait + name + tier selector |
| `templates/actors/partials/npc-key-stats.hbs` | Key attributes + key talents (Important tier) |
| `templates/actors/partials/creature-attacks.hbs` | Attack cards with roll buttons |

### Template Patterns

- Follow existing Handlebars patterns: `data-action` attributes, `{{localize}}` for i18n, triple-braces for HTML
- Tier-based conditional rendering: `{{#if (eq system.tier "important")}}` blocks
- Reuse existing helpers: `trackPips`, `eq`, `localize`, `attrAbbr`, `attrName`

## 7. Styling

All new styles in `styles/dreadlight.css`, scoped under `.dreadlight.npc` and `.dreadlight.creature`.

### Design Language (matching existing system)

- Dark backgrounds: `#08080c` (primary), `#111118` (cards), `#0e0e14` (header)
- Gold accent: `#c9a96e` for labels, values, attribute boxes
- Red accent: `#e05555` for creature elements (portrait border, attack section, threat labels)
- Track colors: Body `#55b87a`, Mind `#6b9df5`, Soul `#a88bf5`
- Monospace Monaspace Krypton font
- Letter-spacing on label text (terminal/sci-fi feel)
- Geometric corner brackets on sheet frame (matching investigator sheet)

### Creature-Specific Styling

- Red-tinted portrait border instead of gold
- Attack cards with dark background (`#111118`) and subtle border
- ROLL button: solid red background with dark text
- Soul Damage section: purple accent border on the number badge
- Weakness section: green accent header (suggests "how to defeat it")

### NPC-Specific Styling

- Tier selector dropdown styled as a subtle badge in the header
- Minor tier: minimal chrome, just portrait + notes
- Important tier: compact stat boxes with gold values
- Major tier: full attribute grid matching investigator layout

## 8. Localization

New keys in `lang/en.json` under `DREADLIGHT.` namespace:

```
NPC, Creature — actor type labels
TierMinor, TierImportant, TierMajor — tier labels
TierLabel — "Tier" dropdown label
Appearance — appearance field label
ThreatLevel, ThreatMinor, ThreatModerate, ThreatMajor — creature threat labels
KeyAttribute, KeyTalent — Important NPC labels
AddKeyAttribute, RemoveKeyAttribute, AddKeyTalent, RemoveKeyTalent — button labels
Attack, AddAttack, RemoveAttack — attack section labels
AttackPool, AttackDamage, AttackCrit, AttackRange — attack field labels
SoulDamage, SoulDamageTrigger — soul damage labels
Abilities, Weakness — creature section labels
AddAttribute, RemoveAttribute — creature attribute management
```

## 9. Entry Point Changes (`dreadlight.mjs`)

In the `init` hook:
1. Import and register `NpcData` and `CreatureData` in `CONFIG.Actor.dataModels`
2. Import and register `NpcSheet` and `CreatureSheet` via `Actors.registerSheet`
3. Add new templates to preload list
4. Add `CONFIG.DREADLIGHT.threatLevels` and `CONFIG.DREADLIGHT.npcTiers` for dropdown options

## 10. system.json Changes

- Add `"npc"` and `"creature"` to the `types` array under actor types
- Set default token attributes for creatures: primary = `body` track

## Out of Scope

- Creature compendium packs (can be added later)
- NPC-specific roll modifiers or conditions
- Creature AI/behavior automation
- Token configuration beyond defaults
- Drag-drop creature abilities between actors
