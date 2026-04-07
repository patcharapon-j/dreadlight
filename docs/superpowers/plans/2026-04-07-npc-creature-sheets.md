# NPC & Creature Sheets Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add two new actor types (npc, creature) with data models, sheets, templates, styles, and localization so GMs can create and manage NPCs and supernatural threats.

**Architecture:** Two new TypeDataModel classes (NpcData, CreatureData) following the existing InvestigatorData pattern. Two new AppV2 sheets (NpcSheet, CreatureSheet) using HandlebarsApplicationMixin, matching the InvestigatorSheet conventions. Creature attacks integrate with the existing DreadlightRoll dice system. All styles scoped under `.dreadlight.npc` and `.dreadlight.creature`.

**Tech Stack:** FoundryVTT v13 AppV2 API, TypeDataModel, HandlebarsApplicationMixin, Handlebars templates, vanilla CSS.

---

## File Map

| File | Action | Responsibility |
|---|---|---|
| `module/data/npc.mjs` | Create | NpcData TypeDataModel schema + derived data |
| `module/data/creature.mjs` | Create | CreatureData TypeDataModel schema |
| `module/sheets/npc-sheet.mjs` | Create | NpcSheet class (progressive reveal by tier) |
| `module/sheets/creature-sheet.mjs` | Create | CreatureSheet class (compact stat block + rollable attacks) |
| `templates/actors/npc-sheet.hbs` | Create | Main NPC sheet template with tier conditionals |
| `templates/actors/creature-sheet.hbs` | Create | Creature stat block template |
| `templates/actors/parts/npc-header.hbs` | Create | NPC portrait + name + tier selector partial |
| `templates/actors/parts/npc-key-stats.hbs` | Create | Key attributes + key talents partial (Important tier) |
| `templates/actors/parts/creature-attacks.hbs` | Create | Attack cards with roll buttons partial |
| `lang/en.json` | Modify | Add ~30 new localization keys |
| `system.json` | Modify | Add npc + creature to documentTypes.Actor |
| `dreadlight.mjs` | Modify | Import + register new models, sheets, templates, config |
| `styles/dreadlight.css` | Modify | Add NPC + creature sheet styles |

---

### Task 1: Add Localization Keys

**Files:**
- Modify: `lang/en.json`

These keys are needed by all subsequent tasks. Add them first so templates and sheets can reference them immediately.

- [ ] **Step 1: Add new keys to `lang/en.json`**

Add the following entries after the last existing key (`"DREADLIGHT.SettingShowTaintedFlavorTextHint"`), before the closing `}`:

```json
  "TYPES.Actor.npc": "NPC",
  "TYPES.Actor.creature": "Creature",

  "DREADLIGHT.SheetNpc": "NPC Sheet",
  "DREADLIGHT.SheetCreature": "Creature Sheet",
  "DREADLIGHT.TierLabel": "Tier",
  "DREADLIGHT.TierMinor": "Minor",
  "DREADLIGHT.TierImportant": "Important",
  "DREADLIGHT.TierMajor": "Major",
  "DREADLIGHT.Appearance": "Appearance",
  "DREADLIGHT.ThreatLevel": "Threat Level",
  "DREADLIGHT.ThreatMinor": "Minor Threat",
  "DREADLIGHT.ThreatModerate": "Moderate Threat",
  "DREADLIGHT.ThreatMajor": "Major Threat",
  "DREADLIGHT.KeyAttribute": "Key Attribute",
  "DREADLIGHT.KeyTalent": "Key Talent",
  "DREADLIGHT.AddKeyAttribute": "Add Attribute",
  "DREADLIGHT.RemoveKeyAttribute": "Remove",
  "DREADLIGHT.AddKeyTalent": "Add Talent",
  "DREADLIGHT.RemoveKeyTalent": "Remove",
  "DREADLIGHT.Attack": "Attack",
  "DREADLIGHT.AddAttack": "Add Attack",
  "DREADLIGHT.RemoveAttack": "Remove",
  "DREADLIGHT.AttackPool": "Pool",
  "DREADLIGHT.AttackDamage": "Damage",
  "DREADLIGHT.AttackCrit": "Crit",
  "DREADLIGHT.AttackRange": "Range",
  "DREADLIGHT.SoulDamage": "Soul Damage",
  "DREADLIGHT.SoulDamageTrigger": "Trigger",
  "DREADLIGHT.Abilities": "Special Abilities",
  "DREADLIGHT.Weakness": "Weakness",
  "DREADLIGHT.AddAttribute": "Add Attribute",
  "DREADLIGHT.RemoveAttribute": "Remove"
```

- [ ] **Step 2: Verify JSON is valid**

Run: `node -e "JSON.parse(require('fs').readFileSync('lang/en.json','utf8')); console.log('Valid JSON')"`
Expected: `Valid JSON`

- [ ] **Step 3: Commit**

```bash
git add lang/en.json
git commit -m "feat(npc): add localization keys for NPC and creature sheets"
```

---

### Task 2: Register Actor Types in `system.json`

**Files:**
- Modify: `system.json`

- [ ] **Step 1: Add npc and creature to documentTypes.Actor**

In `system.json`, change the `documentTypes.Actor` object from:

```json
    "Actor": {
      "investigator": {}
    },
```

to:

```json
    "Actor": {
      "investigator": {},
      "npc": {},
      "creature": {}
    },
```

- [ ] **Step 2: Verify JSON is valid**

Run: `node -e "JSON.parse(require('fs').readFileSync('system.json','utf8')); console.log('Valid JSON')"`
Expected: `Valid JSON`

- [ ] **Step 3: Commit**

```bash
git add system.json
git commit -m "feat(npc): register npc and creature actor types in system.json"
```

---

### Task 3: Create NPC Data Model

**Files:**
- Create: `module/data/npc.mjs`

- [ ] **Step 1: Create `module/data/npc.mjs`**

```javascript
const fields = foundry.data.fields;

export class NpcData extends foundry.abstract.TypeDataModel {
  static defineSchema() {
    return {
      tier: new fields.StringField({
        required: true,
        initial: "minor",
        choices: ["minor", "important", "major"],
      }),

      appearance: new fields.StringField({ required: true, initial: "" }),
      notes: new fields.HTMLField({ required: true, initial: "" }),

      // Important tier: up to 3 key attributes
      keyAttributes: new fields.ArrayField(
        new fields.SchemaField({
          attr: new fields.StringField({
            required: true,
            initial: "str",
            choices: ["str", "agl", "log", "per", "ins", "emp"],
          }),
          value: new fields.NumberField({ required: true, initial: 3, min: 2, max: 5, integer: true }),
        })
      ),

      // Important tier: up to 2 key talents
      keyTalents: new fields.ArrayField(
        new fields.SchemaField({
          name: new fields.StringField({ required: true, initial: "" }),
          level: new fields.NumberField({ required: true, initial: 1, min: 0, max: 3, integer: true }),
        })
      ),

      // Important + Major: Body and Mind tracks
      body: new fields.SchemaField({
        value: new fields.NumberField({ required: true, initial: 6, min: 0, integer: true }),
        max: new fields.NumberField({ required: true, initial: 6, min: 4, max: 12, integer: true }),
      }),
      mind: new fields.SchemaField({
        value: new fields.NumberField({ required: true, initial: 6, min: 0, integer: true }),
        max: new fields.NumberField({ required: true, initial: 6, min: 4, max: 12, integer: true }),
      }),

      // Major tier: full six attributes
      attributes: new fields.SchemaField({
        str: new fields.SchemaField({
          value: new fields.NumberField({ required: true, initial: 3, min: 0, max: 6, integer: true }),
        }),
        agl: new fields.SchemaField({
          value: new fields.NumberField({ required: true, initial: 3, min: 0, max: 6, integer: true }),
        }),
        log: new fields.SchemaField({
          value: new fields.NumberField({ required: true, initial: 3, min: 0, max: 6, integer: true }),
        }),
        per: new fields.SchemaField({
          value: new fields.NumberField({ required: true, initial: 3, min: 0, max: 6, integer: true }),
        }),
        ins: new fields.SchemaField({
          value: new fields.NumberField({ required: true, initial: 3, min: 0, max: 6, integer: true }),
        }),
        emp: new fields.SchemaField({
          value: new fields.NumberField({ required: true, initial: 3, min: 0, max: 6, integer: true }),
        }),
      }),

      // Major tier: Soul track
      soul: new fields.SchemaField({
        value: new fields.NumberField({ required: true, initial: 6, min: 0, integer: true }),
        max: new fields.NumberField({ required: true, initial: 6, min: 0, integer: true }),
      }),
    };
  }

  prepareDerivedData() {
    if (this.tier === "major") {
      const attr = this.attributes;
      // Derive track maximums from attributes (same as investigator)
      this.body.max = attr.str.value + attr.agl.value;
      this.mind.max = attr.log.value + attr.emp.value;
      this.soul.max = attr.ins.value + attr.per.value;
    }

    // Clamp track values to max (Important + Major)
    if (this.tier === "important" || this.tier === "major") {
      this.body.value = Math.min(this.body.value, this.body.max);
      this.mind.value = Math.min(this.mind.value, this.mind.max);

      this.body.broken = this.body.value === 0;
      this.mind.broken = this.mind.value === 0;
    }

    if (this.tier === "major") {
      this.soul.value = Math.min(this.soul.value, this.soul.max);
      this.soul.broken = this.soul.value === 0;
    }
  }
}
```

- [ ] **Step 2: Verify the file loads without syntax errors**

Run: `node -e "import('./module/data/npc.mjs').catch(e => console.log('Module syntax OK — import fails in Node as expected (FoundryVTT globals missing)'))"`
Expected: Message about FoundryVTT globals missing (not a syntax error)

- [ ] **Step 3: Commit**

```bash
git add module/data/npc.mjs
git commit -m "feat(npc): add NpcData TypeDataModel with tier-based schema"
```

---

### Task 4: Create Creature Data Model

**Files:**
- Create: `module/data/creature.mjs`

- [ ] **Step 1: Create `module/data/creature.mjs`**

```javascript
const fields = foundry.data.fields;

export class CreatureData extends foundry.abstract.TypeDataModel {
  static defineSchema() {
    return {
      appearance: new fields.StringField({ required: true, initial: "" }),

      threatLevel: new fields.StringField({
        required: true,
        initial: "moderate",
        choices: ["minor", "moderate", "major"],
      }),

      // Flexible 0-6 attributes — GM picks which ones matter
      attributes: new fields.ArrayField(
        new fields.SchemaField({
          attr: new fields.StringField({
            required: true,
            initial: "str",
            choices: ["str", "agl", "log", "per", "ins", "emp"],
          }),
          value: new fields.NumberField({ required: true, initial: 3, min: 1, max: 8, integer: true }),
        })
      ),

      body: new fields.SchemaField({
        value: new fields.NumberField({ required: true, initial: 6, min: 0, integer: true }),
        max: new fields.NumberField({ required: true, initial: 6, min: 1, max: 30, integer: true }),
      }),

      armor: new fields.NumberField({ required: true, initial: 0, min: 0, max: 10, integer: true }),

      // 1-3 structured attacks, each independently rollable
      attacks: new fields.ArrayField(
        new fields.SchemaField({
          name: new fields.StringField({ required: true, initial: "" }),
          attribute: new fields.StringField({
            required: true,
            initial: "str",
            choices: ["str", "agl", "log", "per", "ins", "emp"],
          }),
          damage: new fields.NumberField({ required: true, initial: 1, min: 0, integer: true }),
          critThreshold: new fields.NumberField({ required: true, initial: 6, min: 1, max: 6, integer: true }),
          range: new fields.StringField({
            required: true,
            initial: "engaged",
            choices: ["engaged", "short", "medium", "long", "extreme"],
          }),
        })
      ),

      soulDamage: new fields.SchemaField({
        value: new fields.NumberField({ required: true, initial: 0, min: 0, max: 10, integer: true }),
        description: new fields.StringField({ required: true, initial: "" }),
      }),

      abilities: new fields.HTMLField({ required: true, initial: "" }),
      weakness: new fields.HTMLField({ required: true, initial: "" }),
      notes: new fields.HTMLField({ required: true, initial: "" }),
    };
  }

  prepareDerivedData() {
    // Clamp body value to max
    this.body.value = Math.min(this.body.value, this.body.max);
    this.body.broken = this.body.value === 0;
  }

  /**
   * Look up an attribute value from the flexible attributes array.
   * Returns 0 if the attribute isn't defined on this creature.
   * @param {string} attrKey — e.g. "str", "agl"
   * @returns {number}
   */
  getAttributeValue(attrKey) {
    const entry = this.attributes.find(a => a.attr === attrKey);
    return entry ? entry.value : 0;
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add module/data/creature.mjs
git commit -m "feat(creature): add CreatureData TypeDataModel with flexible attributes and attacks"
```

---

### Task 5: Register Models, Sheets, and Config in Entry Point

**Files:**
- Modify: `dreadlight.mjs`

This task wires everything into the FoundryVTT init hook. The sheet classes don't exist yet — that's fine, FoundryVTT won't error until you actually open a sheet. We register them now so the actor types are immediately creatable.

- [ ] **Step 1: Add imports at the top of `dreadlight.mjs`**

After the existing import for `EquipmentData` (line 5), add:

```javascript
import { NpcData } from "./module/data/npc.mjs";
import { CreatureData } from "./module/data/creature.mjs";
```

After the existing import for `EquipmentSheet` (line 9), add:

```javascript
import { NpcSheet } from "./module/sheets/npc-sheet.mjs";
import { CreatureSheet } from "./module/sheets/creature-sheet.mjs";
```

- [ ] **Step 2: Add config entries inside the `Hooks.once("init")` callback**

After the `CONFIG.DREADLIGHT.d66Tables = d66Tables;` line (line 45), add:

```javascript
  CONFIG.DREADLIGHT.npcTiers = {
    minor: "DREADLIGHT.TierMinor",
    important: "DREADLIGHT.TierImportant",
    major: "DREADLIGHT.TierMajor",
  };
  CONFIG.DREADLIGHT.threatLevels = {
    minor: "DREADLIGHT.ThreatMinor",
    moderate: "DREADLIGHT.ThreatModerate",
    major: "DREADLIGHT.ThreatMajor",
  };
```

- [ ] **Step 3: Register data models**

Change the existing `Object.assign(CONFIG.Actor.dataModels, ...)` line (line 53) from:

```javascript
  Object.assign(CONFIG.Actor.dataModels, { investigator: InvestigatorData });
```

to:

```javascript
  Object.assign(CONFIG.Actor.dataModels, {
    investigator: InvestigatorData,
    npc: NpcData,
    creature: CreatureData,
  });
```

- [ ] **Step 4: Register sheet classes**

After the existing `Actors.registerSheet` call for InvestigatorSheet (lines 63-67), add:

```javascript
  Actors.registerSheet("dreadlight", NpcSheet, {
    types: ["npc"],
    makeDefault: true,
    label: "DREADLIGHT.SheetNpc",
  });
  Actors.registerSheet("dreadlight", CreatureSheet, {
    types: ["creature"],
    makeDefault: true,
    label: "DREADLIGHT.SheetCreature",
  });
```

- [ ] **Step 5: Add new templates to preload list**

Inside the `foundry.applications.handlebars.loadTemplates([...])` call (lines 92-106), add these entries:

```javascript
    "systems/dreadlight/templates/actors/npc-sheet.hbs",
    "systems/dreadlight/templates/actors/creature-sheet.hbs",
    "systems/dreadlight/templates/actors/parts/npc-header.hbs",
    "systems/dreadlight/templates/actors/parts/npc-key-stats.hbs",
    "systems/dreadlight/templates/actors/parts/creature-attacks.hbs",
```

- [ ] **Step 6: Commit**

```bash
git add dreadlight.mjs
git commit -m "feat(npc): register NPC and creature models, sheets, and config in entry point"
```

---

### Task 6: Create NPC Sheet Templates

**Files:**
- Create: `templates/actors/npc-sheet.hbs`
- Create: `templates/actors/parts/npc-header.hbs`
- Create: `templates/actors/parts/npc-key-stats.hbs`

- [ ] **Step 1: Create `templates/actors/parts/npc-header.hbs`**

```handlebars
<div class="sheet-header npc-header">
  <figure class="portrait-figure">
    <img src="{{actor.img}}" alt="{{actor.name}}" />
    {{#if editable}}
      <div class="portrait-edit-overlay" data-action="editPortrait"><i class="fa-solid fa-camera"></i></div>
    {{/if}}
  </figure>
  <div class="header-identity">
    <input class="name-input" type="text" name="name" value="{{actor.name}}" placeholder="NPC Name" />
    <div class="tier-row">
      <select name="system.tier" class="tier-select" data-action="changeTier">
        {{#each tierOptions}}
          <option value="{{this.value}}" {{#if this.selected}}selected{{/if}}>{{localize this.label}}</option>
        {{/each}}
      </select>
    </div>
    {{#if (or (eq system.tier "important") (eq system.tier "major"))}}
      <input class="appearance-input" type="text" name="system.appearance" value="{{system.appearance}}" placeholder="{{localize 'DREADLIGHT.Appearance'}}..." />
    {{else}}
      <input class="appearance-input" type="text" name="system.appearance" value="{{system.appearance}}" placeholder="{{localize 'DREADLIGHT.Appearance'}}..." />
    {{/if}}
  </div>
</div>
```

- [ ] **Step 2: Create `templates/actors/parts/npc-key-stats.hbs`**

```handlebars
<div class="npc-key-stats">
  <div class="section-header">
    <span>{{localize "DREADLIGHT.KeyAttribute"}}</span>
    <div class="section-line"></div>
  </div>
  <div class="key-attr-list">
    {{#each keyAttributes}}
      <div class="key-attr-entry" data-index="{{@index}}">
        <div class="key-attr-roll" data-action="rollKeyAttribute" data-index="{{@index}}">
          <div class="attr-abbr">{{attrAbbr this.attr}}</div>
          <div class="attr-value">{{this.value}}</div>
        </div>
        {{#if ../editable}}
          <select name="system.keyAttributes.{{@index}}.attr" class="key-attr-select">
            {{#each ../../attrOptions}}
              <option value="{{this.value}}" {{#if (eq this.value ../attr)}}selected{{/if}}>{{this.label}}</option>
            {{/each}}
          </select>
          <input type="number" name="system.keyAttributes.{{@index}}.value" value="{{this.value}}" min="2" max="5" class="key-attr-value-input" />
          <button type="button" class="remove-btn" data-action="removeKeyAttribute" data-index="{{@index}}"><i class="fa-solid fa-xmark"></i></button>
        {{/if}}
      </div>
    {{/each}}
    {{#if canAddKeyAttribute}}
      <button type="button" class="add-btn" data-action="addKeyAttribute"><i class="fa-solid fa-plus"></i> {{localize "DREADLIGHT.AddKeyAttribute"}}</button>
    {{/if}}
  </div>

  <div class="section-header">
    <span>{{localize "DREADLIGHT.KeyTalent"}}</span>
    <div class="section-line"></div>
  </div>
  <div class="key-talent-list">
    {{#each keyTalents}}
      <div class="key-talent-entry" data-index="{{@index}}">
        <input type="text" name="system.keyTalents.{{@index}}.name" value="{{this.name}}" placeholder="Talent name..." class="key-talent-name" />
        <div class="key-talent-level">
          {{{talentPips this.level "gold"}}}
        </div>
        <input type="number" name="system.keyTalents.{{@index}}.level" value="{{this.level}}" min="0" max="3" class="key-talent-level-input" />
        {{#if ../editable}}
          <button type="button" class="remove-btn" data-action="removeKeyTalent" data-index="{{@index}}"><i class="fa-solid fa-xmark"></i></button>
        {{/if}}
      </div>
    {{/each}}
    {{#if canAddKeyTalent}}
      <button type="button" class="add-btn" data-action="addKeyTalent"><i class="fa-solid fa-plus"></i> {{localize "DREADLIGHT.AddKeyTalent"}}</button>
    {{/if}}
  </div>
</div>
```

- [ ] **Step 3: Create `templates/actors/npc-sheet.hbs`**

```handlebars
<div class="dreadlight sheet actor npc tier-{{system.tier}}">
  <div class="corner tl"></div>
  <div class="corner tr"></div>
  <div class="corner bl"></div>
  <div class="corner br"></div>
  <div class="accent-top"></div>

  {{> "systems/dreadlight/templates/actors/parts/npc-header.hbs"}}

  {{!-- Important tier: key stats + tracks --}}
  {{#if (eq system.tier "important")}}
    {{> "systems/dreadlight/templates/actors/parts/npc-key-stats.hbs"}}

    <div class="npc-tracks">
      <div class="track-col">
        <div class="track-btn body {{#if system.body.broken}}is-broken{{/if}}">
          <div class="track-icon body">♥</div>
          <div class="track-info">
            <div class="track-label body">{{localize "DREADLIGHT.TrackBody"}}</div>
            <div class="track-pips">{{{trackPips system.body.value system.body.max "body"}}}</div>
          </div>
          <span class="track-num">{{system.body.value}}</span>
        </div>
      </div>
      <div class="track-col">
        <div class="track-btn mind {{#if system.mind.broken}}is-broken{{/if}}">
          <div class="track-icon mind">◈</div>
          <div class="track-info">
            <div class="track-label mind">{{localize "DREADLIGHT.TrackMind"}}</div>
            <div class="track-pips">{{{trackPips system.mind.value system.mind.max "mind"}}}</div>
          </div>
          <span class="track-num">{{system.mind.value}}</span>
        </div>
      </div>
    </div>

    {{!-- Notable gear --}}
    <div class="npc-gear">
      <div class="section-header"><span>{{localize "DREADLIGHT.Gear"}}</span><div class="section-line"></div></div>
      {{#each weapons}}
        <div class="item-row weapon-row" data-item-id="{{this.id}}">
          <div class="item-icon red">⚔</div>
          <div class="item-info">
            <div class="item-name">{{this.name}}</div>
          </div>
          <div class="item-stat stat-red">DMG {{this.system.damage}}</div>
          {{#if this.system.gearBonusMax}}
            <div class="item-stat stat-gold">+{{this.system.gearBonus}}</div>
          {{/if}}
        </div>
      {{/each}}
      {{#each equipment}}
        <div class="item-row gear-row" data-item-id="{{this.id}}">
          <div class="item-icon gold">⬡</div>
          <div class="item-info">
            <div class="item-name">{{this.name}}</div>
          </div>
          {{#if this.system.gearBonusMax}}
            <div class="item-stat stat-gold">+{{this.system.gearBonus}}</div>
          {{/if}}
        </div>
      {{/each}}
      <div class="drop-zone">{{localize "DREADLIGHT.DropItems"}}</div>
    </div>
  {{/if}}

  {{!-- Major tier: full attributes + tracks + items --}}
  {{#if (eq system.tier "major")}}
    <div class="npc-major-body">
      <div class="section-header">
        <span>{{localize "DREADLIGHT.RollAttribute"}}</span>
        <div class="section-line"></div>
      </div>
      <div class="attr-grid">
        {{#each attributeList}}
          <div class="attr-cell" data-attr="{{this.key}}">
            <div class="attr-roll-area" data-action="rollAttribute" data-attr="{{this.key}}">
              <div class="attr-abbr">{{attrAbbr this.key}}</div>
              <input class="attr-value-input" type="number"
                     name="system.attributes.{{this.key}}.value"
                     value="{{this.value}}" min="0" max="6" data-dtype="Number" />
              <div class="attr-name">{{attrName this.key}}</div>
            </div>
          </div>
        {{/each}}
      </div>

      <div class="npc-tracks">
        <div class="track-col">
          <div class="track-btn body {{#if system.body.broken}}is-broken{{/if}}">
            <div class="track-icon body">♥</div>
            <div class="track-info">
              <div class="track-label body">{{localize "DREADLIGHT.TrackBody"}}</div>
              <div class="track-pips">{{{trackPips system.body.value system.body.max "body"}}}</div>
            </div>
            <span class="track-num">{{system.body.value}}</span>
          </div>
        </div>
        <div class="track-col">
          <div class="track-btn mind {{#if system.mind.broken}}is-broken{{/if}}">
            <div class="track-icon mind">◈</div>
            <div class="track-info">
              <div class="track-label mind">{{localize "DREADLIGHT.TrackMind"}}</div>
              <div class="track-pips">{{{trackPips system.mind.value system.mind.max "mind"}}}</div>
            </div>
            <span class="track-num">{{system.mind.value}}</span>
          </div>
        </div>
        <div class="track-col">
          <div class="track-btn soul {{#if system.soul.broken}}is-broken{{/if}}">
            <div class="track-icon soul">◉</div>
            <div class="track-info">
              <div class="track-label soul">{{localize "DREADLIGHT.TrackSoul"}}</div>
              <div class="track-pips">{{{trackPips system.soul.value system.soul.max "soul"}}}</div>
            </div>
            <span class="track-num">{{system.soul.value}}</span>
          </div>
        </div>
      </div>

      {{!-- Items: talents, weapons, armor, equipment --}}
      <div class="npc-items">
        <div class="section-header"><span>{{localize "DREADLIGHT.TabTalents"}}</span><div class="section-line"></div></div>
        {{#each talents}}
          <div class="item-row talent-row" data-item-id="{{this.id}}">
            <div class="item-icon gold">◆</div>
            <div class="item-info" data-action="openItem">
              <div class="item-name">{{this.name}}</div>
            </div>
            <div class="item-stat stat-gold">L{{this.system.level}}</div>
          </div>
        {{/each}}

        <div class="section-header"><span>{{localize "DREADLIGHT.Weapons"}}</span><div class="section-line"></div></div>
        {{#each weapons}}
          <div class="item-row weapon-row" data-item-id="{{this.id}}">
            <div class="item-icon red">⚔</div>
            <div class="item-info" data-action="openItem">
              <div class="item-name">{{this.name}}</div>
            </div>
            <div class="item-stat stat-red">DMG {{this.system.damage}}</div>
            <div class="item-stat stat-gold">CRIT {{this.system.critThreshold}}</div>
          </div>
        {{/each}}

        <div class="section-header"><span>{{localize "DREADLIGHT.Armor"}}</span><div class="section-line"></div></div>
        {{#each armors}}
          <div class="item-row armor-row" data-item-id="{{this.id}}">
            <div class="item-icon mind">🛡</div>
            <div class="item-info" data-action="openItem">
              <div class="item-name">{{this.name}}</div>
            </div>
            <div class="item-stat stat-blue">AR {{this.system.armorRating}}</div>
          </div>
        {{/each}}

        <div class="section-header"><span>{{localize "DREADLIGHT.Gear"}}</span><div class="section-line"></div></div>
        {{#each equipment}}
          <div class="item-row gear-row" data-item-id="{{this.id}}">
            <div class="item-icon gold">⬡</div>
            <div class="item-info" data-action="openItem">
              <div class="item-name">{{this.name}}</div>
            </div>
          </div>
        {{/each}}

        <div class="drop-zone">{{localize "DREADLIGHT.DropItems"}}</div>
      </div>
    </div>
  {{/if}}

  {{!-- Notes — all tiers --}}
  <div class="npc-notes">
    <div class="section-header"><span>{{localize "DREADLIGHT.Notes"}}</span><div class="section-line"></div></div>
    <div class="notes-editor">
      {{editor system.notes target="system.notes" button=true editable=editable}}
    </div>
  </div>

  <div class="accent-bottom"></div>
</div>
```

- [ ] **Step 4: Commit**

```bash
git add templates/actors/npc-sheet.hbs templates/actors/parts/npc-header.hbs templates/actors/parts/npc-key-stats.hbs
git commit -m "feat(npc): add NPC sheet templates with tier-based progressive reveal"
```

---

### Task 7: Create NPC Sheet Class

**Files:**
- Create: `module/sheets/npc-sheet.mjs`

- [ ] **Step 1: Create `module/sheets/npc-sheet.mjs`**

```javascript
import { DreadlightRollDialog } from "../dice/roll-dialog.mjs";

const { HandlebarsApplicationMixin } = foundry.applications.api;
const { ActorSheetV2 } = foundry.applications.sheets;

export class NpcSheet extends HandlebarsApplicationMixin(ActorSheetV2) {

  static DEFAULT_OPTIONS = {
    classes: ["dreadlight", "sheet", "actor", "npc"],
    position: { width: 560, height: 500 },
    window: { resizable: true },
    actions: {
      changeTier: NpcSheet.#changeTier,
      editPortrait: NpcSheet.#editPortrait,
      rollAttribute: NpcSheet.#rollAttribute,
      rollKeyAttribute: NpcSheet.#rollKeyAttribute,
      addKeyAttribute: NpcSheet.#addKeyAttribute,
      removeKeyAttribute: NpcSheet.#removeKeyAttribute,
      addKeyTalent: NpcSheet.#addKeyTalent,
      removeKeyTalent: NpcSheet.#removeKeyTalent,
      openItem: NpcSheet.#openItem,
      deleteItem: NpcSheet.#deleteItem,
    },
    form: { submitOnChange: true },
    dragDrop: [{ dragSelector: ".item-row", dropSelector: null }],
  };

  static PARTS = {
    sheet: { template: "systems/dreadlight/templates/actors/npc-sheet.hbs" },
  };

  /* ---------------------------------------- */
  /*  Drag-Drop                               */
  /* ---------------------------------------- */

  #dragDrop;

  constructor(options = {}) {
    super(options);
    this.#dragDrop = this.#createDragDropHandlers();
  }

  get dragDrop() { return this.#dragDrop; }

  #createDragDropHandlers() {
    return this.options.dragDrop.map((d) => {
      d.permissions = {
        dragstart: this._canDragStart.bind(this),
        drop: this._canDragDrop.bind(this),
      };
      d.callbacks = {
        dragstart: this._onDragStart.bind(this),
        dragover: this._onDragOver.bind(this),
        drop: this._onDrop.bind(this),
      };
      return new DragDrop(d);
    });
  }

  /* ---------------------------------------- */
  /*  Context                                 */
  /* ---------------------------------------- */

  async _prepareContext(options) {
    const context = await super._prepareContext(options);
    const system = this.actor.system;

    context.actor = this.actor;
    context.system = system;
    context.config = CONFIG.DREADLIGHT;
    context.editable = this.isEditable;

    // Tier options for the dropdown
    context.tierOptions = Object.entries(CONFIG.DREADLIGHT.npcTiers).map(([value, label]) => ({
      value, label, selected: value === system.tier,
    }));

    // Attribute options for key attribute selects
    context.attrOptions = CONFIG.DREADLIGHT.attributes.map(key => ({
      value: key,
      label: game.i18n.localize(CONFIG.DREADLIGHT.attributeLabels[key]),
    }));

    // Key attributes/talents (Important tier)
    context.keyAttributes = system.keyAttributes ?? [];
    context.keyTalents = system.keyTalents ?? [];
    context.canAddKeyAttribute = (system.keyAttributes?.length ?? 0) < 3;
    context.canAddKeyTalent = (system.keyTalents?.length ?? 0) < 2;

    // Full attribute list (Major tier)
    if (system.tier === "major") {
      context.attributeList = CONFIG.DREADLIGHT.attributes.map(key => ({
        key,
        value: system.attributes[key].value,
      }));
    }

    // Items — filter by tier permissions
    const items = Array.from(this.actor.items);
    if (system.tier === "major") {
      context.talents = items.filter(i => i.type === "talent").sort((a, b) => a.name.localeCompare(b.name));
      context.weapons = items.filter(i => i.type === "weapon").sort((a, b) => (a.sort ?? 0) - (b.sort ?? 0));
      context.armors = items.filter(i => i.type === "armor").sort((a, b) => (a.sort ?? 0) - (b.sort ?? 0));
      context.equipment = items.filter(i => i.type === "equipment").sort((a, b) => (a.sort ?? 0) - (b.sort ?? 0));
    } else if (system.tier === "important") {
      context.weapons = items.filter(i => i.type === "weapon").sort((a, b) => (a.sort ?? 0) - (b.sort ?? 0));
      context.equipment = items.filter(i => i.type === "equipment").sort((a, b) => (a.sort ?? 0) - (b.sort ?? 0));
    }

    return context;
  }

  /* ---------------------------------------- */
  /*  Render                                  */
  /* ---------------------------------------- */

  _onRender(context, options) {
    super._onRender(context, options);
    this.#dragDrop.forEach(d => d.bind(this.element));

    if (!this.isEditable) return;

    const system = this.actor.system;

    // Track buttons: left-click +1, right-click -1 (Important + Major)
    if (system.tier === "important" || system.tier === "major") {
      for (const trackKey of ["body", "mind"]) {
        const btn = this.element.querySelector(`.track-btn.${trackKey}`);
        if (!btn) continue;
        btn.addEventListener("click", () => {
          const track = system[trackKey];
          if (track.value < track.max) this.actor.update({ [`system.${trackKey}.value`]: track.value + 1 });
        });
        btn.addEventListener("contextmenu", (ev) => {
          ev.preventDefault();
          const track = system[trackKey];
          if (track.value > 0) this.actor.update({ [`system.${trackKey}.value`]: track.value - 1 });
        });
      }
    }

    // Soul track (Major only)
    if (system.tier === "major") {
      const soulBtn = this.element.querySelector(".track-btn.soul");
      if (soulBtn) {
        soulBtn.addEventListener("click", () => {
          const track = system.soul;
          if (track.value < track.max) this.actor.update({ "system.soul.value": track.value + 1 });
        });
        soulBtn.addEventListener("contextmenu", (ev) => {
          ev.preventDefault();
          const track = system.soul;
          if (track.value > 0) this.actor.update({ "system.soul.value": track.value - 1 });
        });
      }
    }
  }

  /* ---------------------------------------- */
  /*  Actions                                 */
  /* ---------------------------------------- */

  static #changeTier(event, target) {
    // Handled by submitOnChange — select has name="system.tier"
  }

  static #editPortrait(event, target) {
    const fp = new FilePicker({
      type: "image",
      current: this.actor.img,
      callback: (path) => this.actor.update({ img: path }),
    });
    fp.render(true);
  }

  static #rollAttribute(event, target) {
    const attr = target.closest("[data-attr]").dataset.attr;
    new DreadlightRollDialog({ actor: this.actor, attribute: attr }).render(true);
  }

  static #rollKeyAttribute(event, target) {
    const index = parseInt(target.closest("[data-index]").dataset.index);
    const entry = this.actor.system.keyAttributes[index];
    if (!entry) return;

    // For key attribute rolls, we create a simplified roll using base dice only
    // (no dread, no talent, no gear — just the key attribute value)
    const { DreadlightRoll } = await import("../dice/dreadlight-roll.mjs");
    const { sendRollToChat } = await import("../dice/chat-message.mjs");
    const roll = new DreadlightRoll({
      baseDice: entry.value,
      dreadDice: 0,
      gearDice: 0,
      attribute: entry.attr,
      actor: this.actor,
    });
    await roll.evaluate();
    await roll.showDSN();
    await sendRollToChat(roll);
  }

  static #addKeyAttribute(event, target) {
    const attrs = this.actor.system.keyAttributes ?? [];
    if (attrs.length >= 3) return;
    this.actor.update({ "system.keyAttributes": [...attrs, { attr: "str", value: 3 }] });
  }

  static #removeKeyAttribute(event, target) {
    const index = parseInt(target.closest("[data-index]").dataset.index);
    const attrs = [...(this.actor.system.keyAttributes ?? [])];
    attrs.splice(index, 1);
    this.actor.update({ "system.keyAttributes": attrs });
  }

  static #addKeyTalent(event, target) {
    const talents = this.actor.system.keyTalents ?? [];
    if (talents.length >= 2) return;
    this.actor.update({ "system.keyTalents": [...talents, { name: "", level: 1 }] });
  }

  static #removeKeyTalent(event, target) {
    const index = parseInt(target.closest("[data-index]").dataset.index);
    const talents = [...(this.actor.system.keyTalents ?? [])];
    talents.splice(index, 1);
    this.actor.update({ "system.keyTalents": talents });
  }

  static #openItem(event, target) {
    const itemId = target.closest("[data-item-id]").dataset.itemId;
    const item = this.actor.items.get(itemId);
    item?.sheet?.render(true);
  }

  static #deleteItem(event, target) {
    const itemId = target.closest("[data-item-id]").dataset.itemId;
    const item = this.actor.items.get(itemId);
    item?.delete();
  }
}
```

- [ ] **Step 2: Fix the `rollKeyAttribute` method — it uses `await` in a non-async static method**

The `#rollKeyAttribute` method needs to be an async function and use top-level dynamic imports. Replace the method with:

```javascript
  static async #rollKeyAttribute(event, target) {
    const index = parseInt(target.closest("[data-index]").dataset.index);
    const entry = this.actor.system.keyAttributes[index];
    if (!entry) return;

    const { DreadlightRoll } = await import("../dice/dreadlight-roll.mjs");
    const { sendRollToChat } = await import("../dice/chat-message.mjs");
    const roll = new DreadlightRoll({
      baseDice: entry.value,
      dreadDice: 0,
      gearDice: 0,
      attribute: entry.attr,
      actor: this.actor,
    });
    await roll.evaluate();
    await roll.showDSN();
    await sendRollToChat(roll);
  }
```

**Note:** The initial Step 1 code already contains the correct async version — this step is a verification checkpoint. Ensure the written file has `static async #rollKeyAttribute`.

- [ ] **Step 3: Commit**

```bash
git add module/sheets/npc-sheet.mjs
git commit -m "feat(npc): add NpcSheet class with tier-based progressive reveal"
```

---

### Task 8: Create Creature Sheet Templates

**Files:**
- Create: `templates/actors/creature-sheet.hbs`
- Create: `templates/actors/parts/creature-attacks.hbs`

- [ ] **Step 1: Create `templates/actors/parts/creature-attacks.hbs`**

```handlebars
<div class="creature-attacks">
  <div class="section-header creature-section-header">
    <span>{{localize "DREADLIGHT.Attack"}}</span>
    <div class="section-line"></div>
  </div>
  {{#each attacks}}
    <div class="attack-card" data-index="{{@index}}">
      <div class="attack-header">
        <input type="text" name="system.attacks.{{@index}}.name" value="{{this.name}}" placeholder="Attack name..." class="attack-name-input" />
        {{#if ../editable}}
          <button type="button" class="remove-btn" data-action="removeAttack" data-index="{{@index}}"><i class="fa-solid fa-xmark"></i></button>
        {{/if}}
      </div>
      <div class="attack-stats">
        <div class="attack-stat">
          <span class="attack-stat-label">{{localize "DREADLIGHT.AttackPool"}}</span>
          <select name="system.attacks.{{@index}}.attribute" class="attack-attr-select">
            {{#each ../attrOptions}}
              <option value="{{this.value}}" {{#if (eq this.value ../attribute)}}selected{{/if}}>{{this.label}}</option>
            {{/each}}
          </select>
          <span class="attack-stat-value">{{this.poolValue}}</span>
        </div>
        <div class="attack-stat">
          <span class="attack-stat-label">{{localize "DREADLIGHT.AttackDamage"}}</span>
          <input type="number" name="system.attacks.{{@index}}.damage" value="{{this.damage}}" min="0" class="attack-stat-input" />
        </div>
        <div class="attack-stat">
          <span class="attack-stat-label">{{localize "DREADLIGHT.AttackCrit"}}</span>
          <input type="number" name="system.attacks.{{@index}}.critThreshold" value="{{this.critThreshold}}" min="1" max="6" class="attack-stat-input" />
        </div>
        <div class="attack-stat">
          <span class="attack-stat-label">{{localize "DREADLIGHT.AttackRange"}}</span>
          <select name="system.attacks.{{@index}}.range" class="attack-range-select">
            <option value="engaged" {{#if (eq this.range "engaged")}}selected{{/if}}>{{localize "DREADLIGHT.RangeEngaged"}}</option>
            <option value="short" {{#if (eq this.range "short")}}selected{{/if}}>{{localize "DREADLIGHT.RangeShort"}}</option>
            <option value="medium" {{#if (eq this.range "medium")}}selected{{/if}}>{{localize "DREADLIGHT.RangeMedium"}}</option>
            <option value="long" {{#if (eq this.range "long")}}selected{{/if}}>{{localize "DREADLIGHT.RangeLong"}}</option>
            <option value="extreme" {{#if (eq this.range "extreme")}}selected{{/if}}>{{localize "DREADLIGHT.RangeExtreme"}}</option>
          </select>
        </div>
      </div>
      <button type="button" class="roll-attack-btn" data-action="rollAttack" data-index="{{@index}}">{{localize "DREADLIGHT.RollButton"}}</button>
    </div>
  {{/each}}
  {{#if canAddAttack}}
    <button type="button" class="add-btn" data-action="addAttack"><i class="fa-solid fa-plus"></i> {{localize "DREADLIGHT.AddAttack"}}</button>
  {{/if}}
</div>
```

- [ ] **Step 2: Create `templates/actors/creature-sheet.hbs`**

```handlebars
<div class="dreadlight sheet actor creature">
  <div class="corner tl"></div>
  <div class="corner tr"></div>
  <div class="corner bl"></div>
  <div class="corner br"></div>
  <div class="accent-top creature-accent"></div>

  {{!-- Header --}}
  <div class="sheet-header creature-header">
    <figure class="portrait-figure creature-portrait">
      <img src="{{actor.img}}" alt="{{actor.name}}" />
      {{#if editable}}
        <div class="portrait-edit-overlay" data-action="editPortrait"><i class="fa-solid fa-camera"></i></div>
      {{/if}}
    </figure>
    <div class="header-identity">
      <input class="name-input creature-name" type="text" name="name" value="{{actor.name}}" placeholder="Creature Name" />
      <div class="threat-row">
        <select name="system.threatLevel" class="threat-select">
          {{#each threatOptions}}
            <option value="{{this.value}}" {{#if this.selected}}selected{{/if}}>{{localize this.label}}</option>
          {{/each}}
        </select>
      </div>
      <textarea class="appearance-textarea" name="system.appearance" placeholder="{{localize 'DREADLIGHT.Appearance'}}..." rows="2">{{system.appearance}}</textarea>
    </div>
  </div>

  {{!-- Attributes --}}
  <div class="creature-attributes">
    <div class="section-header creature-section-header">
      <span>{{localize "DREADLIGHT.RollAttribute"}}</span>
      <div class="section-line"></div>
    </div>
    <div class="creature-attr-row">
      {{#each creatureAttributes}}
        <div class="creature-attr-cell" data-index="{{@index}}">
          <select name="system.attributes.{{@index}}.attr" class="creature-attr-select">
            {{#each ../attrOptions}}
              <option value="{{this.value}}" {{#if (eq this.value ../attr)}}selected{{/if}}>{{this.label}}</option>
            {{/each}}
          </select>
          <input type="number" name="system.attributes.{{@index}}.value" value="{{this.value}}" min="1" max="8" class="creature-attr-value" />
          {{#if ../editable}}
            <button type="button" class="remove-btn" data-action="removeAttribute" data-index="{{@index}}"><i class="fa-solid fa-xmark"></i></button>
          {{/if}}
        </div>
      {{/each}}
      {{#if canAddAttribute}}
        <button type="button" class="add-btn" data-action="addAttribute"><i class="fa-solid fa-plus"></i></button>
      {{/if}}
    </div>
  </div>

  {{!-- Body + Armor --}}
  <div class="creature-body-armor">
    <div class="creature-body">
      <div class="track-btn body {{#if system.body.broken}}is-broken{{/if}}">
        <div class="track-icon body">♥</div>
        <div class="track-info">
          <div class="track-label body">{{localize "DREADLIGHT.TrackBody"}}</div>
          <div class="track-pips">{{{trackPips system.body.value system.body.max "body"}}}</div>
        </div>
        <span class="track-num">{{system.body.value}}</span>
      </div>
      {{#if editable}}
        <div class="body-max-edit">
          <label>Max:</label>
          <input type="number" name="system.body.max" value="{{system.body.max}}" min="1" max="30" class="body-max-input" />
        </div>
      {{/if}}
    </div>
    <div class="creature-armor">
      <div class="section-label">{{localize "DREADLIGHT.Armor"}}</div>
      <input type="number" name="system.armor" value="{{system.armor}}" min="0" max="10" class="armor-value-input" />
    </div>
  </div>

  {{!-- Attacks --}}
  {{> "systems/dreadlight/templates/actors/parts/creature-attacks.hbs"}}

  {{!-- Soul Damage --}}
  <div class="creature-soul-damage">
    <div class="section-header soul-section-header">
      <span>{{localize "DREADLIGHT.SoulDamage"}}</span>
      <div class="section-line"></div>
    </div>
    <div class="soul-damage-row">
      <input type="number" name="system.soulDamage.value" value="{{system.soulDamage.value}}" min="0" max="10" class="soul-damage-value" />
      <input type="text" name="system.soulDamage.description" value="{{system.soulDamage.description}}" placeholder="{{localize 'DREADLIGHT.SoulDamageTrigger'}}..." class="soul-damage-desc" />
    </div>
  </div>

  {{!-- Special Abilities --}}
  <div class="creature-abilities">
    <div class="section-header abilities-section-header">
      <span>{{localize "DREADLIGHT.Abilities"}}</span>
      <div class="section-line"></div>
    </div>
    <div class="abilities-editor">
      {{editor system.abilities target="system.abilities" button=true editable=editable}}
    </div>
  </div>

  {{!-- Weakness --}}
  <div class="creature-weakness">
    <div class="section-header weakness-section-header">
      <span>{{localize "DREADLIGHT.Weakness"}}</span>
      <div class="section-line"></div>
    </div>
    <div class="weakness-editor">
      {{editor system.weakness target="system.weakness" button=true editable=editable}}
    </div>
  </div>

  {{!-- Notes --}}
  <div class="creature-notes">
    <div class="section-header"><span>{{localize "DREADLIGHT.Notes"}}</span><div class="section-line"></div></div>
    <div class="notes-editor">
      {{editor system.notes target="system.notes" button=true editable=editable}}
    </div>
  </div>

  <div class="accent-bottom creature-accent"></div>
</div>
```

- [ ] **Step 3: Commit**

```bash
git add templates/actors/creature-sheet.hbs templates/actors/parts/creature-attacks.hbs
git commit -m "feat(creature): add creature sheet templates with stat block layout"
```

---

### Task 9: Create Creature Sheet Class

**Files:**
- Create: `module/sheets/creature-sheet.mjs`

- [ ] **Step 1: Create `module/sheets/creature-sheet.mjs`**

```javascript
import { DreadlightRoll } from "../dice/dreadlight-roll.mjs";
import { sendRollToChat } from "../dice/chat-message.mjs";

const { HandlebarsApplicationMixin } = foundry.applications.api;
const { ActorSheetV2 } = foundry.applications.sheets;

export class CreatureSheet extends HandlebarsApplicationMixin(ActorSheetV2) {

  static DEFAULT_OPTIONS = {
    classes: ["dreadlight", "sheet", "actor", "creature"],
    position: { width: 480, height: 620 },
    window: { resizable: true },
    actions: {
      editPortrait: CreatureSheet.#editPortrait,
      rollAttack: CreatureSheet.#rollAttack,
      addAttack: CreatureSheet.#addAttack,
      removeAttack: CreatureSheet.#removeAttack,
      addAttribute: CreatureSheet.#addAttribute,
      removeAttribute: CreatureSheet.#removeAttribute,
    },
    form: { submitOnChange: true },
  };

  static PARTS = {
    sheet: { template: "systems/dreadlight/templates/actors/creature-sheet.hbs" },
  };

  /* ---------------------------------------- */
  /*  Context                                 */
  /* ---------------------------------------- */

  async _prepareContext(options) {
    const context = await super._prepareContext(options);
    const system = this.actor.system;

    context.actor = this.actor;
    context.system = system;
    context.config = CONFIG.DREADLIGHT;
    context.editable = this.isEditable;

    // Threat level options
    context.threatOptions = Object.entries(CONFIG.DREADLIGHT.threatLevels).map(([value, label]) => ({
      value, label, selected: value === system.threatLevel,
    }));

    // Attribute options for dropdowns
    context.attrOptions = CONFIG.DREADLIGHT.attributes.map(key => ({
      value: key,
      label: game.i18n.localize(CONFIG.DREADLIGHT.attributeLabels[key]),
    }));

    // Creature attributes with resolved values
    context.creatureAttributes = system.attributes ?? [];
    context.canAddAttribute = (system.attributes?.length ?? 0) < 6;

    // Attacks with resolved pool values
    context.attacks = (system.attacks ?? []).map((atk, i) => ({
      ...atk,
      poolValue: system.getAttributeValue(atk.attribute),
    }));
    context.canAddAttack = (system.attacks?.length ?? 0) < 3;

    return context;
  }

  /* ---------------------------------------- */
  /*  Render                                  */
  /* ---------------------------------------- */

  _onRender(context, options) {
    super._onRender(context, options);

    if (!this.isEditable) return;

    // Body track button: left-click +1, right-click -1
    const bodyBtn = this.element.querySelector(".track-btn.body");
    if (bodyBtn) {
      bodyBtn.addEventListener("click", () => {
        const track = this.actor.system.body;
        if (track.value < track.max) this.actor.update({ "system.body.value": track.value + 1 });
      });
      bodyBtn.addEventListener("contextmenu", (ev) => {
        ev.preventDefault();
        const track = this.actor.system.body;
        if (track.value > 0) this.actor.update({ "system.body.value": track.value - 1 });
      });
    }
  }

  /* ---------------------------------------- */
  /*  Actions                                 */
  /* ---------------------------------------- */

  static #editPortrait(event, target) {
    const fp = new FilePicker({
      type: "image",
      current: this.actor.img,
      callback: (path) => this.actor.update({ img: path }),
    });
    fp.render(true);
  }

  static async #rollAttack(event, target) {
    const index = parseInt(target.closest("[data-index]").dataset.index);
    const attack = this.actor.system.attacks[index];
    if (!attack) return;

    const poolValue = this.actor.system.getAttributeValue(attack.attribute);
    const roll = new DreadlightRoll({
      baseDice: poolValue,
      dreadDice: 0,
      gearDice: 0,
      attribute: attack.attribute,
      talentName: attack.name,
      actor: this.actor,
    });
    await roll.evaluate();
    await roll.showDSN();
    await sendRollToChat(roll);
  }

  static #addAttack(event, target) {
    const attacks = this.actor.system.attacks ?? [];
    if (attacks.length >= 3) return;
    this.actor.update({
      "system.attacks": [...attacks, { name: "", attribute: "str", damage: 1, critThreshold: 6, range: "engaged" }],
    });
  }

  static #removeAttack(event, target) {
    const index = parseInt(target.closest("[data-index]").dataset.index);
    const attacks = [...(this.actor.system.attacks ?? [])];
    attacks.splice(index, 1);
    this.actor.update({ "system.attacks": attacks });
  }

  static #addAttribute(event, target) {
    const attrs = this.actor.system.attributes ?? [];
    if (attrs.length >= 6) return;
    this.actor.update({
      "system.attributes": [...attrs, { attr: "str", value: 3 }],
    });
  }

  static #removeAttribute(event, target) {
    const index = parseInt(target.closest("[data-index]").dataset.index);
    const attrs = [...(this.actor.system.attributes ?? [])];
    attrs.splice(index, 1);
    this.actor.update({ "system.attributes": attrs });
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add module/sheets/creature-sheet.mjs
git commit -m "feat(creature): add CreatureSheet class with rollable attacks"
```

---

### Task 10: Add NPC and Creature Styles

**Files:**
- Modify: `styles/dreadlight.css`

- [ ] **Step 1: Add NPC sheet styles**

Append the following to the end of `styles/dreadlight.css`:

```css
/* ============================================================
   NPC SHEET
   ============================================================ */

.dreadlight.npc {
  background: #08080c;
  color: #ccc;
  font-family: "Monaspace Krypton", "Courier New", monospace;
}

.dreadlight.npc .sheet-header.npc-header {
  display: flex;
  gap: 16px;
  padding: 16px;
  background: #0e0e14;
  border-bottom: 1px solid #1a1a24;
}

.dreadlight.npc .portrait-figure {
  width: 64px;
  height: 64px;
  flex-shrink: 0;
  border: 1px solid #c9a96e;
  border-radius: 4px;
  overflow: hidden;
  position: relative;
}

.dreadlight.npc .portrait-figure img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.dreadlight.npc .portrait-edit-overlay {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(0, 0, 0, 0.6);
  opacity: 0;
  cursor: pointer;
  transition: opacity 0.2s;
}

.dreadlight.npc .portrait-figure:hover .portrait-edit-overlay {
  opacity: 1;
}

.dreadlight.npc .header-identity {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.dreadlight.npc .name-input {
  background: transparent;
  border: none;
  color: #c9a96e;
  font-size: 16px;
  letter-spacing: 1px;
  font-family: inherit;
  padding: 0;
}

.dreadlight.npc .tier-select {
  background: #1a1a24;
  border: 1px solid #333;
  color: #888;
  font-size: 11px;
  padding: 2px 8px;
  border-radius: 3px;
  font-family: inherit;
  letter-spacing: 0.5px;
  width: auto;
}

.dreadlight.npc .appearance-input {
  background: transparent;
  border: none;
  border-bottom: 1px solid #1a1a24;
  color: #777;
  font-size: 12px;
  font-style: italic;
  font-family: inherit;
  padding: 2px 0;
}

/* NPC Key Stats (Important tier) */
.dreadlight.npc .npc-key-stats {
  padding: 12px 16px;
}

.dreadlight.npc .key-attr-list {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-bottom: 12px;
}

.dreadlight.npc .key-attr-entry {
  display: flex;
  align-items: center;
  gap: 4px;
}

.dreadlight.npc .key-attr-roll {
  background: #1a1a24;
  border: 1px solid #333;
  padding: 6px 10px;
  border-radius: 3px;
  text-align: center;
  cursor: pointer;
  transition: border-color 0.2s;
}

.dreadlight.npc .key-attr-roll:hover {
  border-color: #c9a96e;
}

.dreadlight.npc .key-attr-roll .attr-abbr {
  color: #555;
  font-size: 9px;
  letter-spacing: 1px;
}

.dreadlight.npc .key-attr-roll .attr-value {
  color: #c9a96e;
  font-size: 18px;
}

.dreadlight.npc .key-attr-select,
.dreadlight.npc .key-attr-value-input {
  background: #111118;
  border: 1px solid #2a2a35;
  color: #888;
  font-size: 11px;
  padding: 2px 4px;
  border-radius: 3px;
  font-family: inherit;
  width: 50px;
}

.dreadlight.npc .key-talent-list {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.dreadlight.npc .key-talent-entry {
  display: flex;
  align-items: center;
  gap: 8px;
}

.dreadlight.npc .key-talent-name {
  background: transparent;
  border: none;
  border-bottom: 1px solid #1a1a24;
  color: #ccc;
  font-size: 12px;
  font-family: inherit;
  flex: 1;
  padding: 2px 0;
}

.dreadlight.npc .key-talent-level-input {
  background: #111118;
  border: 1px solid #2a2a35;
  color: #c9a96e;
  font-size: 12px;
  width: 36px;
  text-align: center;
  border-radius: 3px;
  font-family: inherit;
}

/* NPC Tracks */
.dreadlight.npc .npc-tracks {
  display: flex;
  gap: 16px;
  padding: 12px 16px;
}

.dreadlight.npc .npc-tracks .track-col {
  flex: 1;
}

/* NPC Major Body */
.dreadlight.npc .npc-major-body {
  padding: 12px 16px;
}

/* NPC Items */
.dreadlight.npc .npc-items {
  margin-top: 8px;
}

/* NPC Gear (Important tier) */
.dreadlight.npc .npc-gear {
  padding: 0 16px 12px;
}

/* NPC Notes */
.dreadlight.npc .npc-notes {
  padding: 12px 16px;
}

.dreadlight.npc .notes-editor {
  min-height: 60px;
}

/* Shared buttons */
.dreadlight.npc .add-btn,
.dreadlight.creature .add-btn {
  background: transparent;
  border: 1px dashed #333;
  color: #555;
  font-size: 11px;
  padding: 4px 12px;
  border-radius: 3px;
  cursor: pointer;
  font-family: inherit;
  letter-spacing: 0.5px;
  transition: color 0.2s, border-color 0.2s;
}

.dreadlight.npc .add-btn:hover,
.dreadlight.creature .add-btn:hover {
  color: #c9a96e;
  border-color: #c9a96e;
}

.dreadlight.npc .remove-btn,
.dreadlight.creature .remove-btn {
  background: transparent;
  border: none;
  color: #555;
  cursor: pointer;
  padding: 2px 6px;
  transition: color 0.2s;
}

.dreadlight.npc .remove-btn:hover,
.dreadlight.creature .remove-btn:hover {
  color: #e05555;
}
```

- [ ] **Step 2: Add creature sheet styles**

Append the following after the NPC styles:

```css
/* ============================================================
   CREATURE SHEET
   ============================================================ */

.dreadlight.creature {
  background: #08080c;
  color: #ccc;
  font-family: "Monaspace Krypton", "Courier New", monospace;
}

.dreadlight.creature .creature-accent {
  background: linear-gradient(90deg, transparent, #e05555, transparent) !important;
}

.dreadlight.creature .sheet-header.creature-header {
  display: flex;
  gap: 16px;
  padding: 16px;
  background: #0e0e14;
  border-bottom: 1px solid #1a1a24;
}

.dreadlight.creature .creature-portrait {
  width: 80px;
  height: 80px;
  flex-shrink: 0;
  border: 1px solid #e05555;
  border-radius: 4px;
  overflow: hidden;
  position: relative;
}

.dreadlight.creature .creature-portrait img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.dreadlight.creature .portrait-edit-overlay {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(0, 0, 0, 0.6);
  opacity: 0;
  cursor: pointer;
  transition: opacity 0.2s;
}

.dreadlight.creature .creature-portrait:hover .portrait-edit-overlay {
  opacity: 1;
}

.dreadlight.creature .header-identity {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.dreadlight.creature .creature-name {
  background: transparent;
  border: none;
  color: #e05555;
  font-size: 18px;
  letter-spacing: 2px;
  font-weight: bold;
  font-family: inherit;
  padding: 0;
}

.dreadlight.creature .threat-select {
  background: #1a1a24;
  border: 1px solid #333;
  color: #888;
  font-size: 11px;
  padding: 2px 8px;
  border-radius: 3px;
  font-family: inherit;
  letter-spacing: 0.5px;
  width: auto;
}

.dreadlight.creature .appearance-textarea {
  background: transparent;
  border: none;
  border-bottom: 1px solid #1a1a24;
  color: #777;
  font-size: 12px;
  font-style: italic;
  font-family: inherit;
  padding: 4px 0;
  resize: none;
  line-height: 1.4;
}

/* Creature Attributes */
.dreadlight.creature .creature-attributes {
  padding: 12px 16px 0;
}

.dreadlight.creature .creature-attr-row {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
  align-items: center;
}

.dreadlight.creature .creature-attr-cell {
  display: flex;
  align-items: center;
  gap: 4px;
  background: #1a1a24;
  border: 1px solid #333;
  padding: 6px 10px;
  border-radius: 3px;
}

.dreadlight.creature .creature-attr-select {
  background: transparent;
  border: none;
  color: #555;
  font-size: 9px;
  letter-spacing: 1px;
  font-family: inherit;
  width: 48px;
}

.dreadlight.creature .creature-attr-value {
  background: transparent;
  border: none;
  color: #c9a96e;
  font-size: 18px;
  text-align: center;
  width: 32px;
  font-family: inherit;
}

/* Creature Body + Armor */
.dreadlight.creature .creature-body-armor {
  display: flex;
  gap: 16px;
  padding: 12px 16px;
  align-items: flex-start;
}

.dreadlight.creature .creature-body {
  flex: 1;
}

.dreadlight.creature .body-max-edit {
  display: flex;
  align-items: center;
  gap: 4px;
  margin-top: 4px;
}

.dreadlight.creature .body-max-edit label {
  color: #555;
  font-size: 10px;
  letter-spacing: 0.5px;
}

.dreadlight.creature .body-max-input {
  background: #111118;
  border: 1px solid #2a2a35;
  color: #888;
  font-size: 11px;
  width: 40px;
  text-align: center;
  border-radius: 3px;
  font-family: inherit;
}

.dreadlight.creature .creature-armor {
  text-align: center;
}

.dreadlight.creature .creature-armor .section-label {
  color: #555;
  font-size: 10px;
  letter-spacing: 1px;
  margin-bottom: 4px;
}

.dreadlight.creature .armor-value-input {
  background: #1a1a24;
  border: 1px solid #333;
  color: #c9a96e;
  font-size: 20px;
  width: 48px;
  text-align: center;
  border-radius: 3px;
  padding: 8px;
  font-family: inherit;
}

/* Creature Attacks */
.dreadlight.creature .creature-attacks {
  padding: 0 16px;
}

.dreadlight.creature .creature-section-header span {
  color: #e05555;
}

.dreadlight.creature .attack-card {
  background: #111118;
  border: 1px solid #2a2a35;
  border-radius: 4px;
  padding: 12px;
  margin-bottom: 8px;
}

.dreadlight.creature .attack-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 8px;
}

.dreadlight.creature .attack-name-input {
  background: transparent;
  border: none;
  color: #ddd;
  font-size: 14px;
  font-family: inherit;
  flex: 1;
  padding: 0;
}

.dreadlight.creature .attack-stats {
  display: flex;
  gap: 12px;
  flex-wrap: wrap;
  margin-bottom: 8px;
}

.dreadlight.creature .attack-stat {
  display: flex;
  align-items: center;
  gap: 4px;
}

.dreadlight.creature .attack-stat-label {
  color: #555;
  font-size: 10px;
  letter-spacing: 0.5px;
}

.dreadlight.creature .attack-stat-value {
  color: #c9a96e;
  font-size: 14px;
}

.dreadlight.creature .attack-attr-select {
  background: #1a1a24;
  border: 1px solid #333;
  color: #888;
  font-size: 11px;
  padding: 1px 4px;
  border-radius: 3px;
  font-family: inherit;
}

.dreadlight.creature .attack-stat-input {
  background: #1a1a24;
  border: 1px solid #333;
  color: #c9a96e;
  font-size: 12px;
  width: 36px;
  text-align: center;
  border-radius: 3px;
  font-family: inherit;
}

.dreadlight.creature .attack-range-select {
  background: #1a1a24;
  border: 1px solid #333;
  color: #888;
  font-size: 11px;
  padding: 1px 4px;
  border-radius: 3px;
  font-family: inherit;
}

.dreadlight.creature .roll-attack-btn {
  background: #e05555;
  color: #08080c;
  border: none;
  padding: 4px 16px;
  border-radius: 3px;
  font-size: 11px;
  letter-spacing: 1px;
  cursor: pointer;
  font-family: inherit;
  font-weight: bold;
  transition: background 0.2s;
}

.dreadlight.creature .roll-attack-btn:hover {
  background: #f06666;
}

/* Creature Soul Damage */
.dreadlight.creature .creature-soul-damage {
  padding: 8px 16px;
}

.dreadlight.creature .soul-section-header span {
  color: #a88bf5;
}

.dreadlight.creature .soul-damage-row {
  display: flex;
  gap: 12px;
  align-items: center;
}

.dreadlight.creature .soul-damage-value {
  background: #1a1a24;
  border: 1px solid #a88bf5;
  color: #a88bf5;
  font-size: 20px;
  width: 48px;
  text-align: center;
  border-radius: 3px;
  padding: 4px;
  font-family: inherit;
}

.dreadlight.creature .soul-damage-desc {
  background: transparent;
  border: none;
  border-bottom: 1px solid #1a1a24;
  color: #888;
  font-size: 12px;
  font-family: inherit;
  flex: 1;
  padding: 2px 0;
}

/* Creature Abilities, Weakness, Notes */
.dreadlight.creature .creature-abilities,
.dreadlight.creature .creature-weakness,
.dreadlight.creature .creature-notes {
  padding: 8px 16px;
}

.dreadlight.creature .abilities-section-header span {
  color: #c9a96e;
}

.dreadlight.creature .weakness-section-header span {
  color: #55b87a;
}

.dreadlight.creature .abilities-editor,
.dreadlight.creature .weakness-editor,
.dreadlight.creature .notes-editor {
  min-height: 50px;
  background: #0c0c12;
  border: 1px solid #1a1a24;
  border-radius: 3px;
  padding: 8px;
}

/* Shared section header styles for NPC + Creature */
.dreadlight.npc .section-header,
.dreadlight.creature .section-header {
  display: flex;
  align-items: center;
  gap: 8px;
  margin: 8px 0 6px;
}

.dreadlight.npc .section-header span,
.dreadlight.creature .section-header span {
  color: #555;
  font-size: 10px;
  letter-spacing: 1px;
  white-space: nowrap;
}

.dreadlight.npc .section-line,
.dreadlight.creature .section-line {
  flex: 1;
  height: 1px;
  background: #1a1a24;
}
```

- [ ] **Step 3: Commit**

```bash
git add styles/dreadlight.css
git commit -m "feat(npc): add NPC and creature sheet styles"
```

---

### Task 11: Smoke Test in FoundryVTT

This task verifies everything works end-to-end in the running FoundryVTT instance.

- [ ] **Step 1: Reload FoundryVTT** (F5 in the browser tab)

- [ ] **Step 2: Create an NPC actor**

1. Go to the Actors tab in the sidebar
2. Click "Create Actor"
3. Select type "NPC"
4. Verify the sheet opens showing Minor tier (notecard layout: portrait, name, tier dropdown, notes)

- [ ] **Step 3: Test NPC tier switching**

1. Change tier to "Important" — verify key attributes, key talents, body/mind tracks, and gear sections appear
2. Add a key attribute (click "Add Attribute") — verify it appears with a dropdown and value input
3. Change tier to "Major" — verify full six attributes, three tracks, and item sections appear
4. Change tier back to "Minor" — verify sheet collapses to notecard

- [ ] **Step 4: Create a Creature actor**

1. Click "Create Actor", select type "Creature"
2. Verify the sheet opens with: header (red accent), attributes section, body + armor, attacks, soul damage, abilities, weakness, notes

- [ ] **Step 5: Test creature attacks**

1. Add an attribute (click the + button in attributes section)
2. Add an attack (click "Add Attack")
3. Set the attack's attribute to match one you defined
4. Click the ROLL button — verify a roll is made and a chat card appears
5. Add a second attack — verify it appears below the first
6. Remove an attack — verify it disappears

- [ ] **Step 6: Test creature body track**

1. Left-click the body track — verify value increments
2. Right-click the body track — verify value decrements

- [ ] **Step 7: Commit any fixes**

If any issues were found and fixed during smoke testing, commit the fixes:

```bash
git add -A
git commit -m "fix(npc): address issues found during smoke testing"
```

---

## Summary

| Task | Description | Files |
|---|---|---|
| 1 | Add localization keys | `lang/en.json` |
| 2 | Register actor types in system.json | `system.json` |
| 3 | Create NPC data model | `module/data/npc.mjs` |
| 4 | Create Creature data model | `module/data/creature.mjs` |
| 5 | Wire into entry point | `dreadlight.mjs` |
| 6 | Create NPC templates | `templates/actors/npc-sheet.hbs`, partials |
| 7 | Create NPC sheet class | `module/sheets/npc-sheet.mjs` |
| 8 | Create Creature templates | `templates/actors/creature-sheet.hbs`, partials |
| 9 | Create Creature sheet class | `module/sheets/creature-sheet.mjs` |
| 10 | Add NPC + Creature styles | `styles/dreadlight.css` |
| 11 | Smoke test in FoundryVTT | Manual verification |
