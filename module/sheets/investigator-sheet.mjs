import { DreadlightRollDialog } from "../dice/roll-dialog.mjs";

const { HandlebarsApplicationMixin } = foundry.applications.api;
const { ActorSheetV2 } = foundry.applications.sheets;

export class InvestigatorSheet extends HandlebarsApplicationMixin(ActorSheetV2) {

  static DEFAULT_OPTIONS = {
    classes: ["dreadlight", "sheet", "actor", "investigator"],
    position: { width: 720, height: 820 },
    window: {
      resizable: true,
    },
    actions: {
      rollAttribute: InvestigatorSheet.#rollAttribute,
      rollTalent: InvestigatorSheet.#rollTalent,
      rollWeapon: InvestigatorSheet.#rollWeapon,
      toggleCondition: InvestigatorSheet.#toggleCondition,
      openItem: InvestigatorSheet.#openItem,
      deleteItem: InvestigatorSheet.#deleteItem,
      addConnection: InvestigatorSheet.#addConnection,
      deleteConnection: InvestigatorSheet.#deleteConnection,
      addMark: InvestigatorSheet.#addMark,
      deleteMark: InvestigatorSheet.#deleteMark,
    },
    form: {
      submitOnChange: true,
    },
    dragDrop: [{ dragSelector: ".item-row", dropSelector: null }],
  };

  static PARTS = {
    sheet: { template: "systems/dreadlight/templates/actors/investigator-sheet.hbs" },
  };

  /** @override */
  tabGroups = { primary: "talents" };

  /* ---------------------------------------- */
  /*  Drag-Drop                               */
  /* ---------------------------------------- */

  #dragDrop;

  constructor(options = {}) {
    super(options);
    this.#dragDrop = this.#createDragDropHandlers();
  }

  get dragDrop() {
    return this.#dragDrop;
  }

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

  /** @override */
  async _prepareContext(options) {
    const context = await super._prepareContext(options);
    const system = this.actor.system;

    // Explicitly provide actor and item references for templates
    context.actor = this.actor;
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

    // Tab group state
    context.tab = this.tabGroups.primary;

    return context;
  }

  /* ---------------------------------------- */
  /*  Render                                  */
  /* ---------------------------------------- */

  /** @override */
  _onRender(context, options) {
    super._onRender(context, options);

    // Bind drag-drop handlers
    this.#dragDrop.forEach((d) => d.bind(this.element));

    if (!this.isEditable) return;

    // Track pip clicks (body/mind/soul) — these use Handlebars-generated pips
    // that don't have data-action, so we bind manually.
    this.element.querySelectorAll(".track-btn.body .pip, .track-btn.mind .pip, .track-btn.soul .pip").forEach((pip) => {
      pip.style.cursor = "pointer";
      pip.addEventListener("click", (ev) => {
        const trackBtn = ev.currentTarget.closest(".track-btn");
        if (!trackBtn) return;
        let trackKey;
        if (trackBtn.classList.contains("body")) trackKey = "body";
        else if (trackBtn.classList.contains("mind")) trackKey = "mind";
        else if (trackBtn.classList.contains("soul")) trackKey = "soul";
        else return;
        const pips = Array.from(trackBtn.querySelectorAll(".pip"));
        const pipIndex = pips.indexOf(ev.currentTarget);
        if (pipIndex < 0) return;
        const track = this.actor.system.tracks[trackKey];
        if (!track) return;
        const newValue = pipIndex < track.value ? pipIndex : pipIndex + 1;
        this.actor.update({ [`system.tracks.${trackKey}.value`]: newValue });
      });
    });

    // Supply pip clicks
    this.element.querySelectorAll(".track-btn.supply .pip").forEach((pip) => {
      pip.style.cursor = "pointer";
      pip.addEventListener("click", (ev) => {
        const pips = Array.from(ev.currentTarget.closest(".track-btn.supply").querySelectorAll(".pip"));
        const pipIndex = pips.indexOf(ev.currentTarget);
        if (pipIndex < 0) return;
        const currentValue = this.actor.system.supply.value;
        const newValue = pipIndex < currentValue ? pipIndex : pipIndex + 1;
        this.actor.update({ "system.supply.value": newValue });
      });
    });

    // Tab navigation
    this.element.querySelectorAll(".tab-bar .tab").forEach((tab) => {
      tab.addEventListener("click", (ev) => {
        const tabName = ev.currentTarget.dataset.tab;
        this.tabGroups.primary = tabName;
        // Toggle active class on nav tabs
        this.element.querySelectorAll(".tab-bar .tab").forEach((t) => t.classList.toggle("active", t.dataset.tab === tabName));
        // Toggle active class on tab content
        this.element.querySelectorAll(".tab-content > .tab").forEach((t) => t.classList.toggle("active", t.dataset.tab === tabName));
      });
    });

    // Set initial active tab
    const activeTab = this.tabGroups.primary;
    this.element.querySelectorAll(".tab-bar .tab").forEach((t) => t.classList.toggle("active", t.dataset.tab === activeTab));
    this.element.querySelectorAll(".tab-content > .tab").forEach((t) => t.classList.toggle("active", t.dataset.tab === activeTab));
  }

  /* ---------------------------------------- */
  /*  Actions                                 */
  /* ---------------------------------------- */

  static #rollAttribute(event, target) {
    const attr = target.closest("[data-attr]").dataset.attr;
    DreadlightRollDialog.create({ actor: this.actor, attribute: attr });
  }

  static #rollTalent(event, target) {
    const row = target.closest(".talent-row[data-item-id]");
    const talent = this.actor.items.get(row.dataset.itemId);
    if (!talent) return;
    const attribute = talent.system.primaryAttributes?.[0] ?? "str";
    DreadlightRollDialog.create({ actor: this.actor, attribute, talent });
  }

  static #rollWeapon(event, target) {
    const row = target.closest(".item-row[data-item-id]");
    const weapon = this.actor.items.get(row.dataset.itemId);
    if (!weapon) return;
    const attribute = weapon.system.weaponType === "ranged" ? "agl" : "str";
    DreadlightRollDialog.create({ actor: this.actor, attribute, gearItem: weapon });
  }

  static #toggleCondition(event, target) {
    const attr = target.closest("[data-attr]")?.dataset.attr ?? target.dataset.attr;
    const conditionKey = CONFIG.DREADLIGHT.conditionMap[attr];
    if (!conditionKey) return;
    const current = this.actor.system.conditions[conditionKey];
    this.actor.update({ [`system.conditions.${conditionKey}`]: !current });
  }

  static #openItem(event, target) {
    const row = target.closest("[data-item-id]");
    const item = this.actor.items.get(row.dataset.itemId);
    item?.sheet.render(true);
  }

  static #deleteItem(event, target) {
    const row = target.closest("[data-item-id]");
    const item = this.actor.items.get(row.dataset.itemId);
    item?.delete();
  }

  static #addConnection(event, target) {
    const connections = foundry.utils.deepClone(this.actor.system.details.connections ?? []);
    connections.push({ name: "", text: "" });
    this.actor.update({ "system.details.connections": connections });
  }

  static #deleteConnection(event, target) {
    const index = parseInt(target.dataset.index, 10);
    const connections = foundry.utils.deepClone(this.actor.system.details.connections ?? []);
    connections.splice(index, 1);
    this.actor.update({ "system.details.connections": connections });
  }

  static #addMark(event, target) {
    const trackKey = target.dataset.track;
    const marks = foundry.utils.deepClone(this.actor.system.marks[trackKey] ?? []);
    marks.push({ name: "", trigger: "", effect: "", benefit: "" });
    this.actor.update({ [`system.marks.${trackKey}`]: marks });
  }

  static #deleteMark(event, target) {
    const trackKey = target.dataset.track;
    const index = parseInt(target.dataset.index, 10);
    const marks = foundry.utils.deepClone(this.actor.system.marks[trackKey] ?? []);
    marks.splice(index, 1);
    this.actor.update({ [`system.marks.${trackKey}`]: marks });
  }
}
