/**
 * Download game-icons.net SVGs for all Dreadlight compendium items.
 * Run with: node scripts/download-icons.mjs
 *
 * Icons are CC BY 3.0 — see https://game-icons.net/about.html
 * Authors: Lorc, Delapouite, Skoll, and others.
 */

import { writeFileSync, mkdirSync, existsSync } from "fs";

const ICON_DIR = "assets/icons";
const BASE_URL = "https://game-icons.net/icons/ffffff/transparent/1x1";

// ── Icon mapping: filename → author/icon-name on game-icons.net ──────────────

const ICONS = {
  // ── Talents: Investigation ──
  "magnifying-glass.svg": "lorc/magnifying-glass",
  "book-cover.svg": "delapouite/book-cover",
  "dialogue.svg": "lorc/conversation",
  "wolf-trap.svg": "lorc/wolf-trap",
  "semi-closed-eye.svg": "lorc/semi-closed-eye",
  "walking-scout.svg": "delapouite/walking-scout",

  // ── Talents: Social ──
  "conversation.svg": "lorc/conversation",
  "domino-mask.svg": "lorc/domino-mask",
  "oppression.svg": "lorc/oppression",
  "psychic-waves.svg": "lorc/psychic-waves",
  "rally-the-troops.svg": "lorc/rally-the-troops",
  "drama-masks.svg": "lorc/drama-masks",

  // ── Talents: Combat ──
  "crossed-swords.svg": "lorc/crossed-swords",
  "archery-target.svg": "lorc/archery-target",
  "dodging.svg": "lorc/dodging",
  "chess-rook.svg": "skoll/chess-rook",
  "cloak-dagger.svg": "lorc/cloak-dagger",
  "sprint.svg": "lorc/sprint",
  "acrobatic.svg": "darkzaitzev/acrobatic",
  "lock-picking.svg": "delapouite/lock-picking",

  // ── Talents: Knowledge ──
  "pentagram-rose.svg": "lorc/pentagram-rose",
  "caduceus.svg": "delapouite/caduceus",
  "microscope.svg": "lord-berandas/microscope",
  "ancient-columns.svg": "delapouite/ancient-columns",
  "prayer.svg": "lorc/prayer",
  "processor.svg": "lorc/processor",

  // ── Talents: Resilience ──
  "meditation.svg": "lorc/meditation",
  "fist.svg": "lorc/fist",
  "tortoise.svg": "delapouite/tortoise",
  "plant-roots.svg": "delapouite/plant-roots",
  "bandage-roll.svg": "lorc/bandage-roll",
  "anvil-impact.svg": "lorc/anvil-impact",
  "campfire.svg": "lorc/campfire",

  // ── Weapons ──
  "punch.svg": "lorc/punch",
  "broken-bottle.svg": "lorc/broken-bottle",
  "bowie-knife.svg": "lorc/bowie-knife",
  "baseball-bat.svg": "delapouite/baseball-bat",
  "machete.svg": "lorc/machete",
  "battle-axe.svg": "lorc/battle-axe",
  "spear-hook.svg": "lorc/spear-hook",
  "shield.svg": "sbed/shield",
  "thrown-knife.svg": "lorc/thrown-knife",
  "thrown-spear.svg": "lorc/thrown-spear",
  "crossbow.svg": "carl-olsen/crossbow",
  "pistol-gun.svg": "john-colburn/pistol-gun",
  "revolver.svg": "skoll/revolver",
  "desert-eagle.svg": "skoll/desert-eagle",
  "winchester-rifle.svg": "skoll/winchester-rifle",
  "ak47.svg": "skoll/ak47",
  "shotgun-rounds.svg": "delapouite/shotgun-rounds",
  "ak47u.svg": "skoll/ak47u",
  "lee-enfield.svg": "skoll/lee-enfield",

  // ── Armor ──
  "leather-vest.svg": "lorc/leather-vest",
  "leather-armor.svg": "delapouite/leather-armor",
  "kevlar-vest.svg": "skoll/kevlar-vest",
  "breastplate.svg": "lorc/breastplate",
  "round-shield.svg": "willdabeast/round-shield",

  // ── Equipment ──
  "finger-print.svg": "delapouite/finger-print",
  "book-pile.svg": "delapouite/book-pile",
  "lockpicks.svg": "delapouite/lockpicks",
  "cctv-camera.svg": "delapouite/cctv-camera",
  "old-microphone.svg": "delapouite/old-microphone",
  "flashlight.svg": "delapouite/flashlight",
  "photo-camera.svg": "delapouite/photo-camera",
  "first-aid-kit.svg": "delapouite/first-aid-kit",
  "medical-pack.svg": "sbed/medical-pack",
  "bandage-roll-equip.svg": "lorc/bandage-roll",
  "pill.svg": "lorc/pill",
  "poison-bottle.svg": "lorc/poison-bottle",
  "syringe.svg": "lorc/syringe",
  "coffee-cup.svg": "delapouite/coffee-cup",
  "rope-coil.svg": "delapouite/rope-coil",
  "camping-tent.svg": "delapouite/camping-tent",
  "sliced-bread.svg": "lorc/sliced-bread",
  "water-flask.svg": "delapouite/water-flask",
  "matchbox.svg": "delapouite/matchbox",
  "compass.svg": "lorc/compass",
  "mountain-climbing.svg": "caro-asercion/mountain-climbing",
  "spell-book.svg": "delapouite/spell-book",
  "candle-light.svg": "lorc/candle-light",
  "protection-glasses.svg": "delapouite/protection-glasses",
  "treasure-map.svg": "lorc/treasure-map",
  "evil-book.svg": "lorc/evil-book",
  "knapsack.svg": "lorc/knapsack",
  "handcuffs.svg": "lorc/handcuffs",
  "winter-hat.svg": "delapouite/winter-hat",
  "swiss-army-knife.svg": "delapouite/swiss-army-knife",
  "crowbar.svg": "delapouite/crowbar",
  "disguise-kit.svg": "lorc/domino-mask",
  "binoculars.svg": "delapouite/binoculars",
  "walkie-talkie.svg": "delapouite/walkie-talkie",
};

// ── Download ─────────────────────────────────────────────────────────────────

async function main() {
  mkdirSync(ICON_DIR, { recursive: true });

  const entries = Object.entries(ICONS);
  let downloaded = 0;
  let skipped = 0;
  let failed = 0;

  for (const [filename, iconPath] of entries) {
    const outPath = `${ICON_DIR}/${filename}`;
    if (existsSync(outPath)) {
      skipped++;
      continue;
    }

    const url = `${BASE_URL}/${iconPath}.svg`;
    try {
      const res = await fetch(url);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const svg = await res.text();
      writeFileSync(outPath, svg);
      downloaded++;
      process.stdout.write(`\r  Downloaded ${downloaded}/${entries.length - skipped}...`);
    } catch (err) {
      console.error(`\n  FAILED: ${filename} (${url}) — ${err.message}`);
      failed++;
    }
  }

  console.log(`\n  Done! ${downloaded} downloaded, ${skipped} skipped, ${failed} failed.`);
}

main();
