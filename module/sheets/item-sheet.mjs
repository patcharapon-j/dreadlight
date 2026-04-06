export class DreadlightItemSheet extends ItemSheet {
  static get defaultOptions() {
    return foundry.utils.mergeObject(super.defaultOptions, {
      classes: ["dreadlight", "sheet", "item"],
      width: 400, height: 450,
    });
  }
  get template() {
    return `systems/dreadlight/templates/items/${this.item.type}-sheet.hbs`;
  }
}
