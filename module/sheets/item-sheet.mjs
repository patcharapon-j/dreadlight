const { HandlebarsApplicationMixin } = foundry.applications.api;
const { ItemSheetV2 } = foundry.applications.sheets;

export class DreadlightItemSheet extends HandlebarsApplicationMixin(ItemSheetV2) {

  static DEFAULT_OPTIONS = {
    classes: ["dreadlight", "sheet", "item"],
    position: { width: 380, height: 480 },
    form: {
      submitOnChange: true,
    },
  };

  static PARTS = {
    sheet: { template: "systems/dreadlight/templates/items/equipment-sheet.hbs" },
  };

  /** @override */
  async _prepareContext(options) {
    // Set the template dynamically based on item type
    this.constructor.PARTS.sheet.template =
      `systems/dreadlight/templates/items/${this.document.type}-sheet.hbs`;

    const context = await super._prepareContext(options);
    context.system = this.item.system;
    context.editable = this.isEditable;
    context.isWeapon = this.item.type === "weapon";
    context.isArmor = this.item.type === "armor";
    context.isEquipment = this.item.type === "equipment";
    return context;
  }
}
