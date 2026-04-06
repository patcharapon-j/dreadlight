import { DreadlightRollDialog } from "../dice/roll-dialog.mjs";

export class InvestigatorSheet extends ActorSheet {
  static get defaultOptions() {
    return foundry.utils.mergeObject(super.defaultOptions, {
      classes: ["dreadlight", "sheet", "actor", "investigator"],
      template: "systems/dreadlight/templates/actors/investigator-sheet.hbs",
      width: 720,
      height: 820,
      tabs: [{ navSelector: ".tab-bar", contentSelector: ".tab-content", initial: "talents" }],
      dragDrop: [{ dragSelector: ".item-row", dropSelector: null }],
    });
  }

  getData() {
    const context = super.getData();
    const system = this.actor.system;

    context.system = system;
    context.config = CONFIG.DREADLIGHT;
    context.editable = this.isEditable;

    // Build attributeList from the 6 attributes
    context.attributeList = CONFIG.DREADLIGHT.attributes.map((key) => {
      const conditionKey = CONFIG.DREADLIGHT.conditionMap[key];
      return {
        key,
        value: system.attributes[key].value,
        condition: conditionKey,
        conditionActive: system.conditions[conditionKey],
      };
    });

    // Sort items
    const items = Array.from(this.actor.items);

    context.talents = items
      .filter((i) => i.type === "talent")
      .sort((a, b) => {
        const lvlDiff = (b.system.level ?? 0) - (a.system.level ?? 0);
        if (lvlDiff !== 0) return lvlDiff;
        return a.name.localeCompare(b.name);
      });

    context.weapons = items
      .filter((i) => i.type === "weapon")
      .sort((a, b) => (a.sort ?? 0) - (b.sort ?? 0));

    context.armors = items
      .filter((i) => i.type === "armor")
      .sort((a, b) => (a.sort ?? 0) - (b.sort ?? 0));

    context.equipment = items
      .filter((i) => i.type === "equipment")
      .sort((a, b) => (a.sort ?? 0) - (b.sort ?? 0));

    // Carry weight
    const gearItems = [...context.weapons, ...context.armors, ...context.equipment];
    context.carryUsed = gearItems.reduce((sum, i) => sum + (i.system.weight ?? 0), 0);
    context.carryLimit = system.carryLimit;

    // Spiral / marks
    context.totalMarks = system.spiral;

    const buildMarks = (trackKey) =>
      (system.marks[trackKey] ?? []).map((mark, index) => ({ ...mark, track: trackKey, index }));

    context.allMarks = [
      ...buildMarks("body"),
      ...buildMarks("mind"),
      ...buildMarks("soul"),
    ];

    return context;
  }

  activateListeners(html) {
    super.activateListeners(html);

    if (!this.isEditable) return;

    // Attribute roll
    html.find(".attr-cell[data-attr]").on("click", (event) => {
      const attrKey = event.currentTarget.dataset.attr;
      this._onRollAttribute(attrKey);
    });

    // Talent roll
    html.find(".talent-roll-btn").on("click", (event) => {
      const row = event.currentTarget.closest(".talent-row[data-item-id]");
      const talent = this.actor.items.get(row.dataset.itemId);
      if (talent) this._onRollTalent(talent);
    });

    // Weapon roll
    html.find(".weapon-roll-btn").on("click", (event) => {
      const row = event.currentTarget.closest(".item-row[data-item-id]");
      const weapon = this.actor.items.get(row.dataset.itemId);
      if (weapon) this._onRollWeapon(weapon);
    });

    // Attribute condition toggle
    html.find(".attr-condition").on("click", (event) => {
      const attrKey = event.currentTarget.closest("[data-attr]")?.dataset.attr
        ?? event.currentTarget.dataset.attr;
      const conditionKey = CONFIG.DREADLIGHT.conditionMap[attrKey];
      if (!conditionKey) return;
      const current = this.actor.system.conditions[conditionKey];
      this.actor.update({ [`system.conditions.${conditionKey}`]: !current });
    });

    // Track pip clicks (body/mind/soul)
    html.find(".track-pip-click").on("click", (event) => {
      const pip = event.currentTarget;
      const trackKey = pip.dataset.track;
      const pipIndex = parseInt(pip.dataset.index, 10);
      const track = this.actor.system.tracks[trackKey];
      if (!track) return;

      // If this pip is currently filled (index < value), clicking it sets value to pipIndex
      // If this pip is empty (index >= value), clicking it sets value to pipIndex + 1
      const newValue = pipIndex < track.value ? pipIndex : pipIndex + 1;
      this.actor.update({ [`system.tracks.${trackKey}.value`]: newValue });
    });

    // Supply pip clicks
    html.find(".supply-pip-click").on("click", (event) => {
      const pip = event.currentTarget;
      const pipIndex = parseInt(pip.dataset.index, 10);
      const currentValue = this.actor.system.supply.value;

      const newValue = pipIndex < currentValue ? pipIndex : pipIndex + 1;
      this.actor.update({ "system.supply.value": newValue });
    });

    // Open item sheet — gear rows
    html.find(".item-row .item-name").on("click", (event) => {
      const row = event.currentTarget.closest(".item-row[data-item-id]");
      const item = this.actor.items.get(row.dataset.itemId);
      item?.sheet.render(true);
    });

    // Open item sheet — talent rows
    html.find(".talent-row .talent-info").on("click", (event) => {
      const row = event.currentTarget.closest(".talent-row[data-item-id]");
      const item = this.actor.items.get(row.dataset.itemId);
      item?.sheet.render(true);
    });

    // Delete item
    html.find(".item-delete").on("click", (event) => {
      const row = event.currentTarget.closest("[data-item-id]");
      const item = this.actor.items.get(row.dataset.itemId);
      item?.delete();
    });

    // Connections
    html.find(".add-connection").on("click", () => {
      const connections = foundry.utils.deepClone(this.actor.system.details.connections ?? []);
      connections.push({ name: "", text: "" });
      this.actor.update({ "system.details.connections": connections });
    });

    html.find(".delete-connection").on("click", (event) => {
      const index = parseInt(event.currentTarget.dataset.index, 10);
      const connections = foundry.utils.deepClone(this.actor.system.details.connections ?? []);
      connections.splice(index, 1);
      this.actor.update({ "system.details.connections": connections });
    });

    // Marks
    html.find(".add-mark").on("click", (event) => {
      const trackKey = event.currentTarget.dataset.track;
      const marks = foundry.utils.deepClone(this.actor.system.marks[trackKey] ?? []);
      marks.push({ name: "", trigger: "", effect: "", benefit: "" });
      this.actor.update({ [`system.marks.${trackKey}`]: marks });
    });

    html.find(".delete-mark").on("click", (event) => {
      const trackKey = event.currentTarget.dataset.track;
      const index = parseInt(event.currentTarget.dataset.index, 10);
      const marks = foundry.utils.deepClone(this.actor.system.marks[trackKey] ?? []);
      marks.splice(index, 1);
      this.actor.update({ [`system.marks.${trackKey}`]: marks });
    });
  }

  _onRollAttribute(attrKey) {
    DreadlightRollDialog.create({ actor: this.actor, attribute: attrKey });
  }

  _onRollTalent(talent) {
    const attribute = talent.system.primaryAttributes?.[0] ?? "str";
    DreadlightRollDialog.create({ actor: this.actor, attribute, talent });
  }

  _onRollWeapon(weapon) {
    const attribute = weapon.system.weaponType === "ranged" ? "agl" : "str";
    DreadlightRollDialog.create({ actor: this.actor, attribute, gearItem: weapon });
  }
}
