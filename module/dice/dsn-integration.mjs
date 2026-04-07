/**
 * Register Dreadlight dice colorsets and presets with Dice So Nice.
 * Called from diceSoNiceReady hook in dreadlight.mjs.
 *
 * Each pool type (base / dread / gear) has its own Die denomination
 * (db, dd, dg) so DSN can apply distinct colorsets and face labels
 * without overriding the standard d6.
 */
export function registerDSN(dice3d) {
  const ICON_PATH = "systems/dreadlight/assets/dice";
  const FONT = "Monaspace Krypton";

  // ── Colorsets ──────────────────────────────────────────────────────

  // Base dice — black
  dice3d.addColorset({
    name: "dreadlight-base",
    description: "Dreadlight Base",
    category: "Dreadlight",
    foreground: "#ffffff",
    background: "#1a1a1a",
    outline: "#000000",
    edge: "#333333",
    material: "metal",
    texture: "metal",
    font: FONT,
  });

  // Dread dice — deep red with fiery texture
  dice3d.addColorset({
    name: "dreadlight-dread",
    description: "Dreadlight Dread",
    category: "Dreadlight",
    foreground: "#ffffff",
    background: "#8b2020",
    outline: "#4a1010",
    edge: "#c93030",
    material: "metal",
    texture: "fire",
    font: FONT,
  });

  // Gear dice — gold
  dice3d.addColorset({
    name: "dreadlight-gear",
    description: "Dreadlight Gear",
    category: "Dreadlight",
    foreground: "#ffffff",
    background: "#c9a96e",
    outline: "#8a7a55",
    edge: "#e8c97a",
    material: "metal",
    texture: "metal",
    font: FONT,
  });

  // ── System ─────────────────────────────────────────────────────────
  dice3d.addSystem({ id: "dreadlight", name: "Dreadlight" }, "preferred");

  // ── Shared face configuration ──────────────────────────────────────
  // Face 1 = thorny vine (bane), Face 6 = fireflake (success), 2-5 blank
  const labels = [`${ICON_PATH}/bane.png`, "", "", "", "", `${ICON_PATH}/success.png`];
  const bumpMaps = [`${ICON_PATH}/bane-bump.png`, "", "", "", "", `${ICON_PATH}/success-bump.png`];
  const emissiveMaps = [`${ICON_PATH}/bane.png`, "", "", "", "", `${ICON_PATH}/success.png`];

  // ── Per-denomination presets ────────────────────────────────────────
  // Each custom denomination gets its own preset + default colorset.

  // Base die (db) — pale blue moonlight glow
  dice3d.addDicePreset({
    type: "db",
    labels,
    bumpMaps,
    emissiveMaps,
    emissive: 0x88ccff,
    emissiveIntensity: 0.35,
    colorset: "dreadlight-base",
    system: "dreadlight",
  });

  // Dread die (dd) — sinister red glow
  dice3d.addDicePreset({
    type: "dd",
    labels,
    bumpMaps,
    emissiveMaps,
    emissive: 0xff2020,
    emissiveIntensity: 0.5,
    colorset: "dreadlight-dread",
    system: "dreadlight",
  });

  // Gear die (dg) — warm amber glow
  dice3d.addDicePreset({
    type: "dg",
    labels,
    bumpMaps,
    emissiveMaps,
    emissive: 0xffcc44,
    emissiveIntensity: 0.35,
    colorset: "dreadlight-gear",
    system: "dreadlight",
  });

  console.log("Dreadlight | Dice So Nice presets registered (db, dd, dg)");
}
