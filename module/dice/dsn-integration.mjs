/**
 * Register Dreadlight dice colorsets and preferences with Dice So Nice.
 * Called from diceSoNiceReady hook in dreadlight.mjs.
 */
export function registerDSN(dice3d) {
  // Base dice — light/white
  dice3d.addColorset({
    name: "dreadlight-base",
    description: "Dreadlight Base",
    category: "Dreadlight",
    foreground: "#222222",
    background: "#e8e8ee",
    outline: "#ccccdd",
    edge: "#ddddea",
    material: "plastic",
  });

  // Dread dice — elegant deep crimson (oxblood, not bright red)
  dice3d.addColorset({
    name: "dreadlight-dread",
    description: "Dreadlight Dread",
    category: "Dreadlight",
    foreground: "#ffcccc",
    background: "#8b2020",
    outline: "#4a1010",
    edge: "#c93030",
    material: "plastic",
  });

  // Gear dice — gold metallic
  dice3d.addColorset({
    name: "dreadlight-gear",
    description: "Dreadlight Gear",
    category: "Dreadlight",
    foreground: "#2a2015",
    background: "#c9a96e",
    outline: "#8a7a55",
    edge: "#e8c97a",
    material: "metal",
  });

  // Register system preference
  dice3d.addSystem({ id: "dreadlight", name: "Dreadlight" }, "preferred");

  console.log("Dreadlight | Dice So Nice colorsets registered");
}
