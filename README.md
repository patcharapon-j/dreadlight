# Dreadlight

A horror investigation RPG system for [FoundryVTT](https://foundryvtt.com/) v13, built on a modified Year Zero Engine. Corruption lives in your dice.

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
- **Card Initiative**: Draw cards 1-10 each round; lowest card acts first, with Ferocity, card flipping, swaps, and a top-screen tracker HUD
- **Conditions**: Six conditions tied to attributes that reduce your dice pools
- **Dice So Nice Integration**: Custom colorsets for Base, Dread, and Gear dice

## Compatibility

- **FoundryVTT**: v13 (minimum and verified)
- **Status**: v0.3.2 (pre-release)

## License

All rights reserved.
