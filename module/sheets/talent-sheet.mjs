const { HandlebarsApplicationMixin } = foundry.applications.api;
const { ItemSheetV2 } = foundry.applications.sheets;

export class TalentSheet extends HandlebarsApplicationMixin(ItemSheetV2) {

  static DEFAULT_OPTIONS = {
    classes: ["dreadlight", "sheet", "item", "talent"],
    position: { width: 380, height: 520 },
    window: {
      resizable: true,
    },
    form: {
      submitOnChange: true,
    },
    actions: {
      "set-level": TalentSheet.#setLevel,
    },
  };

  static #setLevel(event, target) {
    const level = parseInt(target.dataset.level, 10);
    if (!isNaN(level)) this.item.update({ "system.level": level });
  }

  static PARTS = {
    sheet: { template: "systems/dreadlight/templates/items/talent-sheet.hbs" },
  };

  /** @override */
  async _prepareContext(options) {
    const context = await super._prepareContext(options);
    context.item = this.item;
    context.system = this.item.system;
    context.editable = this.isEditable;
    return context;
  }
}
