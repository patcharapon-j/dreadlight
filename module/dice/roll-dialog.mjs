import { DreadlightRoll, buildPool } from "./dreadlight-roll.mjs";
import { sendRollToChat } from "./chat-message.mjs";

const { HandlebarsApplicationMixin, ApplicationV2 } = foundry.applications.api;

/**
 * Dreadlight Roll Dialog — AppV2 implementation.
 * v3 design: source rows with pips, unified pool bar with dread biting into base,
 * bracket labels, mark invocation, and live pool updates.
 */
export class DreadlightRollDialog extends HandlebarsApplicationMixin(ApplicationV2) {

  static DEFAULT_OPTIONS = {
    id: "dreadlight-roll-dialog-{id}",
    classes: ["dreadlight", "roll-dialog"],
    position: { width: 340 },
    window: {
      title: "DREADLIGHT.RollTitle",
      minimizable: false,
    },
    actions: {
      roll: DreadlightRollDialog.#onRoll,
    },
  };

  static PARTS = {
    form: { template: "systems/dreadlight/templates/dialogs/roll-dialog.hbs" },
  };

  /** @type {Actor} */
  #actor;
  /** @type {string} */
  #attribute;
  /** @type {Item|null} */
  #talent;
  /** @type {Item|null} */
  #gearItem;
  /** @type {Function|null} */
  #resolve;

  constructor({ actor, attribute, talent = null, gearItem = null, resolve = null }, options = {}) {
    super(options);
    this.#actor = actor;
    this.#attribute = attribute;
    this.#talent = talent;
    this.#gearItem = gearItem;
    this.#resolve = resolve;
  }

  /** @override */
  get title() {
    const attrLabel = game.i18n.localize(CONFIG.DREADLIGHT.attributeLabels[this.#attribute]);
    return `${game.i18n.localize("DREADLIGHT.RollTitle")} — ${attrLabel}`;
  }

  /** @override */
  async _prepareContext(options) {
    const context = await super._prepareContext(options);
    const system = this.#actor.system;

    context.actor = this.#actor;
    context.attribute = this.#attribute;
    context.attrValue = system.attributes[this.#attribute].value;
    context.attributeOptions = CONFIG.DREADLIGHT.attributes.map(key => ({
      key,
      label: game.i18n.localize(CONFIG.DREADLIGHT.attributeLabels[key]),
      value: system.attributes[key]?.value ?? 0,
      selected: key === this.#attribute,
    }));

    // Talent options
    context.talents = this.#actor.items
      .filter(i => i.type === "talent")
      .map(t => ({ id: t.id, name: t.name, level: t.system.level, attrs: t.system.primaryAttributes }));

    // Gear options
    context.gearItems = this.#actor.items
      .filter(i => ["weapon", "equipment"].includes(i.type) && (i.system.gearBonus || 0) > 0)
      .map(g => ({ id: g.id, name: g.name, bonus: g.system.gearBonus }));

    context.selectedTalentId = this.#talent?.id || "";
    context.selectedTalentName = this.#talent?.name || "";
    context.selectedTalentLevel = this.#talent?.system.level || 0;
    context.selectedGearId = this.#gearItem?.id || "";
    context.selectedGearName = this.#gearItem?.name || "";
    context.selectedGearBonus = this.#gearItem?.system.gearBonus || 0;
    context.difficulties = CONFIG.DREADLIGHT.difficulties;
    context.dreadValue = system.dread.value;

    // Injuries with penalty > 0
    context.injuries = (system.injuries ?? [])
      .map((inj, i) => ({ ...inj, index: i }))
      .filter(inj => inj.penalty > 0);

    // Build initial pool preview
    const talentLevel = this.#talent?.system.level || 0;
    const gearBonus = this.#gearItem?.system.gearBonus || 0;
    const pool = buildPool({
      actor: this.#actor,
      attribute: this.#attribute,
      talentLevel,
      gearBonus,
      difficultyMod: 0,
      helpDice: 0,
      injuryPenalty: 0,
    });
    context.pool = pool;

    return context;
  }

  /** @override — attach live-update listeners after render */
  _onRender(context, options) {
    super._onRender(context, options);
    const el = this.element;

    // Attribute select -> update display + pool
    el.querySelector("[name=attribute]")?.addEventListener("change", (e) => {
      this.#updateAttributeDisplay(e.target);
      this.#updatePoolPreview();
    });

    // Talent select -> update display + pool
    el.querySelector("[name=talent]")?.addEventListener("change", (e) => {
      this.#updateTalentDisplay(e.target);
      this.#updatePoolPreview();
    });

    // Gear select → update display + pool
    el.querySelector("[name=gear]")?.addEventListener("change", (e) => {
      this.#updateGearDisplay(e.target);
      this.#updatePoolPreview();
    });

    // Help toggles — click to set help dice (click active = deselect)
    el.querySelectorAll(".help-btn").forEach(btn => {
      btn.addEventListener("click", () => {
        const val = parseInt(btn.dataset.help);
        const current = this.#getHelpDice();
        const next = (val === current) ? val - 1 : val;
        this.#setHelpDice(next);
        this.#updatePoolPreview();
      });
    });

    // Difficulty radios → update pool
    el.querySelectorAll("[name=difficulty]").forEach(r =>
      r.addEventListener("change", () => this.#updatePoolPreview())
    );

    // Injury toggles → update pool
    el.querySelectorAll(".injury-toggle").forEach(cb =>
      cb.addEventListener("change", () => this.#updatePoolPreview())
    );

    // Initial pool render to apply "first" class on dread blocks
    this.#updatePoolPreview();
  }

  /** Update the attribute source-row display from the select */
  #updateAttributeDisplay(select) {
    const option = select.selectedOptions[0];
    const attribute = option?.value || this.#attribute;
    const name = option?.dataset.name || game.i18n.localize(CONFIG.DREADLIGHT.attributeLabels[attribute]);
    const value = parseInt(option?.dataset.value || "0");
    const row = this.element.querySelector(".attribute-row");
    if (!row) return;

    this.#attribute = attribute;
    row.querySelector(".attribute-name").textContent = name;
    row.querySelector(".attribute-pips").innerHTML = Array(value).fill('<div class="pip pip-base"></div>').join("");
    row.querySelector(".attribute-count").textContent = value;
  }

  /** Update the talent source-row display from the select */
  #updateTalentDisplay(select) {
    const option = select.selectedOptions[0];
    const name = option?.dataset.name || "";
    const level = parseInt(option?.dataset.level || "0");
    const row = this.element.querySelector(".talent-row");
    if (!row) return;

    row.querySelector(".talent-name").textContent = name || game.i18n.localize("DREADLIGHT.RollNone");
    row.querySelector(".talent-meta").textContent = level ? `Level ${level}` : "";
    row.querySelector(".talent-pips").innerHTML = Array(level).fill('<div class="pip pip-base"></div>').join("");
    row.querySelector(".talent-count").textContent = level || "";
  }

  /** Update the gear source-row display from the select */
  #updateGearDisplay(select) {
    const option = select.selectedOptions[0];
    const name = option?.dataset.name || "";
    const bonus = parseInt(option?.dataset.bonus || "0");
    const row = this.element.querySelector(".gear-row");
    if (!row) return;

    const nameEl = row.querySelector(".gear-name");
    nameEl.textContent = name || game.i18n.localize("DREADLIGHT.RollNone");
    nameEl.classList.toggle("muted", !name);
    row.querySelector(".gear-meta").textContent = bonus ? "Gear bonus" : "";
    row.querySelector(".gear-pips").innerHTML = Array(bonus).fill('<div class="pip pip-gear"></div>').join("");
    const countEl = row.querySelector(".gear-count");
    countEl.textContent = bonus || "";
    countEl.classList.toggle("gear-color", bonus > 0);
  }

  /** Get current help dice value from the toggle state */
  #getHelpDice() {
    const active = this.element.querySelectorAll(".help-btn.active");
    return active.length;
  }

  /** Set help dice — light up buttons up to count */
  #setHelpDice(count) {
    this.element.querySelectorAll(".help-btn").forEach(b => {
      const val = parseInt(b.dataset.help);
      b.classList.toggle("active", val <= count);
    });
  }

  /** Sum penalty from checked injury toggles */
  #getInjuryPenalty() {
    let total = 0;
    this.element.querySelectorAll(".injury-toggle:checked").forEach(cb => {
      total += parseInt(cb.dataset.penalty) || 0;
    });
    return total;
  }

  /** Read current form state and rebuild the pool preview */
  #updatePoolPreview() {
    const form = this.element;
    if (!form) return;

    const attribute = form.querySelector("[name=attribute]")?.value || this.#attribute;
    const talentId = form.querySelector("[name=talent]")?.value || "";
    const gearId = form.querySelector("[name=gear]")?.value || "";
    const diffMod = parseInt(form.querySelector("[name=difficulty]:checked")?.value || "0");
    const helpDice = this.#getHelpDice();
    const injuryPenalty = this.#getInjuryPenalty();

    const selectedTalent = talentId ? this.#actor.items.get(talentId) : null;
    const selectedGear = gearId ? this.#actor.items.get(gearId) : null;

    const pool = buildPool({
      actor: this.#actor,
      attribute,
      talentLevel: selectedTalent?.system.level || 0,
      gearBonus: selectedGear?.system.gearBonus || 0,
      difficultyMod: diffMod,
      helpDice,
      injuryPenalty,
    });

    this.#renderPoolDOM(pool);
  }

  /** Rebuild the pool-preview DOM from a pool object */
  #renderPoolDOM(pool) {
    const preview = this.element.querySelector(".pool-preview");
    if (!preview) return;

    // Pool bar blocks
    let barHtml = "";
    for (let i = 0; i < pool.baseDice; i++) barHtml += '<div class="pool-block pool-block-base"></div>';
    for (let i = 0; i < pool.dreadDice; i++) {
      barHtml += `<div class="pool-block pool-block-dread${i === 0 && pool.baseDice > 0 ? " first" : ""}"></div>`;
    }
    if (pool.gearDice > 0) barHtml += '<div class="pool-gap"></div>';
    for (let i = 0; i < pool.gearDice; i++) barHtml += '<div class="pool-block pool-block-gear"></div>';
    preview.querySelector(".pool-bar").innerHTML = barHtml;

    // Bracket labels
    let labelsHtml = "";
    if (pool.baseDice > 0) {
      labelsHtml += `<div class="pool-range" data-type="base" style="width:calc(${pool.baseDice} * 26px);">
        <div class="pool-range-line range-line-base"></div>
        <span class="pool-range-text range-text-base">BASE <strong>${pool.baseDice}</strong></span>
      </div>`;
    }
    if (pool.dreadDice > 0) {
      labelsHtml += `<div class="pool-range" data-type="dread" style="width:calc(${pool.dreadDice} * 26px);">
        <div class="pool-range-line range-line-dread"></div>
        <span class="pool-range-text range-text-dread">DREAD <strong>${pool.dreadDice}</strong></span>
      </div>`;
    }
    if (pool.gearDice > 0) {
      labelsHtml += `<div class="pool-range-gap"></div>
      <div class="pool-range" data-type="gear" style="width:calc(${pool.gearDice} * 26px);">
        <div class="pool-range-line range-line-gear"></div>
        <span class="pool-range-text range-text-gear">GEAR <strong>${pool.gearDice}</strong></span>
      </div>`;
    }
    preview.querySelector(".pool-labels").innerHTML = labelsHtml;

    // Summary
    let summaryHtml = "";
    if (pool.baseDice > 0) {
      summaryHtml += `<div class="pool-stat"><div class="stat-pip stat-pip-base"></div><span class="stat-count">${pool.baseDice}</span><span class="stat-label">base</span></div>`;
    }
    if (pool.dreadDice > 0) {
      summaryHtml += `<div class="pool-stat"><div class="stat-pip stat-pip-dread"></div><span class="stat-count stat-count-dread">${pool.dreadDice}</span><span class="stat-label">dread</span></div>`;
    }
    if (pool.gearDice > 0) {
      summaryHtml += `<div class="pool-stat"><div class="stat-pip stat-pip-gear"></div><span class="stat-count stat-count-gear">${pool.gearDice}</span><span class="stat-label">gear</span></div>`;
    }
    summaryHtml += `<div class="pool-total-final"><strong class="pool-total-number">${pool.totalPool}</strong> dice</div>`;
    preview.querySelector(".pool-summary").innerHTML = summaryHtml;
  }

  /** Handle Roll button click */
  static async #onRoll(event, target) {
    const form = this.element.querySelector("form");
    if (!form) return;

    const attribute = form.querySelector("[name=attribute]")?.value || this.#attribute;
    const talentId = form.querySelector("[name=talent]")?.value || "";
    const gearId = form.querySelector("[name=gear]")?.value || "";
    const diffChecked = form.querySelector("[name=difficulty]:checked");
    const diffMod = parseInt(diffChecked?.value || "0");
    const helpDice = this.#getHelpDice();
    const injuryPenalty = this.#getInjuryPenalty();

    const selectedTalent = talentId ? this.#actor.items.get(talentId) : null;
    const selectedGear = gearId ? this.#actor.items.get(gearId) : null;

    const pool = buildPool({
      actor: this.#actor,
      attribute,
      talentLevel: selectedTalent?.system.level || 0,
      gearBonus: selectedGear?.system.gearBonus || 0,
      difficultyMod: diffMod,
      helpDice,
      injuryPenalty,
    });

    const diffName = Object.keys(CONFIG.DREADLIGHT.difficulties)
      .find(k => CONFIG.DREADLIGHT.difficulties[k] === diffMod) || "normal";

    const isWeapon = selectedGear?.type === "weapon";
    const roll = new DreadlightRoll({
      ...pool,
      attribute,
      talentName: selectedTalent?.name || null,
      talentIsDreadlore: selectedTalent?.system?.isDreadlore || selectedTalent?.system?.category === "dreadlore",
      gearName: selectedGear?.name || null,
      difficulty: diffName,
      actor: this.#actor,
      weaponDamage: isWeapon ? (selectedGear.system.damage ?? 0) : null,
      weaponCritThreshold: isWeapon ? (selectedGear.system.critThreshold ?? 6) : null,
    });

    const resolve = this.#resolve;
    this.#resolve = null;
    this.close();

    await roll.evaluate();
    await roll.showDSN();
    await sendRollToChat(roll);

    if (resolve) resolve(roll);
  }

  /** @override */
  async close(options = {}) {
    if (this.#resolve) {
      this.#resolve(null);
      this.#resolve = null;
    }
    return super.close(options);
  }

  /**
   * Static factory — opens the dialog and returns a promise that resolves
   * with the DreadlightRoll result (or null if closed).
   */
  static create({ actor, attribute, talent = null, gearItem = null }) {
    return new Promise((resolve) => {
      const dlg = new DreadlightRollDialog(
        { actor, attribute, talent, gearItem, resolve },
      );
      dlg.render(true);
    });
  }
}
