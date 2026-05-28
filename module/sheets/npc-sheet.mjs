import { DreadlightRollDialog } from "../dice/roll-dialog.mjs";
import { DreadlightRoll } from "../dice/dreadlight-roll.mjs";
import { sendRollToChat } from "../dice/chat-message.mjs";
import { scaleSheetPosition } from "../settings.mjs";

const { HandlebarsApplicationMixin } = foundry.applications.api;
const { ActorSheetV2 } = foundry.applications.sheets;
const DragDrop = foundry.applications.ux.DragDrop.implementation;
const FilePicker = foundry.applications.apps.FilePicker.implementation;

const TIER_ITEM_TYPES = {
  minor: [],
  important: ["weapon", "equipment"],
  major: ["talent", "weapon", "armor", "equipment"],
};

export class NpcSheet extends HandlebarsApplicationMixin(ActorSheetV2) {

  static DEFAULT_OPTIONS = {
    classes: ["dreadlight", "sheet", "actor", "npc"],
    position: { width: 560, height: 560 },
    window: { resizable: true },
    actions: {
      editPortrait: NpcSheet.#editPortrait,
      rollAttribute: NpcSheet.#rollAttribute,
      rollKeyAttribute: NpcSheet.#rollKeyAttribute,
      rollKeyTalent: NpcSheet.#rollKeyTalent,
      addKeyAttribute: NpcSheet.#addKeyAttribute,
      removeKeyAttribute: NpcSheet.#removeKeyAttribute,
      addKeyTalent: NpcSheet.#addKeyTalent,
      removeKeyTalent: NpcSheet.#removeKeyTalent,
      openItem: NpcSheet.#openItem,
      deleteItem: NpcSheet.#deleteItem,
      rollWeapon: NpcSheet.#rollWeapon,
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

  /** Filter inbound item drops by what the current tier supports. */
  async _onDropItem(event, data) {
    const item = await Item.implementation.fromDropData(data);
    if (!item) return false;
    const tier = this.actor.system.tier;
    const allowed = TIER_ITEM_TYPES[tier] ?? [];
    if (!allowed.includes(item.type)) {
      const typeLabel = game.i18n.localize(`TYPES.Item.${item.type}`) || item.type;
      const tierLabel = game.i18n.localize(CONFIG.DREADLIGHT.npcTiers[tier] ?? tier);
      ui.notifications.warn(game.i18n.format("DREADLIGHT.NpcItemTypeRejected", {
        type: typeLabel,
        tier: tierLabel,
      }));
      return false;
    }
    // Hand off to the parent — it owns the actual create flow (including embedded vs world items).
    return super._onDropItem(event, data);
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

    context.tierOptions = Object.entries(CONFIG.DREADLIGHT.npcTiers).map(([value, label]) => ({
      value, label, selected: value === system.tier,
    }));

    context.attrOptions = CONFIG.DREADLIGHT.attributes.map(key => ({
      value: key,
      label: game.i18n.localize(CONFIG.DREADLIGHT.attributeLabels[key]),
    }));

    context.keyAttributes = system.keyAttributes ?? [];
    context.keyTalents = system.keyTalents ?? [];
    context.canAddKeyAttribute = (system.keyAttributes?.length ?? 0) < 3;
    context.canAddKeyTalent = (system.keyTalents?.length ?? 0) < 2;

    if (system.tier === "major") {
      context.attributeList = CONFIG.DREADLIGHT.attributes.map(key => ({
        key,
        value: system.attributes[key].value,
      }));
    }

    const items = Array.from(this.actor.items);
    const allowedTypes = TIER_ITEM_TYPES[system.tier] ?? [];

    if (allowedTypes.includes("talent")) {
      context.talents = items.filter(i => i.type === "talent").sort((a, b) => a.name.localeCompare(b.name));
    }
    if (allowedTypes.includes("weapon")) {
      context.weapons = items.filter(i => i.type === "weapon").sort((a, b) => (a.sort ?? 0) - (b.sort ?? 0));
    }
    if (allowedTypes.includes("armor")) {
      context.armors = items.filter(i => i.type === "armor").sort((a, b) => (a.sort ?? 0) - (b.sort ?? 0));
    }
    if (allowedTypes.includes("equipment")) {
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

    const tier = this.actor.system.tier;

    // Track buttons: left-click +1, right-click -1
    if (tier === "important" || tier === "major") {
      this.#bindTrackButton("body");
      this.#bindTrackButton("mind");
    }
    if (tier === "major") {
      this.#bindTrackButton("soul");
    }

    // Item rows — right-click context menu (edit / delete)
    this.element.querySelectorAll(".item-row[data-item-id]").forEach((row) => {
      row.addEventListener("contextmenu", (ev) => {
        ev.preventDefault();
        const item = this.actor.items.get(row.dataset.itemId);
        if (!item) return;
        this.#showItemContextMenu(ev, item);
      });
    });
  }

  #bindTrackButton(trackKey) {
    const btn = this.element.querySelector(`.track-btn.${trackKey}`);
    if (!btn) return;
    btn.addEventListener("click", () => {
      const track = this.actor.system[trackKey];
      if (track.value < track.max) this.actor.update({ [`system.${trackKey}.value`]: track.value + 1 });
    });
    btn.addEventListener("contextmenu", (ev) => {
      ev.preventDefault();
      const track = this.actor.system[trackKey];
      if (track.value > 0) this.actor.update({ [`system.${trackKey}.value`]: track.value - 1 });
    });
  }

  #showItemContextMenu(ev, item) {
    document.querySelector(".dl-context-menu")?.remove();
    const menu = document.createElement("nav");
    menu.classList.add("dl-context-menu");
    menu.innerHTML = `
      <ul>
        <li data-action="ctx-edit"><i class="fa-solid fa-pen-to-square"></i> ${game.i18n.localize("DREADLIGHT.Edit")}</li>
        <li data-action="ctx-delete"><i class="fa-solid fa-trash"></i> ${game.i18n.localize("DREADLIGHT.Delete")}</li>
      </ul>
    `;
    menu.style.left = `${ev.clientX}px`;
    menu.style.top = `${ev.clientY}px`;
    document.body.appendChild(menu);

    const dismiss = () => menu.remove();
    menu.querySelector("[data-action='ctx-edit']").addEventListener("click", () => { dismiss(); item.sheet?.render(true); });
    menu.querySelector("[data-action='ctx-delete']").addEventListener("click", () => { dismiss(); item.delete(); });

    const onClickAway = (e) => { if (!menu.contains(e.target)) { dismiss(); document.removeEventListener("pointerdown", onClickAway); } };
    const onEscape = (e) => { if (e.key === "Escape") { dismiss(); document.removeEventListener("keydown", onEscape); } };
    setTimeout(() => {
      document.addEventListener("pointerdown", onClickAway);
      document.addEventListener("keydown", onEscape);
    }, 0);
  }

  /* ---------------------------------------- */
  /*  Actions                                 */
  /* ---------------------------------------- */

  static #editPortrait(event, target) {
    const fp = new FilePicker({
      type: "image",
      current: this.actor.img,
      callback: (path) => this.actor.update({ img: path }),
    });
    fp.render(true);
  }

  static #rollAttribute(event, target) {
    const attr = target.closest("[data-attr]")?.dataset.attr;
    if (!attr) return;
    DreadlightRollDialog.create({ actor: this.actor, attribute: attr });
  }

  static async #rollKeyAttribute(event, target) {
    const index = parseInt(target.closest("[data-index]").dataset.index, 10);
    const entry = this.actor.system.keyAttributes[index];
    if (!entry) return;

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

  static async #rollKeyTalent(event, target) {
    const index = parseInt(target.closest("[data-index]").dataset.index, 10);
    const talent = this.actor.system.keyTalents?.[index];
    if (!talent) return;
    // Pair the talent's level with the first key attribute (or STR default) to build a small pool.
    const keyAttr = this.actor.system.keyAttributes?.[0];
    const baseAttr = keyAttr?.attr ?? "str";
    const baseValue = (keyAttr?.value ?? 3) + (talent.level ?? 0);
    const roll = new DreadlightRoll({
      baseDice: baseValue,
      dreadDice: 0,
      gearDice: 0,
      attribute: baseAttr,
      talentName: talent.name || game.i18n.localize("DREADLIGHT.KeyTalent"),
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
    const index = parseInt(target.closest("[data-index]").dataset.index, 10);
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
    const index = parseInt(target.closest("[data-index]").dataset.index, 10);
    const talents = [...(this.actor.system.keyTalents ?? [])];
    talents.splice(index, 1);
    this.actor.update({ "system.keyTalents": talents });
  }

  static #openItem(event, target) {
    const itemId = target.closest("[data-item-id]")?.dataset.itemId;
    const item = this.actor.items.get(itemId);
    item?.sheet?.render(true);
  }

  static #deleteItem(event, target) {
    event.stopPropagation();
    const itemId = target.closest("[data-item-id]")?.dataset.itemId;
    const item = this.actor.items.get(itemId);
    item?.delete();
  }

  static async #rollWeapon(event, target) {
    event.stopPropagation();
    const row = target.closest(".item-row[data-item-id]");
    const weapon = this.actor.items.get(row?.dataset.itemId);
    if (!weapon) return;

    // Pick a base attribute appropriate for the weapon.
    const attribute = weapon.system.weaponType === "ranged" ? "agl" : "str";
    if (this.actor.system.tier === "major") {
      DreadlightRollDialog.create({ actor: this.actor, attribute, gearItem: weapon });
      return;
    }

    // Important tier: simplified roll using key-attribute value if available.
    const keyEntry = (this.actor.system.keyAttributes ?? []).find(k => k.attr === attribute)
      ?? this.actor.system.keyAttributes?.[0];
    const baseDice = keyEntry?.value ?? 3;
    const roll = new DreadlightRoll({
      baseDice,
      dreadDice: 0,
      gearDice: weapon.system.gearBonus ?? 0,
      attribute: keyEntry?.attr ?? attribute,
      gearName: weapon.name,
      actor: this.actor,
      weaponDamage: weapon.system.damage ?? 0,
      weaponCritThreshold: weapon.system.critThreshold ?? 6,
    });
    await roll.evaluate();
    await roll.showDSN();
    await sendRollToChat(roll);
  }
}
