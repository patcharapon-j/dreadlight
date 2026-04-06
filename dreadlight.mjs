// Dreadlight — FoundryVTT v13 System
import { InvestigatorData } from "./module/data/investigator.mjs";
import { TalentData } from "./module/data/talent.mjs";
import { WeaponData } from "./module/data/weapon.mjs";
import { ArmorData } from "./module/data/armor.mjs";
import { EquipmentData } from "./module/data/equipment.mjs";
import { InvestigatorSheet } from "./module/sheets/investigator-sheet.mjs";
import { TalentSheet } from "./module/sheets/talent-sheet.mjs";
import { WeaponSheet, ArmorSheet, EquipmentSheet } from "./module/sheets/item-sheet.mjs";
import { registerDSN } from "./module/dice/dsn-integration.mjs";
import { registerChatListeners } from "./module/dice/chat-message.mjs";
import { registerHandlebarsHelpers } from "./module/helpers/handlebars.mjs";

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
    dreadTable: [0, 0, 1, 1, 2, 2, 3, 3, 4, 4, 5],
    difficulties: {
      effortless: 3, routine: 2, easy: 1, normal: 0,
      demanding: -1, hard: -2, insane: -3,
    },
  };

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
    "systems/dreadlight/templates/actors/parts/spiral.hbs",
    "systems/dreadlight/templates/actors/parts/tab-talents.hbs",
    "systems/dreadlight/templates/actors/parts/tab-equipment.hbs",
    "systems/dreadlight/templates/actors/parts/tab-details.hbs",
    "systems/dreadlight/templates/chat/roll-result.hbs",
    "systems/dreadlight/templates/chat/armor-result.hbs",
    "systems/dreadlight/templates/dialogs/roll-dialog.hbs",
  ]);

  // Register Handlebars helpers
  registerHandlebarsHelpers();

  // Register chat card listeners
  registerChatListeners();

  console.log("Dreadlight | System initialized");
});

Hooks.once("diceSoNiceReady", (dice3d) => { registerDSN(dice3d); });
