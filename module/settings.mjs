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

  game.settings.register("dreadlight", "failureDreadGain", {
    name: "DREADLIGHT.SettingFailureDreadGain",
    hint: "DREADLIGHT.SettingFailureDreadGainHint",
    scope: "world",
    config: true,
    type: Number,
    default: 1,
    range: { min: 0, max: 5, step: 1 },
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

  // --- Visual & Player-Facing Settings (client-scoped) ---

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
