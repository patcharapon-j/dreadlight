import { scaleSheetPosition } from "../settings.mjs";

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
  _initializeApplicationOptions(options) {
    return scaleSheetPosition(super._initializeApplicationOptions(options));
  }

  /** @override */
  _prepareSubmitData(event, form, formData) {
    const data = super._prepareSubmitData(event, form, formData);
    // Collect checked attribute checkboxes into an array
    const checked = form.querySelectorAll('input[name="system.primaryAttributes"]:checked');
    data["system.primaryAttributes"] = Array.from(checked).map(el => el.value);
    return data;
  }

  /** @override */
  async _prepareContext(options) {
    const context = await super._prepareContext(options);
    context.item = this.item;
    context.system = this.item.system;
    context.editable = this.isEditable;
    context.attributeChoices = CONFIG.DREADLIGHT.attributes.map(key => ({
      key,
      label: game.i18n.localize(CONFIG.DREADLIGHT.attributeLabels[key]),
      selected: this.item.system.primaryAttributes.includes(key),
    }));
    return context;
  }
}
