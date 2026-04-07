// Dreadlight — FoundryVTT v13 System
import { InvestigatorData } from "./module/data/investigator.mjs";
import { TalentData } from "./module/data/talent.mjs";
import { WeaponData } from "./module/data/weapon.mjs";
import { ArmorData } from "./module/data/armor.mjs";
import { EquipmentData } from "./module/data/equipment.mjs";
import { InvestigatorSheet } from "./module/sheets/investigator-sheet.mjs";
import { TalentSheet } from "./module/sheets/talent-sheet.mjs";
import { WeaponSheet, ArmorSheet, EquipmentSheet } from "./module/sheets/item-sheet.mjs";
import { BaseDie, DreadDie, GearDie } from "./module/dice/terms.mjs";
import { registerDSN } from "./module/dice/dsn-integration.mjs";
import { registerChatListeners, sendD66PromptToChat } from "./module/dice/chat-message.mjs";
import { registerAdhocRoller } from "./module/dice/adhoc-roller.mjs";
import { registerHandlebarsHelpers } from "./module/helpers/handlebars.mjs";
import { registerSettings } from "./module/settings.mjs";
import { d66Tables } from "./module/data/d66-tables.mjs";

Hooks.once("init", () => {
  console.log("Dreadlight | Initializing system");

  CONFIG.DREADLIGHT = {
    attributes: ["str", "agl", "log", "per", "ins", "emp"],
    attributeLabels: {
      str: "DREADLIGHT.AttributeStr",
      agl: "DREADLIGHT.AttributeAgl",
      log: "DREADLIGHT.AttributeLog",
      per: "DREADLIGHT.AttributePer",
      ins: "DREADLIGHT.AttributeIns",
      emp: "DREADLIGHT.AttributeEmp",
    },
    conditionMap: {
      str: "exhausted",
      agl: "dazed",
      log: "confused",
      per: "distracted",
      ins: "shaken",
      emp: "disheartened",
    },
    difficulties: {
      effortless: 3, routine: 2, easy: 1, normal: 0,
      demanding: -1, hard: -2, insane: -3,
    },
  };
  CONFIG.DREADLIGHT.d66Tables = d66Tables;

  // Register custom dice terms (db = base, dd = dread, dg = gear)
  CONFIG.Dice.terms.b = BaseDie;
  CONFIG.Dice.terms.r = DreadDie;
  CONFIG.Dice.terms.g = GearDie;

  // Register Data Models
  Object.assign(CONFIG.Actor.dataModels, { investigator: InvestigatorData });
  Object.assign(CONFIG.Item.dataModels, {
    talent: TalentData, weapon: WeaponData,
    armor: ArmorData, equipment: EquipmentData,
  });

  // Register Sheet Classes
  // Note: Using deprecated globals (Actors/Items) — the v13 namespaced collections
  // don't register AppV2 sheets correctly. These globals work until v15.
  Actors.unregisterSheet("core", ActorSheet);
  Actors.registerSheet("dreadlight", InvestigatorSheet, {
    types: ["investigator"],
    makeDefault: true,
    label: "DREADLIGHT.SheetInvestigator",
  });

  Items.unregisterSheet("core", ItemSheet);
  Items.registerSheet("dreadlight", TalentSheet, {
    types: ["talent"],
    makeDefault: true,
    label: "DREADLIGHT.SheetTalent",
  });
  Items.registerSheet("dreadlight", WeaponSheet, {
    types: ["weapon"],
    makeDefault: true,
    label: "DREADLIGHT.SheetWeapon",
  });
  Items.registerSheet("dreadlight", ArmorSheet, {
    types: ["armor"],
    makeDefault: true,
    label: "DREADLIGHT.SheetArmor",
  });
  Items.registerSheet("dreadlight", EquipmentSheet, {
    types: ["equipment"],
    makeDefault: true,
    label: "DREADLIGHT.SheetEquipment",
  });

  // Preload Handlebars partials
  foundry.applications.handlebars.loadTemplates([
    "systems/dreadlight/templates/actors/parts/header.hbs",
    "systems/dreadlight/templates/actors/parts/tracks.hbs",
    "systems/dreadlight/templates/actors/parts/attributes.hbs",
    "systems/dreadlight/templates/actors/parts/tab-talents.hbs",
    "systems/dreadlight/templates/actors/parts/tab-equipment.hbs",
    "systems/dreadlight/templates/actors/parts/tab-details.hbs",
    "systems/dreadlight/templates/actors/parts/injuries.hbs",
    "systems/dreadlight/templates/chat/roll-result.hbs",
    "systems/dreadlight/templates/chat/armor-result.hbs",
    "systems/dreadlight/templates/dialogs/roll-dialog.hbs",
    "systems/dreadlight/templates/chat/adhoc-roll-result.hbs",
    "systems/dreadlight/templates/chat/d66-result.hbs",
    "systems/dreadlight/templates/chat/d66-prompt.hbs",
  ]);

  // Register system settings
  registerSettings();

  // Register Handlebars helpers
  registerHandlebarsHelpers();

  // Register chat card listeners
  registerChatListeners();

  // Register ad-hoc roller above chat input
  registerAdhocRoller();

  console.log("Dreadlight | System initialized");
});

Hooks.once("diceSoNiceReady", (dice3d) => { registerDSN(dice3d); });

Hooks.on("updateActor", (actor, changes, options, userId) => {
  // Only run for the user who made the change
  if (userId !== game.user.id) return;
  if (actor.type !== "investigator") return;

  if (!game.settings.get("dreadlight", "autoD66Prompt")) return;

  for (const trackKey of ["body", "mind", "soul"]) {
    const newVal = foundry.utils.getProperty(changes, `system.tracks.${trackKey}.value`);
    if (newVal !== 0) continue;
    sendD66PromptToChat(actor, trackKey);
  }
});
