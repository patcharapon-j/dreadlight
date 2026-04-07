import { DreadlightRollDialog } from "../dice/roll-dialog.mjs";
import { rollD66 } from "../dice/d66-roll.mjs";
import { sendD66ToChat, sendD66PromptToChat } from "../dice/chat-message.mjs";

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
      rollArmor: InvestigatorSheet.#rollArmor,
      toggleCondition: InvestigatorSheet.#toggleCondition,
      toggleEditMode: InvestigatorSheet.#toggleEditMode,
      editPortrait: InvestigatorSheet.#editPortrait,
      toggleExpand: InvestigatorSheet.#toggleExpand,
      openItem: InvestigatorSheet.#openItem,
      deleteItem: InvestigatorSheet.#deleteItem,
      addConnection: InvestigatorSheet.#addConnection,
      deleteConnection: InvestigatorSheet.#deleteConnection,
      addMark: InvestigatorSheet.#addMark,
      deleteMark: InvestigatorSheet.#deleteMark,
      rollD66: InvestigatorSheet.#rollD66,
      deleteInjury: InvestigatorSheet.#deleteInjury,
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

  /** Whether the sheet is in edit mode (allows changing attribute values, etc.) */
  _editMode = false;

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
    context.editMode = this._editMode && this.isEditable;

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

    // Carry weight (items + supply at ¼ slot each)
    const gearItems = [...context.weapons, ...context.armors, ...context.equipment];
    const itemWeight = gearItems.reduce((sum, i) => sum + (i.system.weight ?? 0), 0);
    const supplyWeight = (system.supply.value ?? 0) * 0.25;
    context.carryUsed = Math.round((itemWeight + supplyWeight) * 100) / 100;
    context.carryLimit = system.carryLimit;

    // Spiral / marks — compute directly from source arrays
    context.totalMarks = (system.marks?.body?.length ?? 0)
      + (system.marks?.mind?.length ?? 0)
      + (system.marks?.soul?.length ?? 0);

    const buildMarks = (trackKey) =>
      (system.marks[trackKey] ?? []).map((mark, index) => ({ ...mark, track: trackKey, index }));

    context.allMarks = [
      ...buildMarks("body"),
      ...buildMarks("mind"),
      ...buildMarks("soul"),
    ];

    // Track bar percentages for mini bars
    const bodyMax = system.tracks.body.max || 1;
    const mindMax = system.tracks.mind.max || 1;
    const soulMax = system.tracks.soul.max || 1;
    context.bodyPct = Math.round((system.tracks.body.value / bodyMax) * 100);
    context.mindPct = Math.round((system.tracks.mind.value / mindMax) * 100);
    context.soulPct = Math.round((system.tracks.soul.value / soulMax) * 100);

    // Active injuries
    context.injuries = system.injuries ?? [];

    // Broken state
    context.anyBroken = system.tracks.body.broken || system.tracks.mind.broken || system.tracks.soul.broken;

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

    // Track button clicks: left-click = +1, right-click = −1
    for (const trackKey of ["body", "mind", "soul"]) {
      const btn = this.element.querySelector(`.track-btn.${trackKey}`);
      if (!btn) continue;
      btn.addEventListener("click", () => {
        const track = this.actor.system.tracks[trackKey];
        if (track.value < track.max) this.actor.update({ [`system.tracks.${trackKey}.value`]: track.value + 1 });
      });
      btn.addEventListener("contextmenu", (ev) => {
        ev.preventDefault();
        const track = this.actor.system.tracks[trackKey];
        if (track.value > 0) {
          const newVal = track.value - 1;
          this.actor.update({ [`system.tracks.${trackKey}.value`]: newVal });
        } else if (track.value === 0 && trackKey === "body") {
          // Already broken body — further damage = automatic critical injury
          sendD66PromptToChat(this.actor, "body");
        }
      });
    }

    // Dread button: left-click = +1, right-click = −1
    const dreadBtn = this.element.querySelector(".track-btn.dread");
    if (dreadBtn) {
      dreadBtn.addEventListener("click", () => {
        const val = this.actor.system.dread.value;
        if (val < 5) this.actor.update({ "system.dread.value": val + 1 });
      });
      dreadBtn.addEventListener("contextmenu", (ev) => {
        ev.preventDefault();
        const val = this.actor.system.dread.value;
        if (val > 0) this.actor.update({ "system.dread.value": val - 1 });
      });
    }

    // Inject dread corruption veins SVG into the tracks bar
    InvestigatorSheet.#injectDreadVeins(this.element);

    // Supply button: left-click = +1, right-click = −1
    const supplyBtn = this.element.querySelector(".track-btn.supply");
    if (supplyBtn) {
      supplyBtn.addEventListener("click", () => {
        const val = this.actor.system.supply.value;
        this.actor.update({ "system.supply.value": val + 1 });
      });
      supplyBtn.addEventListener("contextmenu", (ev) => {
        ev.preventDefault();
        const val = this.actor.system.supply.value;
        if (val > 0) this.actor.update({ "system.supply.value": val - 1 });
      });
    }

    // Item pip clicks: left-click = +1, right-click = −1
    this.element.querySelectorAll(".item-pips").forEach((container) => {
      const itemId = container.dataset.itemId;
      const field = container.dataset.field;
      const max = parseInt(container.dataset.max, 10);
      container.style.cursor = "pointer";
      container.addEventListener("click", () => {
        const item = this.actor.items.get(itemId);
        if (!item) return;
        const current = foundry.utils.getProperty(item, field);
        if (current < max) item.update({ [field]: current + 1 });
      });
      container.addEventListener("contextmenu", (ev) => {
        ev.preventDefault();
        ev.stopPropagation();
        const item = this.actor.items.get(itemId);
        if (!item) return;
        const current = foundry.utils.getProperty(item, field);
        if (current > 0) item.update({ [field]: current - 1 });
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

    // Item right-click context menu (talent rows + equipment item rows)
    this.element.querySelectorAll(".talent-row[data-item-id], .item-row[data-item-id]").forEach((row) => {
      row.addEventListener("contextmenu", (ev) => {
        ev.preventDefault();
        const itemId = row.dataset.itemId;
        const item = this.actor.items.get(itemId);
        if (!item) return;
        this.#showItemContextMenu(ev, item);
      });
    });

    // Portrait right-click context menu (edit mode only)
    const portraitFigure = this.element.querySelector(".portrait-figure");
    if (portraitFigure && this._editMode) {
      portraitFigure.addEventListener("contextmenu", (ev) => {
        ev.preventDefault();
        this.#showPortraitContextMenu(ev, portraitFigure);
      });
    }
  }

  /* ---------------------------------------- */
  /*  Actions                                 */
  /* ---------------------------------------- */

  static #toggleEditMode(event, target) {
    this._editMode = !this._editMode;
    this.render();
  }

  static #editPortrait(event, target) {
    if (!this._editMode) return;
    const fp = new FilePicker({
      type: "image",
      current: this.actor.img,
      callback: (path) => this.actor.update({ img: path }),
    });
    fp.render(true);
  }

  /* ---------------------------------------- */
  /*  Portrait Reposition                      */
  /* ---------------------------------------- */

  #showItemContextMenu(ev, item) {
    // Remove any existing context menu
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

    menu.querySelector("[data-action='ctx-edit']").addEventListener("click", () => {
      dismiss();
      item.sheet.render(true);
    });
    menu.querySelector("[data-action='ctx-delete']").addEventListener("click", () => {
      dismiss();
      item.delete();
    });

    // Dismiss on click-away or Escape
    const onClickAway = (e) => {
      if (!menu.contains(e.target)) { dismiss(); document.removeEventListener("pointerdown", onClickAway); }
    };
    const onEscape = (e) => {
      if (e.key === "Escape") { dismiss(); document.removeEventListener("keydown", onEscape); }
    };
    setTimeout(() => {
      document.addEventListener("pointerdown", onClickAway);
      document.addEventListener("keydown", onEscape);
    }, 0);
  }

  #showPortraitContextMenu(ev, portraitFigure) {
    // Remove any existing context menu
    document.querySelector(".dl-context-menu")?.remove();

    const menu = document.createElement("nav");
    menu.classList.add("dl-context-menu");
    menu.innerHTML = `
      <ul>
        <li data-action="reposition-sheet">${game.i18n.localize("DREADLIGHT.PortraitRepositionSheet")}</li>
        <li data-action="reposition-chat">${game.i18n.localize("DREADLIGHT.PortraitRepositionChat")}</li>
        <li data-action="change-image">${game.i18n.localize("DREADLIGHT.PortraitChange")}</li>
      </ul>
    `;
    menu.style.left = `${ev.clientX}px`;
    menu.style.top = `${ev.clientY}px`;
    document.body.appendChild(menu);

    const dismiss = () => menu.remove();

    menu.querySelector("[data-action='reposition-sheet']").addEventListener("click", () => {
      dismiss();
      this.#enterRepositionMode(portraitFigure);
    });
    menu.querySelector("[data-action='reposition-chat']").addEventListener("click", () => {
      dismiss();
      this.#openChatPortraitDialog();
    });
    menu.querySelector("[data-action='change-image']").addEventListener("click", () => {
      dismiss();
      const fp = new FilePicker({
        type: "image",
        current: this.actor.img,
        callback: (path) => this.actor.update({ img: path }),
      });
      fp.render(true);
    });

    // Dismiss on click-away or Escape
    const onClickAway = (e) => {
      if (!menu.contains(e.target)) { dismiss(); document.removeEventListener("pointerdown", onClickAway); }
    };
    const onEscape = (e) => {
      if (e.key === "Escape") { dismiss(); document.removeEventListener("keydown", onEscape); }
    };
    setTimeout(() => {
      document.addEventListener("pointerdown", onClickAway);
      document.addEventListener("keydown", onEscape);
    }, 0);
  }

  /** Inline drag+wheel reposition for the sheet header portrait. */
  #enterRepositionMode(portraitFigure) {
    const img = portraitFigure.querySelector("img");
    const portrait = this.actor.system.portrait.sheet;
    let offsetX = portrait.offsetX;
    let offsetY = portrait.offsetY;
    let zoom = portrait.zoom;

    portraitFigure.classList.add("repositioning");

    const label = document.createElement("div");
    label.classList.add("reposition-label");
    label.textContent = game.i18n.localize("DREADLIGHT.PortraitRepositionSheet");
    portraitFigure.appendChild(label);

    const doneBtn = document.createElement("button");
    doneBtn.classList.add("reposition-done");
    doneBtn.innerHTML = `<i class="fa-solid fa-check"></i>`;
    portraitFigure.appendChild(doneBtn);

    const applyStyle = () => {
      img.style.transform = `translate(${offsetX}px, ${offsetY}px) scale(${zoom})`;
    };
    applyStyle();

    let dragging = false;
    const onPointerDown = (e) => {
      if (e.target === doneBtn || doneBtn.contains(e.target)) return;
      e.preventDefault();
      dragging = true;
      portraitFigure.setPointerCapture(e.pointerId);
    };
    const onPointerMove = (e) => {
      if (!dragging) return;
      offsetX += e.movementX;
      offsetY += e.movementY;
      applyStyle();
    };
    const onPointerUp = (e) => {
      dragging = false;
      portraitFigure.releasePointerCapture(e.pointerId);
    };
    const onWheel = (e) => {
      e.preventDefault();
      const delta = e.deltaY > 0 ? -0.05 : 0.05;
      zoom = Math.max(0.5, Math.min(5, zoom + delta));
      applyStyle();
    };

    portraitFigure.addEventListener("pointerdown", onPointerDown);
    portraitFigure.addEventListener("pointermove", onPointerMove);
    portraitFigure.addEventListener("pointerup", onPointerUp);
    portraitFigure.addEventListener("wheel", onWheel, { passive: false });

    const exit = () => {
      portraitFigure.classList.remove("repositioning");
      label.remove();
      doneBtn.remove();
      portraitFigure.removeEventListener("pointerdown", onPointerDown);
      portraitFigure.removeEventListener("pointermove", onPointerMove);
      portraitFigure.removeEventListener("pointerup", onPointerUp);
      portraitFigure.removeEventListener("wheel", onWheel);
      document.removeEventListener("keydown", onEscape);
      this.actor.update({
        "system.portrait.sheet.offsetX": Math.round(offsetX * 10) / 10,
        "system.portrait.sheet.offsetY": Math.round(offsetY * 10) / 10,
        "system.portrait.sheet.zoom": Math.round(zoom * 100) / 100,
      });
    };

    doneBtn.addEventListener("click", exit);
    const onEscape = (e) => { if (e.key === "Escape") exit(); };
    document.addEventListener("keydown", onEscape);
  }

  /** DialogV2 with a live chat-card preview for positioning the chat portrait. */
  #openChatPortraitDialog() {
    const actor = this.actor;
    const chat = actor.system.portrait.chat;
    let offsetX = chat.offsetX;
    let offsetY = chat.offsetY;
    let zoom = chat.zoom;

    // Build a mock chat card matching the real roll-result template structure
    const previewHTML = `
      <div class="chat-portrait-setup">
        <p class="setup-hint">${game.i18n.localize("DREADLIGHT.PortraitChatHint")}</p>
        <div class="dreadlight-chat chat-clean">
          <div class="chat-accent"></div>
          <div class="chat-header">
            <div class="chat-portrait" id="chat-portrait-preview"
                 style="background-image: url('${actor.img}');
                        transform: translate(${offsetX}px, ${offsetY}px) scale(${zoom});"></div>
            <div class="chat-portrait-fade"></div>
            <div class="chat-name">${actor.name}</div>
          </div>
          <div class="chat-info">
            <div class="chat-action">
              <span class="chat-talent">Talent</span> — Attribute (Normal)
            </div>
          </div>
          <div class="chat-dice">
            <div class="dice-group group-base">
              <span class="dice-label label-base">${game.i18n.localize("DREADLIGHT.Base")}</span>
              <div class="die die-base six">6</div>
              <div class="die die-base normal">3</div>
              <div class="die die-base normal">4</div>
            </div>
            <div class="dice-group group-dread">
              <span class="dice-label label-dread">${game.i18n.localize("DREADLIGHT.Dread")}</span>
              <div class="die die-dread normal">2</div>
            </div>
          </div>
          <div class="chat-result">
            <div class="result-row">
              <span class="result-icon gold">✦</span>
              <span class="result-label">${game.i18n.localize("DREADLIGHT.ResultCleanSuccess")}</span>
              <span class="result-count">1 ${game.i18n.localize("DREADLIGHT.Success")}</span>
            </div>
          </div>
        </div>
      </div>
    `;

    const dialog = new foundry.applications.api.DialogV2({
      window: { title: game.i18n.localize("DREADLIGHT.PortraitRepositionChat") },
      classes: ["dreadlight", "chat-portrait-dialog"],
      content: previewHTML,
      buttons: [
        {
          action: "save",
          label: game.i18n.localize("Save"),
          icon: "fa-solid fa-check",
          default: true,
          callback: () => ({ offsetX, offsetY, zoom }),
        },
        {
          action: "cancel",
          label: game.i18n.localize("Cancel"),
          icon: "fa-solid fa-xmark",
        },
      ],
      submit: (result) => {
        if (!result || typeof result !== "object") return;
        actor.update({
          "system.portrait.chat.offsetX": Math.round(result.offsetX * 10) / 10,
          "system.portrait.chat.offsetY": Math.round(result.offsetY * 10) / 10,
          "system.portrait.chat.zoom": Math.round(result.zoom * 100) / 100,
        });
      },
    });

    Hooks.once("renderDialogV2", (app, element) => {
      if (app !== dialog) return;
      const preview = element.querySelector("#chat-portrait-preview");
      if (!preview) return;
      const chatHeader = preview.closest(".chat-header");

      const applyStyle = () => {
        preview.style.transform = `translate(${offsetX}px, ${offsetY}px) scale(${zoom})`;
      };

      let dragging = false;
      chatHeader.style.cursor = "grab";

      chatHeader.addEventListener("pointerdown", (e) => {
        e.preventDefault();
        dragging = true;
        chatHeader.setPointerCapture(e.pointerId);
        chatHeader.style.cursor = "grabbing";
      });
      chatHeader.addEventListener("pointermove", (e) => {
        if (!dragging) return;
        offsetX += e.movementX;
        offsetY += e.movementY;
        applyStyle();
      });
      chatHeader.addEventListener("pointerup", (e) => {
        dragging = false;
        chatHeader.releasePointerCapture(e.pointerId);
        chatHeader.style.cursor = "grab";
      });
      chatHeader.addEventListener("wheel", (e) => {
        e.preventDefault();
        // Scale step proportionally — larger steps at higher zoom for faster navigation
        const step = Math.max(0.05, zoom * 0.05);
        const delta = e.deltaY > 0 ? -step : step;
        zoom = Math.max(0.5, Math.min(15, zoom + delta));
        applyStyle();
      }, { passive: false });
    });

    dialog.render({ force: true });
  }

  static #rollAttribute(event, target) {
    if (this._editMode) return;
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

  static async #rollArmor(event, target) {
    const row = target.closest(".item-row[data-item-id]");
    const armor = this.actor.items.get(row.dataset.itemId);
    if (!armor) return;
    const dice = armor.system.armorCurrent;
    if (dice <= 0) {
      ui.notifications.warn(game.i18n.localize("DREADLIGHT.ArmorNoDice"));
      return;
    }

    const roll = new Roll(`${dice}dg`);
    await roll.evaluate();

    // Show Dice So Nice
    if (game.dice3d) await game.dice3d.showForRoll(roll, game.user, true);

    const results = roll.dice[0].results.map(r => r.result);
    const sixes = results.filter(r => r === 6).length;

    const templateData = {
      actorImg: this.actor.img,
      actorName: this.actor.name,
      portraitChat: this.actor.system.portrait?.chat ?? { offsetX: 50, offsetY: 50, zoom: 1 },
      armorName: armor.name,
      results,
      sixes,
    };

    const content = await foundry.applications.handlebars.renderTemplate(
      "systems/dreadlight/templates/chat/armor-result.hbs", templateData
    );

    ChatMessage.create({
      speaker: ChatMessage.getSpeaker({ actor: this.actor }),
      content,
    });
  }

  static async #rollD66(event, target) {
    event.stopPropagation();
    const trackKey = target.dataset.track;
    if (!trackKey) return;
    const result = await rollD66(trackKey, this.actor);
    await sendD66ToChat(result);
  }

  static #deleteInjury(event, target) {
    const index = parseInt(target.dataset.index, 10);
    const injuries = [...(this.actor.system.injuries ?? [])];
    injuries.splice(index, 1);
    this.actor.update({ "system.injuries": injuries });
  }

  static #toggleCondition(event, target) {
    const attr = target.closest("[data-attr]")?.dataset.attr ?? target.dataset.attr;
    const conditionKey = CONFIG.DREADLIGHT.conditionMap[attr];
    if (!conditionKey) return;
    const current = this.actor.system.conditions[conditionKey];
    this.actor.update({ [`system.conditions.${conditionKey}`]: !current });
  }

  static #toggleExpand(event, target) {
    const row = target.closest("[data-item-id]");
    const itemId = row.dataset.itemId;
    const expand = this.element.querySelector(`[data-expand-id="${itemId}"]`);
    if (!expand) return;
    const isOpen = expand.classList.toggle("open");
    row.classList.toggle("expanded", isOpen);
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

  /* ---------------------------------------- */
  /*  Broken Track Notifications              */
  /* ---------------------------------------- */

  static #notifyBroken(actor, trackKey) {
    const locKey = {
      body: "DREADLIGHT.BrokenBody",
      mind: "DREADLIGHT.BrokenMind",
      soul: "DREADLIGHT.BrokenSoul",
    }[trackKey];
    const msg = game.i18n.format(locKey, { name: actor.name });
    ChatMessage.create({
      speaker: ChatMessage.getSpeaker({ actor }),
      content: `<div class="dreadlight-chat broken-alert"><p>${msg}</p></div>`,
    });
  }

  static #notifyCriticalWhileBroken(actor) {
    const msg = game.i18n.format("DREADLIGHT.BrokenBodyCritical", { name: actor.name });
    ChatMessage.create({
      speaker: ChatMessage.getSpeaker({ actor }),
      content: `<div class="dreadlight-chat broken-alert"><p>${msg}</p></div>`,
    });
  }

  /* ---------------------------------------- */
  /*  Dread Corruption Veins                  */
  /* ---------------------------------------- */

  /**
   * Inject an SVG overlay into the tracks bar with branching vein/crack paths
   * that originate from the dread box border and wrap around the soul box.
   */
  static #injectDreadVeins(html) {
    const tracksBar = html.querySelector(".tracks-bar");
    if (!tracksBar || tracksBar.querySelector(".dread-veins")) return;

    const dreadBox = tracksBar.querySelector(".track-btn.dread");
    const soulBox = tracksBar.querySelector(".track-btn.soul");
    if (!dreadBox || !soulBox) return;

    const barRect = tracksBar.getBoundingClientRect();
    const dreadRect = dreadBox.getBoundingClientRect();
    const soulRect = soulBox.getBoundingClientRect();
    const barW = barRect.width;
    const barH = barRect.height;

    // Dread box: left edge origin points
    const ox = dreadRect.left - barRect.left;
    const oy = dreadRect.top - barRect.top + dreadRect.height / 2;
    const oyTop = dreadRect.top - barRect.top + 3;
    const oyBot = dreadRect.bottom - barRect.top - 3;

    // Soul box edges (target for wrapping)
    const soulR = soulRect.right - barRect.left;   // right edge
    const soulL = soulRect.left - barRect.left;     // left edge
    const soulT = soulRect.top - barRect.top;       // top edge
    const soulB = soulRect.bottom - barRect.top;    // bottom edge
    const soulMidY = soulT + (soulB - soulT) / 2;

    const svgNS = "http://www.w3.org/2000/svg";
    const svg = document.createElementNS(svgNS, "svg");
    svg.classList.add("dread-veins");
    svg.setAttribute("viewBox", `0 0 ${barW} ${barH}`);
    svg.setAttribute("preserveAspectRatio", "none");

    // Helper: jagged vein path with quadratic bezier segments
    const veinPath = (startX, startY, segments, jitter, strokeW, opacity) => {
      let d = `M ${startX} ${startY}`;
      let cx = startX;
      let cy = startY;
      for (const seg of segments) {
        const jx = (Math.random() - 0.5) * jitter;
        const jy = (Math.random() - 0.5) * jitter;
        const nx = cx + seg[0] + jx;
        const ny = Math.max(1, Math.min(barH - 1, cy + seg[1] + jy));
        const cpx = (cx + nx) / 2 + (Math.random() - 0.5) * jitter * 0.6;
        const cpy = (cy + ny) / 2 + (Math.random() - 0.5) * jitter * 0.8;
        d += ` Q ${cpx} ${cpy} ${nx} ${ny}`;
        cx = nx;
        cy = ny;
      }
      const path = document.createElementNS(svgNS, "path");
      path.setAttribute("d", d);
      path.setAttribute("stroke", `rgba(224, 85, 85, ${opacity})`);
      path.setAttribute("stroke-width", strokeW);
      return path;
    };

    // Helper: sub-branch
    const branch = (startX, startY, dx, dy, strokeW, opacity) => {
      const mx = startX + dx * 0.5 + (Math.random() - 0.5) * 3;
      const my = startY + dy * 0.5 + (Math.random() - 0.5) * 3;
      const path = document.createElementNS(svgNS, "path");
      path.setAttribute("d", `M ${startX} ${startY} Q ${mx} ${my} ${startX + dx} ${startY + dy}`);
      path.setAttribute("stroke", `rgba(224, 85, 85, ${opacity})`);
      path.setAttribute("stroke-width", strokeW);
      return path;
    };

    // Distance from dread left edge to soul box right edge
    const gapToSoul = ox - soulR;

    // ── Dread 1: tiny cracks from dread border, just hints ──
    const g1 = document.createElementNS(svgNS, "g");
    g1.classList.add("vein-group", "vein-d1");
    g1.append(
      veinPath(ox, oy - 2, [[-8, -2], [-6, 3]], 2, "1.2", 0.4),
      veinPath(ox, oy + 3, [[-7, 2], [-5, -2]], 2, "0.8", 0.3),
      branch(ox - 8, oy - 4, -4, -5, "0.6", 0.25),
    );

    // ── Dread 2: cracks reach toward the separator ──
    const g2 = document.createElementNS(svgNS, "g");
    g2.classList.add("vein-group", "vein-d2");
    const sepX = ox - gapToSoul * 0.4;
    g2.append(
      veinPath(ox, oyTop, [[-10, -2], [-8, 3], [-7, -2]], 3, "1.3", 0.45),
      veinPath(ox, oyBot, [[-9, 2], [-7, -3], [-6, 2]], 2, "1", 0.4),
      branch(ox - 18, oyTop + 1, -5, -4, "0.7", 0.3),
      branch(ox - 16, oyBot - 1, -5, 4, "0.7", 0.25),
    );

    // ── Dread 3: veins cross gap and touch soul box right edge ──
    const g3 = document.createElementNS(svgNS, "g");
    g3.classList.add("vein-group", "vein-d3");
    // Main vein snaking from dread to soul right edge
    const stepSize3 = gapToSoul / 4;
    g3.append(
      veinPath(ox, oy, [
        [-stepSize3, -3], [-stepSize3, 4], [-stepSize3, -2], [-stepSize3, 1]
      ], 3, "1.5", 0.5),
      veinPath(ox, oyTop + 2, [
        [-stepSize3, -2], [-stepSize3, 3], [-stepSize3, -3]
      ], 3, "1.2", 0.4),
      // Small branches at the soul box edge
      branch(soulR + 2, oy + 1, 0, -6, "0.7", 0.3),
      branch(soulR + 2, oy - 1, 0, 5, "0.7", 0.3),
    );

    // ── Dread 4: veins wrap around the soul box — top and bottom edges ──
    const g4 = document.createElementNS(svgNS, "g");
    g4.classList.add("vein-group", "vein-d4");
    const soulW = soulR - soulL;
    g4.append(
      // Vein running along soul box top edge (right to left)
      veinPath(soulR, soulT - 1, [
        [-soulW * 0.25, -2], [-soulW * 0.25, 1], [-soulW * 0.25, -1]
      ], 2, "1.3", 0.45),
      // Vein running along soul box bottom edge (right to left)
      veinPath(soulR, soulB + 1, [
        [-soulW * 0.25, 2], [-soulW * 0.25, -1], [-soulW * 0.25, 1]
      ], 2, "1.3", 0.45),
      // Extra tendril reaching further along top
      veinPath(soulR - soulW * 0.3, soulT - 2, [
        [-soulW * 0.2, -1], [-soulW * 0.15, 1]
      ], 2, "0.9", 0.35),
      // Branches curling inward from top
      branch(soulR - soulW * 0.2, soulT - 1, 0, 4, "0.6", 0.25),
      branch(soulR - soulW * 0.5, soulT - 2, 0, 3, "0.6", 0.2),
      // Branches curling inward from bottom
      branch(soulR - soulW * 0.15, soulB + 1, 0, -4, "0.6", 0.25),
      branch(soulR - soulW * 0.4, soulB + 2, 0, -3, "0.6", 0.2),
    );

    // ── Dread 5: veins fully envelop the soul box ──
    const g5 = document.createElementNS(svgNS, "g");
    g5.classList.add("vein-group", "vein-d5");
    g5.append(
      // Top edge extends all the way to left side of soul box
      veinPath(soulR - soulW * 0.6, soulT - 1, [
        [-soulW * 0.15, -1], [-soulW * 0.12, 1], [-soulW * 0.1, -1]
      ], 2, "1.2", 0.5),
      // Bottom edge extends all the way
      veinPath(soulR - soulW * 0.5, soulB + 1, [
        [-soulW * 0.15, 1], [-soulW * 0.12, -1], [-soulW * 0.1, 1]
      ], 2, "1.2", 0.5),
      // Left edge — veins curl around the left side of soul box
      veinPath(soulL + 2, soulT + 2, [
        [0, (soulB - soulT) * 0.3], [1, (soulB - soulT) * 0.2]
      ], 2, "1", 0.4),
      veinPath(soulL + 1, soulB - 2, [
        [0, -(soulB - soulT) * 0.25], [-1, -(soulB - soulT) * 0.2]
      ], 2, "1", 0.4),
      // Fine cracks across the face of soul box
      branch(soulR - soulW * 0.3, soulT, 0, (soulB - soulT) * 0.3, "0.5", 0.2),
      branch(soulR - soulW * 0.6, soulT + 2, 0, (soulB - soulT) * 0.25, "0.5", 0.18),
      branch(soulL + soulW * 0.15, soulB, 0, -(soulB - soulT) * 0.3, "0.5", 0.18),
      // Extra branch from dread side for density
      branch(ox - 5, oy - 6, -4, -3, "0.5", 0.2),
      branch(ox - 5, oy + 6, -4, 3, "0.5", 0.2),
    );

    svg.append(g1, g2, g3, g4, g5);
    tracksBar.appendChild(svg);
  }
}
