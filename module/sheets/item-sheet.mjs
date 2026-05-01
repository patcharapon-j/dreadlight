const { HandlebarsApplicationMixin } = foundry.applications.api;
const { ItemSheetV2 } = foundry.applications.sheets;

class DreadlightItemSheetBase extends HandlebarsApplicationMixin(ItemSheetV2) {

  static DEFAULT_OPTIONS = {
    classes: ["dreadlight", "sheet", "item"],
    position: { width: 380, height: 480 },
    window: {
      resizable: true,
    },
    form: {
      submitOnChange: true,
    },
  };

  /** @override */
  async _prepareContext(options) {
    const context = await super._prepareContext(options);
    context.item = this.item;
    context.system = this.item.system;
    context.editable = this.isEditable;
    context.isWeapon = this.item.type === "weapon";
    context.isArmor = this.item.type === "armor";
    context.isEquipment = this.item.type === "equipment";
    context.isBackground = this.item.type === "background";
    context.isDrive = this.item.type === "drive";
    return context;
  }
}

export class WeaponSheet extends DreadlightItemSheetBase {
  static PARTS = {
    sheet: { template: "systems/dreadlight/templates/items/weapon-sheet.hbs" },
  };
}

export class ArmorSheet extends DreadlightItemSheetBase {
  static PARTS = {
    sheet: { template: "systems/dreadlight/templates/items/armor-sheet.hbs" },
  };
}

export class EquipmentSheet extends DreadlightItemSheetBase {
  static PARTS = {
    sheet: { template: "systems/dreadlight/templates/items/equipment-sheet.hbs" },
  };
}

export class BackgroundSheet extends DreadlightItemSheetBase {
  static PARTS = {
    sheet: { template: "systems/dreadlight/templates/items/background-sheet.hbs" },
  };
}

export class DriveSheet extends DreadlightItemSheetBase {
  static PARTS = {
    sheet: { template: "systems/dreadlight/templates/items/drive-sheet.hbs" },
  };
}

// Backwards-compatible alias
export const DreadlightItemSheet = EquipmentSheet;
