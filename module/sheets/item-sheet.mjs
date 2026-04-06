const { HandlebarsApplicationMixin } = foundry.applications.api;
const { ItemSheetV2 } = foundry.applications.sheets;

export class DreadlightItemSheet extends HandlebarsApplicationMixin(ItemSheetV2) {

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

  static PARTS = {
    sheet: { template: "systems/dreadlight/templates/items/equipment-sheet.hbs" },
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
    return context;
  }

  /** @override - set template dynamically per item type before each render */
  _configureRenderOptions(options) {
    super._configureRenderOptions(options);
    this.constructor.PARTS.sheet.template =
      `systems/dreadlight/templates/items/${this.document.type}-sheet.hbs`;
  }
}
