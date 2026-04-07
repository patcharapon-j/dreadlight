/**
 * Register Dreadlight dice colorsets and presets with Dice So Nice.
 * Called from diceSoNiceReady hook in dreadlight.mjs.
 *
 * Each pool type (base / dread / gear) has its own Die denomination
 * (db, dr, dg) so DSN can apply distinct colorsets and face labels
 * without overriding the standard d6.
 *
 * Icon assets live in per-type subdirectories so each die can have
 * unique art:
 *   assets/dice/base/   — base die icons
 *   assets/dice/dread/  — dread die icons
 *   assets/dice/gear/   — gear die icons
 * To customize a die type's icons, replace the PNGs in its folder.
 */
export function registerDSN(dice3d) {
  const DICE_PATH = "systems/dreadlight/assets/dice";
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

  // ── Per-denomination face icons ────────────────────────────────────
  // Each die type has its own icon set so artists can give them
  // distinct motifs (e.g. cog for gear success, cracked eye for dread bane).
  // Face 1 = bane, Face 6 = success, Faces 2-5 = blank (texture only).

  function faceConfig(subdir) {
    const p = `${DICE_PATH}/${subdir}`;
    return {
      labels: [`${p}/bane.png`, "", "", "", "", `${p}/success.png`],
      bumpMaps: [`${p}/bane-bump.png`, "", "", "", "", `${p}/success-bump.png`],
      emissiveMaps: [`${p}/bane-emissive.png`, "", "", "", "", `${p}/success-emissive.png`],
    };
  }

  // ── Per-denomination presets ────────────────────────────────────────

  // Base die (db) — pale blue moonlight glow
  dice3d.addDicePreset({
    type: "db",
    ...faceConfig("base"),
    emissive: 0x88ccff,
    emissiveIntensity: 0.35,
    colorset: "dreadlight-base",
    system: "dreadlight",
  });

  // Dread die (dr) — sinister red glow
  dice3d.addDicePreset({
    type: "dr",
    ...faceConfig("dread"),
    emissive: 0xff2020,
    emissiveIntensity: 0.5,
    colorset: "dreadlight-dread",
    system: "dreadlight",
  });

  // Gear die (dg) — warm amber glow
  dice3d.addDicePreset({
    type: "dg",
    ...faceConfig("gear"),
    emissive: 0xffcc44,
    emissiveIntensity: 0.35,
    colorset: "dreadlight-gear",
    system: "dreadlight",
  });

  console.log("Dreadlight | Dice So Nice presets registered (db, dr, dg)");
}
