# Dreadlight

A horror investigation RPG system for [FoundryVTT](https://foundryvtt.com/) v14, built on a modified Year Zero Engine. Corruption lives in your dice.

## Installation

### Method 1: Manifest URL (Recommended)

1. In FoundryVTT, go to **Game Systems** > **Install System**
2. Paste the following URL into the **Manifest URL** field at the bottom:

```
https://github.com/patcharapon-j/dreadlight/releases/latest/download/system.json
```

3. Click **Install**

### Method 2: Manual Download

1. Download the latest release zip from the [Releases](https://github.com/patcharapon-j/dreadlight/releases) page
2. Extract it into your FoundryVTT `Data/systems/` directory
3. Restart FoundryVTT

## Features

- **6 Attributes**: Strength, Agility, Logic, Perception, Insight, Empathy (rated 1-6)
- **3 Tracks**: Body, Mind, Soul -- health pools derived from attribute pairs
- **Dread Mechanic**: Dread dice (0-5) corrupt every roll, adding risk alongside reward
- **Dice System**: Base, Dread, and Gear dice with distinct outcomes -- success, tainted success, dire failure
- **Push Mechanic**: Re-roll for another chance, but 1s carry consequences
- **Card Initiative**: Draw cards 1-13 (J=11, Q=12, K=13) each round; lowest card acts first, with Ferocity, card flipping, swaps, and a top-screen tracker HUD
- **Conditions**: Six conditions tied to attributes that reduce your dice pools
- **Dice So Nice Integration**: Custom colorsets for Base, Dread, and Gear dice

## Compatibility

- **FoundryVTT**: v14 (verified), v13 (minimum)
- **Status**: v0.5.0 (pre-release)

## Rules Revision Notes (v0.4.0)

Synced to the core-rules audit pass (May 2026):

- **Initiative deck extended** to 1-13 — J/Q/K added for crowded combats (§16.3).
- **Heavy Pistol** now tagged `Restricted`; Restricted is a gear property requiring license or black-market acquisition (§16.8).
- **Worn armor** is free against carry limit; carried-but-not-worn armor takes its full slot cost (§16.9). Armor sheet has a "Worn" toggle.
- **Brutal** (Close Combat L2) deals **+2** damage (was +1) (§16.6).
- **True Faith** now requires an opportunity cost — sanctified site, ≥1 stretch ritual time, or clerical authority (§16.6).
- **Procure** is capped at +2 gear, 2 SP, or 1 stretch service per use (§16.6).
- **Design-review flags** on Iron Soul, The Thread, Eureka, and Vanish — surfaced on the talent sheet (§16.7).
- NPC sheet supports Minor / Important / Major tiers (§16.11).

## License

All rights reserved.
