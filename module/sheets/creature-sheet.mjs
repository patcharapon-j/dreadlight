import { DreadlightRoll } from "../dice/dreadlight-roll.mjs";
import { sendRollToChat } from "../dice/chat-message.mjs";
import { scaleSheetPosition } from "../settings.mjs";

const { HandlebarsApplicationMixin } = foundry.applications.api;
const { ActorSheetV2 } = foundry.applications.sheets;

export class CreatureSheet extends HandlebarsApplicationMixin(ActorSheetV2) {

  static DEFAULT_OPTIONS = {
    classes: ["dreadlight", "sheet", "actor", "creature"],
    position: { width: 480, height: 620 },
    window: { resizable: true },
    actions: {
      editPortrait: CreatureSheet.#editPortrait,
      rollAttack: CreatureSheet.#rollAttack,
      addAttack: CreatureSheet.#addAttack,
      removeAttack: CreatureSheet.#removeAttack,
      addAttribute: CreatureSheet.#addAttribute,
      removeAttribute: CreatureSheet.#removeAttribute,
    },
    form: { submitOnChange: true },
  };

  static PARTS = {
    sheet: { template: "systems/dreadlight/templates/actors/creature-sheet.hbs" },
  };

  /** @override */
  _initializeApplicationOptions(options) {
    return scaleSheetPosition(super._initializeApplicationOptions(options));
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

    // Threat level options
    context.threatOptions = Object.entries(CONFIG.DREADLIGHT.threatLevels).map(([value, label]) => ({
      value, label, selected: value === system.threatLevel,
    }));

    // Attribute options for dropdowns
    context.attrOptions = CONFIG.DREADLIGHT.attributes.map(key => ({
      value: key,
      label: game.i18n.localize(CONFIG.DREADLIGHT.attributeLabels[key]),
    }));

    // Creature attributes with resolved values
    context.creatureAttributes = system.attributes ?? [];
    context.canAddAttribute = (system.attributes?.length ?? 0) < 6;

    // Attacks with resolved pool values
    context.attacks = (system.attacks ?? []).map((atk, i) => ({
      ...atk,
      poolValue: system.getAttributeValue(atk.attribute),
    }));
    context.canAddAttack = (system.attacks?.length ?? 0) < 3;

    return context;
  }

  /* ---------------------------------------- */
  /*  Render                                  */
  /* ---------------------------------------- */

  _onRender(context, options) {
    super._onRender(context, options);

    if (!this.isEditable) return;

    // Body track button: left-click +1, right-click -1
    const bodyBtn = this.element.querySelector(".track-btn.body");
    if (bodyBtn) {
      bodyBtn.addEventListener("click", () => {
        const track = this.actor.system.body;
        if (track.value < track.max) this.actor.update({ "system.body.value": track.value + 1 });
      });
      bodyBtn.addEventListener("contextmenu", (ev) => {
        ev.preventDefault();
        const track = this.actor.system.body;
        if (track.value > 0) this.actor.update({ "system.body.value": track.value - 1 });
      });
    }
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

  static async #rollAttack(event, target) {
    const index = parseInt(target.closest("[data-index]").dataset.index);
    const attack = this.actor.system.attacks[index];
    if (!attack) return;

    const poolValue = this.actor.system.getAttributeValue(attack.attribute);
    const roll = new DreadlightRoll({
      baseDice: poolValue,
      dreadDice: 0,
      gearDice: 0,
      attribute: attack.attribute,
      talentName: attack.name,
      actor: this.actor,
      weaponDamage: attack.damage ?? 0,
      weaponCritThreshold: attack.critThreshold ?? 6,
    });
    await roll.evaluate();
    await roll.showDSN();
    await sendRollToChat(roll);
  }

  static #addAttack(event, target) {
    const attacks = this.actor.system.attacks ?? [];
    if (attacks.length >= 3) return;
    this.actor.update({
      "system.attacks": [...attacks, { name: "", attribute: "str", damage: 1, critThreshold: 6, range: "engaged" }],
    });
  }

  static #removeAttack(event, target) {
    const index = parseInt(target.closest("[data-index]").dataset.index);
    const attacks = [...(this.actor.system.attacks ?? [])];
    attacks.splice(index, 1);
    this.actor.update({ "system.attacks": attacks });
  }

  static #addAttribute(event, target) {
    const attrs = this.actor.system.attributes ?? [];
    if (attrs.length >= 6) return;
    this.actor.update({
      "system.attributes": [...attrs, { attr: "str", value: 3 }],
    });
  }

  static #removeAttribute(event, target) {
    const index = parseInt(target.closest("[data-index]").dataset.index);
    const attrs = [...(this.actor.system.attributes ?? [])];
    attrs.splice(index, 1);
    this.actor.update({ "system.attributes": attrs });
  }
}
