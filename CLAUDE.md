# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Dreadlight is a FoundryVTT v14 game system - a horror investigation RPG built on a modified Year Zero Engine. The system is at v0.5.0 (pre-release); it is verified for FoundryVTT v14 and keeps a minimum compatibility of v13.

## Development

There is no build system, package manager, test framework, or linter. The system runs directly in FoundryVTT — edit `.mjs`, `.hbs`, and `.css` files and reload the browser. The entry point is `dreadlight.mjs`, loaded by FoundryVTT via `system.json`.

To test changes: reload the FoundryVTT browser tab (F5) or use the "Reload System" dev tool.

## Architecture

**Entry point** (`dreadlight.mjs`): Registers all data models, sheet classes, Handlebars helpers, chat listeners, and Dice So Nice colorsets in the `init` hook.

**Data models** (`module/data/`): TypeDataModel schemas defining the structure for 3 actor types (investigator, NPC, creature) and 4 item types (talent, weapon, armor, equipment).

**Sheets** (`module/sheets/`): AppV2 sheet classes using `HandlebarsApplicationMixin`. InvestigatorSheet, NpcSheet, and CreatureSheet handle actors; TalentSheet and DreadlightItemSheet handle items. All use `submitOnChange: true`.

**Dice system** (`module/dice/`): The core game mechanic lives here.
- `dreadlight-roll.mjs` — `DreadlightRoll` class with `buildPool()` that calculates base/dread/gear dice from attributes, talents, gear, and conditions. `evaluate()` categorizes results as success/tainted success/failure, with dire failure as a failure flag.
- `roll-dialog.mjs` — AppV2 dialog for configuring rolls (difficulty, gear bonus, etc.).
- `chat-message.mjs` — Renders roll results to chat cards and handles the push mechanic (lock 6s & 1s, re-roll the rest, apply consequences).
- `dsn-integration.mjs` — Registers three Dice So Nice colorsets (base/dread/gear).
**Combat system** (`module/combat/`): Card initiative helpers and top-screen tracker HUD for the revised combat rules. Cards 1-13 are drawn each round (J=11, Q=12, K=13 — face cards extend the deck for crowded combats); the lowest card acts first. Creature Ferocity determines how many cards a creature draws, and each drawn card is represented as its own initiative slot.

**Helpers** (`module/helpers/handlebars.mjs`): 20+ custom Handlebars helpers for rendering pips, conditions, and localization.

**Templates** (`templates/`): Handlebars templates organized by type — actors (with partials), items, chat, dialogs.

**Styles** (`styles/`): Two stylesheets, loaded in order via `system.json`. `dreadlight.css` is the base design system; `etched-glass.css` is the premium "Etched Glass" overlay (frosted-glass window/HUD/chat-card material, chamfered corners, precision-rule and sheen-sweep animations, `--gl-*` design tokens). All selectors scoped under `.dreadlight` / `.dreadlight-chat` / `#dreadlight-initiative-tracker` to prevent FoundryVTT UI leaks.

## Game Mechanics to Understand

- **6 Attributes**: STR, AGL, LOG, PER, INS, EMP (rated 1–6)
- **3 Tracks**: Body (STR+AGL), Mind (LOG+EMP), Soul (INS+PER) — these are health pools
- **Dread**: 0–5, adds dread dice to every roll; acts as minimum pool size
- **Conditions**: exhausted, dazed, confused, distracted, shaken, disheartened — each tied to an attribute, reduces its dice
- **Critical Injuries**: D66 tables (Coriolis-style) for body/mind/soul — rolled when a track breaks
- **Dice outcomes**: failure (no 6s), dire failure (no 6s + dread 1s), tainted success (only dread 6s, no base/gear 6s), success (has base/gear 6s)
- **Push**: re-roll non-locked dice; 1s cause consequences (mind/soul loss, gear damage). Omen/GM dread points have been removed from the current rules.
- **Initiative**: draw cards 1-13 each round (J=11, Q=12, K=13); lowest card acts first. Creatures have Ferocity 1-3 and draw that many cards. Cards can be flipped/spent for reactions and swapped for initiative-switching effects.

## Key Conventions

- FoundryVTT v14 AppV2 sheets — not legacy Application/FormApplication
- Sheet registration uses the namespaced `foundry.documents.collections.Actors`/`Items` collections; core V1 sheets are unregistered via `foundry.appv1.sheets.ActorSheet`/`ItemSheet`
- UX helpers are accessed through their v14 namespaces: `foundry.applications.ux.DragDrop.implementation`, `foundry.applications.apps.FilePicker.implementation`, and `foundry.applications.api.DialogV2`
- All localization keys prefixed with `DREADLIGHT.` (defined in `lang/en.json`)
- CONFIG namespace is `CONFIG.DREADLIGHT` (attributes, conditions, difficulty table, dread table)
- Compendium packs stored as LevelDB in `packs/`
- No server-side code or socket communication — all logic is client-side

## External Resources

- **Documentation**: `docs/` — generated specs and implementation plans (superpowers module output)
- **Design brainstorming**: `.superpowers/brainstorm/` — HTML mockups and design iterations for UI components
- **Full game rules**: `F:\My Drive\Project Crimson Echo\Dreadlight Core Rules`
