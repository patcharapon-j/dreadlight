export class TalentSheet extends ItemSheet {
  static get defaultOptions() {
    return foundry.utils.mergeObject(super.defaultOptions, {
      classes: ["dreadlight", "sheet", "item", "talent"],
      template: "systems/dreadlight/templates/items/talent-sheet.hbs",
      width: 400, height: 500,
    });
  }
}
