/**
 * Register Dreadlight dice colorsets and presets with Dice So Nice.
 * Called from diceSoNiceReady hook in dreadlight.mjs.
 */
export function registerDSN(dice3d) {
  const ICON_PATH = "systems/dreadlight/assets/dice";
  const FONT = "Monaspace Krypton";

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

  // Dread dice — deep red
  dice3d.addColorset({
    name: "dreadlight-dread",
    description: "Dreadlight Dread",
    category: "Dreadlight",
    foreground: "#ffffff",
    background: "#8b2020",
    outline: "#4a1010",
    edge: "#c93030",
    material: "metal",
    texture: "metal",
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

  // Register system BEFORE presets — DSN needs the system to exist first
  dice3d.addSystem({ id: "dreadlight", name: "Dreadlight" }, "preferred");

  // Custom d6 preset — face 1 = thorny vine (bane), face 6 = fireflake (success)
  // Icons use white fill + dark outline so they're visible on all die colors
  // bumpMaps use pre-generated inverted icons (black on white) for indented/engraved effect
  dice3d.addDicePreset({
    type: "d6",
    labels: [`${ICON_PATH}/bane.png`, "", "", "", "", `${ICON_PATH}/success.png`],
    bumpMaps: [`${ICON_PATH}/bane-bump.png`, "", "", "", "", `${ICON_PATH}/success-bump.png`],
    emissiveMaps: [`${ICON_PATH}/bane.png`, "", "", "", "", `${ICON_PATH}/success.png`],
    emissive: 0xffffff,
    emissiveIntensity: 0.3,
    system: "dreadlight",
  });

  console.log("Dreadlight | Dice So Nice colorsets & presets registered");
}
