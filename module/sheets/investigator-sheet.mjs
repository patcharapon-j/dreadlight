export class InvestigatorSheet extends ActorSheet {
  static get defaultOptions() {
    return foundry.utils.mergeObject(super.defaultOptions, {
      classes: ["dreadlight", "sheet", "actor", "investigator"],
      template: "systems/dreadlight/templates/actors/investigator-sheet.hbs",
      width: 720, height: 800,
    });
  }
}
