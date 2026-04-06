export class TalentSheet extends ItemSheet {
  static get defaultOptions() {
    return foundry.utils.mergeObject(super.defaultOptions, {
      classes: ["dreadlight", "sheet", "item", "talent"],
      template: "systems/dreadlight/templates/items/talent-sheet.hbs",
      width: 380,
      height: 520,
    });
  }

  async getData(options = {}) {
    const context = await super.getData(options);
    context.system = this.item.system;
    context.editable = this.isEditable;
    return context;
  }
}
