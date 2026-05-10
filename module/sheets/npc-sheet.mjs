import { DreadlightRollDialog } from "../dice/roll-dialog.mjs";
import { scaleSheetPosition } from "../settings.mjs";

const { HandlebarsApplicationMixin } = foundry.applications.api;
const { ActorSheetV2 } = foundry.applications.sheets;

export class NpcSheet extends HandlebarsApplicationMixin(ActorSheetV2) {

  static DEFAULT_OPTIONS = {
    classes: ["dreadlight", "sheet", "actor", "npc"],
    position: { width: 560, height: 500 },
    window: { resizable: true },
    actions: {
      changeTier: NpcSheet.#changeTier,
      editPortrait: NpcSheet.#editPortrait,
      rollAttribute: NpcSheet.#rollAttribute,
      rollKeyAttribute: NpcSheet.#rollKeyAttribute,
      addKeyAttribute: NpcSheet.#addKeyAttribute,
      removeKeyAttribute: NpcSheet.#removeKeyAttribute,
      addKeyTalent: NpcSheet.#addKeyTalent,
      removeKeyTalent: NpcSheet.#removeKeyTalent,
      openItem: NpcSheet.#openItem,
      deleteItem: NpcSheet.#deleteItem,
    },
    form: { submitOnChange: true },
    dragDrop: [{ dragSelector: ".item-row", dropSelector: null }],
  };

  static PARTS = {
    sheet: { template: "systems/dreadlight/templates/actors/npc-sheet.hbs" },
  };

  /* ---------------------------------------- */
  /*  Drag-Drop                               */
  /* ---------------------------------------- */

  #dragDrop;

  /** @override */
  _initializeApplicationOptions(options) {
    return scaleSheetPosition(super._initializeApplicationOptions(options));
  }

  constructor(options = {}) {
    super(options);
    this.#dragDrop = this.#createDragDropHandlers();
  }

  get dragDrop() { return this.#dragDrop; }

  #createDragDropHandlers() {
    return this.options.dragDrop.map((d) => {
      d.permissions = {
        dragstart: this._canDragStart.bind(this),
        drop: this._canDragDrop.bind(this),
      };
      d.callbacks = {
        dragstart: this._onDragStart.bind(this),
        dragover: this._onDragOver.bind(this),
        drop: this._onDrop.bind(this),
      };
      return new DragDrop(d);
    });
  }

  /* ---------------------------------------- */
  /*  Context                                 */
  /* ---------------------------------------- */

  async _prepareContext(options) {
    const context = await super._prepareContext(options);
    const system = this.actor.system;

    context.actor = this.actor;
    context.system = system;
    context.config = CONFIG.DREADLIGHT;
    context.editable = this.isEditable;

    // Tier options for the dropdown
    context.tierOptions = Object.entries(CONFIG.DREADLIGHT.npcTiers).map(([value, label]) => ({
      value, label, selected: value === system.tier,
    }));

    // Attribute options for key attribute selects
    context.attrOptions = CONFIG.DREADLIGHT.attributes.map(key => ({
      value: key,
      label: game.i18n.localize(CONFIG.DREADLIGHT.attributeLabels[key]),
    }));

    // Key attributes/talents (Important tier)
    context.keyAttributes = system.keyAttributes ?? [];
    context.keyTalents = system.keyTalents ?? [];
    context.canAddKeyAttribute = (system.keyAttributes?.length ?? 0) < 3;
    context.canAddKeyTalent = (system.keyTalents?.length ?? 0) < 2;

    // Full attribute list (Major tier)
    if (system.tier === "major") {
      context.attributeList = CONFIG.DREADLIGHT.attributes.map(key => ({
        key,
        value: system.attributes[key].value,
      }));
    }

    // Items — filter by tier permissions
    const items = Array.from(this.actor.items);
    if (system.tier === "major") {
      context.talents = items.filter(i => i.type === "talent").sort((a, b) => a.name.localeCompare(b.name));
      context.weapons = items.filter(i => i.type === "weapon").sort((a, b) => (a.sort ?? 0) - (b.sort ?? 0));
      context.armors = items.filter(i => i.type === "armor").sort((a, b) => (a.sort ?? 0) - (b.sort ?? 0));
      context.equipment = items.filter(i => i.type === "equipment").sort((a, b) => (a.sort ?? 0) - (b.sort ?? 0));
    } else if (system.tier === "important") {
      context.weapons = items.filter(i => i.type === "weapon").sort((a, b) => (a.sort ?? 0) - (b.sort ?? 0));
      context.equipment = items.filter(i => i.type === "equipment").sort((a, b) => (a.sort ?? 0) - (b.sort ?? 0));
    }

    return context;
  }

  /* ---------------------------------------- */
  /*  Render                                  */
  /* ---------------------------------------- */

  _onRender(context, options) {
    super._onRender(context, options);
    this.#dragDrop.forEach(d => d.bind(this.element));

    if (!this.isEditable) return;

    const system = this.actor.system;

    // Track buttons: left-click +1, right-click -1 (Important + Major)
    if (system.tier === "important" || system.tier === "major") {
      for (const trackKey of ["body", "mind"]) {
        const btn = this.element.querySelector(`.track-btn.${trackKey}`);
        if (!btn) continue;
        btn.addEventListener("click", () => {
          const track = system[trackKey];
          if (track.value < track.max) this.actor.update({ [`system.${trackKey}.value`]: track.value + 1 });
        });
        btn.addEventListener("contextmenu", (ev) => {
          ev.preventDefault();
          const track = system[trackKey];
          if (track.value > 0) this.actor.update({ [`system.${trackKey}.value`]: track.value - 1 });
        });
      }
    }

    // Soul track (Major only)
    if (system.tier === "major") {
      const soulBtn = this.element.querySelector(".track-btn.soul");
      if (soulBtn) {
        soulBtn.addEventListener("click", () => {
          const track = system.soul;
          if (track.value < track.max) this.actor.update({ "system.soul.value": track.value + 1 });
        });
        soulBtn.addEventListener("contextmenu", (ev) => {
          ev.preventDefault();
          const track = system.soul;
          if (track.value > 0) this.actor.update({ "system.soul.value": track.value - 1 });
        });
      }
    }
  }

  /* ---------------------------------------- */
  /*  Actions                                 */
  /* ---------------------------------------- */

  static #changeTier(event, target) {
    // Handled by submitOnChange — select has name="system.tier"
  }

  static #editPortrait(event, target) {
    const fp = new FilePicker({
      type: "image",
      current: this.actor.img,
      callback: (path) => this.actor.update({ img: path }),
    });
    fp.render(true);
  }

  static #rollAttribute(event, target) {
    const attr = target.closest("[data-attr]").dataset.attr;
    new DreadlightRollDialog({ actor: this.actor, attribute: attr }).render(true);
  }

  static async #rollKeyAttribute(event, target) {
    const index = parseInt(target.closest("[data-index]").dataset.index);
    const entry = this.actor.system.keyAttributes[index];
    if (!entry) return;

    const { DreadlightRoll } = await import("../dice/dreadlight-roll.mjs");
    const { sendRollToChat } = await import("../dice/chat-message.mjs");
    const roll = new DreadlightRoll({
      baseDice: entry.value,
      dreadDice: 0,
      gearDice: 0,
      attribute: entry.attr,
      actor: this.actor,
    });
    await roll.evaluate();
    await roll.showDSN();
    await sendRollToChat(roll);
  }

  static #addKeyAttribute(event, target) {
    const attrs = this.actor.system.keyAttributes ?? [];
    if (attrs.length >= 3) return;
    this.actor.update({ "system.keyAttributes": [...attrs, { attr: "str", value: 3 }] });
  }

  static #removeKeyAttribute(event, target) {
    const index = parseInt(target.closest("[data-index]").dataset.index);
    const attrs = [...(this.actor.system.keyAttributes ?? [])];
    attrs.splice(index, 1);
    this.actor.update({ "system.keyAttributes": attrs });
  }

  static #addKeyTalent(event, target) {
    const talents = this.actor.system.keyTalents ?? [];
    if (talents.length >= 2) return;
    this.actor.update({ "system.keyTalents": [...talents, { name: "", level: 1 }] });
  }

  static #removeKeyTalent(event, target) {
    const index = parseInt(target.closest("[data-index]").dataset.index);
    const talents = [...(this.actor.system.keyTalents ?? [])];
    talents.splice(index, 1);
    this.actor.update({ "system.keyTalents": talents });
  }

  static #openItem(event, target) {
    const itemId = target.closest("[data-item-id]").dataset.itemId;
    const item = this.actor.items.get(itemId);
    item?.sheet?.render(true);
  }

  static #deleteItem(event, target) {
    const itemId = target.closest("[data-item-id]").dataset.itemId;
    const item = this.actor.items.get(itemId);
    item?.delete();
  }
}
