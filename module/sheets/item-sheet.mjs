export class DreadlightItemSheet extends ItemSheet {
  static get defaultOptions() {
    return foundry.utils.mergeObject(super.defaultOptions, {
      classes: ["dreadlight", "sheet", "item"],
      width: 380,
      height: 480,
    });
  }

  get template() {
    return `systems/dreadlight/templates/items/${this.item.type}-sheet.hbs`;
  }

  async getData(options = {}) {
    const context = await super.getData(options);
    context.system = this.item.system;
    context.editable = this.isEditable;
    context.isWeapon = this.item.type === "weapon";
    context.isArmor = this.item.type === "armor";
    context.isEquipment = this.item.type === "equipment";
    return context;
  }
}
