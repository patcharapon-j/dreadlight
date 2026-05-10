/**
 * Register all system settings for the Dreadlight system.
 * All settings are world-scoped (GM-only) to allow campaign customization.
 */
export function registerSettings() {

  game.settings.register("dreadlight", "conditionPenalty", {
    name: "DREADLIGHT.SettingConditionPenalty",
    hint: "DREADLIGHT.SettingConditionPenaltyHint",
    scope: "world",
    config: true,
    type: Number,
    default: 2,
    range: { min: 0, max: 6, step: 1 },
  });

  game.settings.register("dreadlight", "dreadMax", {
    name: "DREADLIGHT.SettingDreadMax",
    hint: "DREADLIGHT.SettingDreadMaxHint",
    scope: "world",
    config: true,
    type: Number,
    default: 5,
    range: { min: 1, max: 10, step: 1 },
  });

  game.settings.register("dreadlight", "supplyWeight", {
    name: "DREADLIGHT.SettingSupplyWeight",
    hint: "DREADLIGHT.SettingSupplyWeightHint",
    scope: "world",
    config: true,
    type: Number,
    default: 0.25,
    range: { min: 0, max: 2, step: 0.25 },
  });

  game.settings.register("dreadlight", "carryBonus", {
    name: "DREADLIGHT.SettingCarryBonus",
    hint: "DREADLIGHT.SettingCarryBonusHint",
    scope: "world",
    config: true,
    type: Number,
    default: 4,
    range: { min: 0, max: 10, step: 1 },
  });

  game.settings.register("dreadlight", "autoD66Prompt", {
    name: "DREADLIGHT.SettingAutoD66Prompt",
    hint: "DREADLIGHT.SettingAutoD66PromptHint",
    scope: "world",
    config: true,
    type: Boolean,
    default: true,
  });

  game.settings.register("dreadlight", "adhocMaxDice", {
    name: "DREADLIGHT.SettingAdhocMaxDice",
    hint: "DREADLIGHT.SettingAdhocMaxDiceHint",
    scope: "world",
    config: true,
    type: Number,
    default: 10,
    range: { min: 5, max: 30, step: 1 },
  });

  game.settings.register("dreadlight", "autoDrawCardInitiative", {
    name: "DREADLIGHT.SettingAutoDrawCardInitiative",
    hint: "DREADLIGHT.SettingAutoDrawCardInitiativeHint",
    scope: "world",
    config: true,
    type: Boolean,
    default: true,
  });

  // --- Visual & Player-Facing Settings (client-scoped) ---

  game.settings.register("dreadlight", "fontScale", {
    name: "DREADLIGHT.SettingFontScale",
    hint: "DREADLIGHT.SettingFontScaleHint",
    scope: "client",
    config: true,
    type: Number,
    default: 1.0,
    range: { min: 0.85, max: 1.5, step: 0.05 },
    onChange: (value) => {
      applyFontScale(value);
      // Re-render any open Dreadlight sheets so initial-size logic re-applies for new opens
      // and zoom CSS picks up immediately for already-open ones.
      for (const app of foundry.applications.instances?.values?.() ?? []) {
        if (app.element?.classList?.contains?.("dreadlight")) app.render();
      }
    },
  });

  game.settings.register("dreadlight", "showDreadVeins", {
    name: "DREADLIGHT.SettingShowDreadVeins",
    hint: "DREADLIGHT.SettingShowDreadVeinsHint",
    scope: "client",
    config: true,
    type: Boolean,
    default: true,
  });

  game.settings.register("dreadlight", "showChatPortrait", {
    name: "DREADLIGHT.SettingShowChatPortrait",
    hint: "DREADLIGHT.SettingShowChatPortraitHint",
    scope: "client",
    config: true,
    type: Boolean,
    default: true,
  });

  game.settings.register("dreadlight", "showTaintedFlavorText", {
    name: "DREADLIGHT.SettingShowTaintedFlavorText",
    hint: "DREADLIGHT.SettingShowTaintedFlavorTextHint",
    scope: "world",
    config: true,
    type: Boolean,
    default: true,
  });

  console.log("Dreadlight | System settings registered");
}

/**
 * Apply the user's font scale by setting a CSS variable on :root.
 * Sheets read this via `var(--dl-font-scale, 1)` to drive a CSS `zoom` rule.
 */
export function applyFontScale(value) {
  const scale = Number.isFinite(value) ? value : 1;
  document.documentElement.style.setProperty("--dl-font-scale", String(scale));
}

/**
 * Get the current font scale, safe to call before settings init.
 */
export function getFontScale() {
  try { return game.settings.get("dreadlight", "fontScale") ?? 1; }
  catch { return 1; }
}

/**
 * Modestly scale a sheet's initial height by the user's fontScale so that
 * vertically-stacked content (lists, panels) doesn't immediately need a
 * scrollbar at higher scales. Width is unchanged because the layout uses
 * fixed-pixel column widths — scaling text via CSS variables doesn't push
 * the design wider, only taller.
 */
export function scaleSheetPosition(merged) {
  const scale = getFontScale();
  if (scale !== 1 && merged?.position) {
    if (merged.position.height) merged.position.height = Math.round(merged.position.height * scale);
  }
  return merged;
}
