const { ApplicationV2, HandlebarsApplicationMixin } = foundry.applications.api;

const ATTRIBUTES = ["str", "agl", "log", "per", "ins", "emp"];
const STEPS = ["talents", "attributes", "backgrounds", "history"];
const CUSTOM_BACKGROUND_VALUE = "__custom__";
const XP_COSTS = {
  talent: { 0: 5, 1: 10, 2: 15 },
  attribute: 15,
  background: 10,
};
const TRACK_BY_ATTRIBUTE = {
  str: "body",
  agl: "body",
  log: "mind",
  emp: "mind",
  ins: "soul",
  per: "soul",
};

function cap(str) {
  return String(str ?? "").charAt(0).toUpperCase() + String(str ?? "").slice(1);
}

function getSystemPack(packName) {
  const collection = `dreadlight.${packName}`;
  return Array.from(game.packs.values()).find((pack) =>
    pack.collection === collection
    || (pack.metadata?.packageName === "dreadlight" && pack.metadata?.name === packName)
  );
}

async function loadPackDocuments(packName, type) {
  const pack = getSystemPack(packName);
  if (!pack) return [];
  const docs = await pack.getDocuments();
  return docs.filter((doc) => doc.type === type);
}

async function loadAdvancementPacks() {
  const [talents, backgrounds] = await Promise.all([
    loadPackDocuments("talents", "talent"),
    loadPackDocuments("backgrounds", "background"),
  ]);
  return { talents, backgrounds };
}

function categoryLabel(category) {
  const locKey = `DREADLIGHT.Category${cap(category)}`;
  const label = game.i18n.localize(locKey);
  return label === locKey ? cap(category) : label;
}

function isDreadloreTalent(doc) {
  return doc.system?.isDreadlore || doc.system?.category === "dreadlore";
}

function toDelimited(value) {
  return Array.isArray(value) ? value.join(";") : String(value ?? "");
}

function listValue(value) {
  if (Array.isArray(value)) return value.map((entry) => String(entry ?? "").trim()).filter(Boolean);
  return String(value ?? "").split(";").map((entry) => entry.trim()).filter(Boolean);
}

function availableXp(system) {
  return Math.max(0, (Number(system.advancement?.xp) || 0) - (Number(system.advancement?.spent) || 0));
}

function currentAttributeCap(system, attr) {
  const current = Number(system.attributes?.[attr]?.value) || 0;
  const hasSixElsewhere = ATTRIBUTES.some((key) => key !== attr && Number(system.attributes?.[key]?.value) >= 6);
  if (current >= 6) return { maxed: true, next: current };
  if (current >= 5 && hasSixElsewhere) return { maxed: true, next: current };
  return { maxed: false, next: current + 1 };
}

function historyEntry(type, label, cost, note = "", undo = {}) {
  return {
    id: foundry.utils.randomID(16),
    date: new Date().toISOString(),
    type,
    label,
    cost,
    note,
    targetId: undo.targetId ?? "",
    targetName: undo.targetName ?? "",
    key: undo.key ?? "",
    track: undo.track ?? "",
    from: Number(undo.from) || 0,
    to: Number(undo.to) || 0,
  };
}

export class DreadlightAdvancementManager extends HandlebarsApplicationMixin(ApplicationV2) {
  static DEFAULT_OPTIONS = {
    id: "dreadlight-advancement-manager-{id}",
    classes: ["dreadlight", "character-builder", "advancement-manager"],
    position: { width: 780, height: 820 },
    window: {
      title: "DREADLIGHT.Advancement",
      resizable: true,
    },
    actions: {
      cancel: DreadlightAdvancementManager.#cancel,
      nextStep: DreadlightAdvancementManager.#nextStep,
      previousStep: DreadlightAdvancementManager.#previousStep,
      goStep: DreadlightAdvancementManager.#goStep,
      purchase: DreadlightAdvancementManager.#purchase,
      updateHistory: DreadlightAdvancementManager.#updateHistory,
      removeHistory: DreadlightAdvancementManager.#removeHistory,
      undoHistory: DreadlightAdvancementManager.#undoHistory,
    },
  };

  static PARTS = {
    sheet: { template: "systems/dreadlight/templates/apps/advancement-manager.hbs" },
  };

  #step = 0;

  constructor(actor, options = {}) {
    super(options);
    this.actor = actor;
  }

  async _prepareContext(options) {
    const context = await super._prepareContext(options);
    const system = this.actor.system;
    const packs = await loadAdvancementPacks();
    const available = availableXp(system);
    const actorTalents = new Map(
      this.actor.items
        .filter((item) => item.type === "talent")
        .map((item) => [item.name, item])
    );
    const existingBackgrounds = new Set((system.backgrounds ?? []).map((background) => background.name).filter(Boolean));

    context.actor = this.actor;
    context.system = system;
    context.availableXp = available;
    context.totalXp = Number(system.advancement?.xp) || 0;
    context.spentXp = Number(system.advancement?.spent) || 0;
    context.isGM = game.user.isGM;
    context.backgroundCost = XP_COSTS.background;
    context.steps = STEPS.map((key, index) => ({
      key,
      index,
      label: game.i18n.localize(`DREADLIGHT.AdvancementStep${cap(key)}`),
    }));
    context.selectedStep = this.#step;
    context.talents = packs.talents
      .filter((doc) => !isDreadloreTalent(doc))
      .map((doc) => {
        const actorTalent = actorTalents.get(doc.name);
        const currentLevel = Math.min(3, Number(actorTalent?.system.level) || 0);
        const nextLevel = Math.min(3, currentLevel + 1);
        const cost = XP_COSTS.talent[currentLevel] ?? 0;
        const category = categoryLabel(doc.system.category ?? "");
        return {
          id: doc.id,
          name: doc.name,
          img: doc.img,
          currentLevel,
          nextLevel,
          cost,
          canBuy: currentLevel < 3 && cost <= available,
          maxed: currentLevel >= 3,
          categoryLabel: category,
          primaryAttributes: doc.system.primaryAttributes ?? [],
          description: doc.system.description ?? "",
          perkName: doc.system.perkName ?? "",
          perkDescription: doc.system.perkDescription ?? "",
          masteryName: doc.system.masteryName ?? "",
          masteryDescription: doc.system.masteryDescription ?? "",
        };
      })
      .sort((a, b) => a.categoryLabel.localeCompare(b.categoryLabel) || a.name.localeCompare(b.name));
    context.talentCategories = Array.from(new Set(context.talents.map((talent) => talent.categoryLabel))).sort();

    context.attributeRows = ATTRIBUTES.map((attr) => {
      const current = Number(system.attributes?.[attr]?.value) || 0;
      const { maxed, next } = currentAttributeCap(system, attr);
      const track = TRACK_BY_ATTRIBUTE[attr];
      return {
        key: attr,
        current,
        next,
        track,
        trackLabel: game.i18n.localize(`DREADLIGHT.Track${cap(track)}`),
        cost: XP_COSTS.attribute,
        canBuy: !maxed && XP_COSTS.attribute <= available,
        maxed,
      };
    });

    context.backgrounds = packs.backgrounds
      .map((doc) => ({
        id: doc.id,
        name: doc.name,
        owned: existingBackgrounds.has(doc.name),
        description: doc.system.description ?? "",
        vantage: listValue(doc.system.vantage),
      }))
      .sort((a, b) => a.name.localeCompare(b.name));

    context.history = [...(system.advancement?.history ?? [])]
      .map((entry) => ({
        ...entry,
        dateLabel: entry.date ? new Date(entry.date).toLocaleString() : "",
        canUndo: Boolean(entry.targetId || entry.targetName || entry.key),
      }))
      .reverse();

    return context;
  }

  _onRender(context, options) {
    super._onRender(context, options);
    const form = this.element.querySelector(".advancement-form");
    if (!form) return;

    const update = () => this.#updateLivePreview(form);
    form.querySelectorAll("input, select, textarea").forEach((input) => {
      input.addEventListener("input", update);
      input.addEventListener("change", update);
    });
    form.querySelector("[data-talent-search]")?.addEventListener("input", () => this.#filterTalents(form));
    form.querySelector("[data-talent-category]")?.addEventListener("change", () => this.#filterTalents(form));
    form.querySelector("[data-talent-affordable]")?.addEventListener("change", () => this.#filterTalents(form));

    this.#showStep(form, this.#step);
    this.#filterTalents(form);
    update();
  }

  #showStep(form, step) {
    this.#step = Math.max(0, Math.min(STEPS.length - 1, Number(step) || 0));
    form.querySelectorAll("[data-builder-step-panel]").forEach((panel) => {
      panel.classList.toggle("active", Number(panel.dataset.builderStepPanel) === this.#step);
    });
    form.querySelectorAll("[data-builder-step]").forEach((button) => {
      button.classList.toggle("active", Number(button.dataset.builderStep) === this.#step);
    });
    form.querySelector("[data-action='previousStep']").disabled = this.#step === 0;
    form.querySelector("[data-action='nextStep']").disabled = this.#step === STEPS.length - 1;
    form.querySelector("[data-action='purchase']").hidden = STEPS[this.#step] === "history";
    this.#updateLivePreview(form);
  }

  #updateLivePreview(form) {
    const purchase = this.#readPurchase(form);
    const status = form.querySelector(".builder-status");
    if (status) {
      status.classList.toggle("is-valid", purchase.valid);
      status.textContent = purchase.message;
    }

    for (const panel of form.querySelectorAll("[data-builder-step-panel]")) {
      const warning = panel.querySelector("[data-builder-warning]");
      if (!warning) continue;
      const isActive = Number(panel.dataset.builderStepPanel) === this.#step;
      warning.textContent = isActive && !purchase.valid && STEPS[this.#step] !== "history" ? purchase.message : "";
      warning.hidden = !warning.textContent;
    }

    form.querySelector("[data-action='purchase']").disabled = !purchase.valid;
    form.querySelector("[data-advancement-selected-label]").textContent = purchase.label || game.i18n.localize("DREADLIGHT.AdvancementNoSelection");
    form.querySelector("[data-advancement-selected-cost]").textContent = purchase.cost ? String(purchase.cost) : "-";
    form.querySelectorAll("[data-advancement-choice-row]").forEach((row) => {
      const input = row.querySelector("input[type='radio']");
      row.classList.toggle("is-selected", input?.checked ?? false);
    });
    this.#updateBackgroundPreview(form);
  }

  #updateBackgroundPreview(form) {
    const select = form.elements.backgroundId;
    const option = select?.selectedOptions?.[0];
    const isCustom = option?.value === CUSTOM_BACKGROUND_VALUE;
    form.querySelector("[data-advancement-custom-background]")?.classList.toggle("active", isCustom);
    form.querySelector("[data-background-description]").textContent = isCustom
      ? form.elements.customBackgroundDesc?.value ?? ""
      : option?.dataset.description ?? "";
    form.querySelector("[data-background-vantage]").textContent = isCustom
      ? form.elements.customBackgroundVantage?.value ?? ""
      : String(option?.dataset.vantage ?? "").replaceAll(";", ", ");
  }

  #readPurchase(form) {
    const available = availableXp(this.actor.system);
    const step = STEPS[this.#step];
    if (step === "talents") {
      const selected = form.querySelector("input[name='talentId']:checked");
      if (!selected) return { valid: false, cost: 0, label: "", message: game.i18n.localize("DREADLIGHT.AdvancementChooseTalent") };
      const cost = Number(selected.dataset.cost) || 0;
      const label = selected.dataset.label ?? "";
      if (cost > available) return { valid: false, cost, label, message: game.i18n.format("DREADLIGHT.AdvancementNotEnoughXP", { cost, available }) };
      return { valid: true, type: "talent", cost, label, message: game.i18n.format("DREADLIGHT.AdvancementReady", { label, cost }) };
    }
    if (step === "attributes") {
      const selected = form.querySelector("input[name='attributeKey']:checked");
      if (!selected) return { valid: false, cost: 0, label: "", message: game.i18n.localize("DREADLIGHT.AdvancementChooseAttribute") };
      const cost = Number(selected.dataset.cost) || 0;
      const label = selected.dataset.label ?? "";
      if (cost > available) return { valid: false, cost, label, message: game.i18n.format("DREADLIGHT.AdvancementNotEnoughXP", { cost, available }) };
      return { valid: true, type: "attribute", cost, label, message: game.i18n.format("DREADLIGHT.AdvancementReady", { label, cost }) };
    }
    if (step === "backgrounds") {
      const selected = form.elements.backgroundId?.selectedOptions?.[0];
      const value = selected?.value ?? "";
      const customName = form.elements.customBackgroundName?.value.trim() ?? "";
      const note = form.elements.backgroundNote?.value.trim() ?? "";
      const label = value === CUSTOM_BACKGROUND_VALUE ? customName : selected?.textContent?.trim() ?? "";
      const cost = XP_COSTS.background;
      if (!value) return { valid: false, cost: 0, label: "", message: game.i18n.localize("DREADLIGHT.AdvancementChooseBackground") };
      if (!label) return { valid: false, cost, label: "", message: game.i18n.localize("DREADLIGHT.AdvancementCustomBackgroundName") };
      if (selected?.disabled) return { valid: false, cost, label, message: game.i18n.localize("DREADLIGHT.AdvancementBackgroundOwned") };
      if (!note) return { valid: false, cost, label, message: game.i18n.localize("DREADLIGHT.AdvancementBackgroundNote") };
      if (cost > available) return { valid: false, cost, label, message: game.i18n.format("DREADLIGHT.AdvancementNotEnoughXP", { cost, available }) };
      return { valid: true, type: "background", cost, label, message: game.i18n.format("DREADLIGHT.AdvancementReady", { label, cost }) };
    }
    return { valid: false, cost: 0, label: "", message: game.i18n.localize("DREADLIGHT.AdvancementHistoryOnly") };
  }

  #filterTalents(form) {
    const search = String(form.querySelector("[data-talent-search]")?.value ?? "").trim().toLowerCase();
    const category = form.querySelector("[data-talent-category]")?.value ?? "";
    const affordableOnly = form.querySelector("[data-talent-affordable]")?.checked ?? false;
    let visible = 0;
    for (const row of form.querySelectorAll("[data-advancement-talent-row]")) {
      const matchesSearch = !search || String(row.dataset.talentSearch ?? "").toLowerCase().includes(search);
      const matchesCategory = !category || row.dataset.talentCategory === category;
      const matchesAffordable = !affordableOnly || row.dataset.affordable === "true";
      const show = matchesSearch && matchesCategory && matchesAffordable;
      row.hidden = !show;
      if (show) visible += 1;
    }
    const count = form.querySelector("[data-talent-visible-count]");
    if (count) count.textContent = game.i18n.format("DREADLIGHT.AdvancementTalentCount", { visible });
  }

  async #spend(cost, entry, updateData = {}) {
    const system = this.actor.system;
    const history = foundry.utils.deepClone(system.advancement?.history ?? []);
    history.push(entry);
    await this.actor.update({
      ...updateData,
      "system.advancement.spent": (Number(system.advancement?.spent) || 0) + cost,
      "system.advancement.history": history,
    });
  }

  #historyWithout(id) {
    return foundry.utils.deepClone(this.actor.system.advancement?.history ?? []).filter((entry) => entry.id !== id);
  }

  async #updateHistoryEntry(id, updateEntry) {
    const system = this.actor.system;
    const history = foundry.utils.deepClone(system.advancement?.history ?? []);
    const index = history.findIndex((entry) => entry.id === id);
    if (index < 0) return false;

    const previousCost = Number(history[index].cost) || 0;
    history[index] = { ...history[index], ...updateEntry };
    const nextCost = Number(history[index].cost) || 0;
    await this.actor.update({
      "system.advancement.spent": Math.max(0, (Number(system.advancement?.spent) || 0) + nextCost - previousCost),
      "system.advancement.history": history,
    });
    return true;
  }

  async #removeHistoryEntry(id) {
    const system = this.actor.system;
    const history = foundry.utils.deepClone(system.advancement?.history ?? []);
    const entry = history.find((item) => item.id === id);
    if (!entry) return false;

    await this.actor.update({
      "system.advancement.spent": Math.max(0, (Number(system.advancement?.spent) || 0) - (Number(entry.cost) || 0)),
      "system.advancement.history": history.filter((item) => item.id !== id),
    });
    return true;
  }

  async #undoHistoryEntry(id) {
    const system = this.actor.system;
    const history = foundry.utils.deepClone(system.advancement?.history ?? []);
    const entry = history.find((item) => item.id === id);
    if (!entry) return false;

    const targetName = String(entry.targetName ?? "");
    const from = Number(entry.from) || 0;
    const to = Number(entry.to) || 0;
    const updateData = {
      "system.advancement.spent": Math.max(0, (Number(system.advancement?.spent) || 0) - (Number(entry.cost) || 0)),
      "system.advancement.history": this.#historyWithout(id),
    };

    if (entry.type === "talent") {
      const talent = this.actor.items.get(entry.targetId) ?? this.actor.items.find((item) => item.type === "talent" && item.name === targetName);
      if (!talent || !targetName) return false;
      if (from <= 0) await this.actor.deleteEmbeddedDocuments("Item", [talent.id]);
      else await talent.update({ "system.level": from });
    } else if (entry.type === "attribute") {
      const key = String(entry.key ?? "");
      const track = String(entry.track ?? TRACK_BY_ATTRIBUTE[key] ?? "");
      if (!ATTRIBUTES.includes(key) || !track) return false;

      const delta = Math.max(1, to - from);
      const trackData = system.tracks?.[track];
      const nextMax = Math.max(0, (Number(trackData?.max) || 0) - delta);
      updateData[`system.attributes.${key}.value`] = from;
      updateData[`system.tracks.${track}.max`] = nextMax;
      updateData[`system.tracks.${track}.value`] = Math.min(nextMax, Math.max(0, (Number(trackData?.value) || 0) - delta));
    } else if (entry.type === "background") {
      const backgrounds = foundry.utils.deepClone(system.backgrounds ?? []);
      const index = backgrounds.findLastIndex((background) => background.name === targetName);
      if (index < 0 || !targetName) return false;
      backgrounds.splice(index, 1);
      updateData["system.backgrounds"] = backgrounds;
    } else {
      return false;
    }

    await this.actor.update(updateData);
    return true;
  }

  static #previousStep(event, target) {
    const form = this.element.querySelector(".advancement-form");
    this.#showStep(form, this.#step - 1);
  }

  static #nextStep(event, target) {
    const form = this.element.querySelector(".advancement-form");
    this.#showStep(form, this.#step + 1);
  }

  static #goStep(event, target) {
    const form = this.element.querySelector(".advancement-form");
    this.#showStep(form, Number(target.dataset.builderStep));
  }

  static async #purchase(event, target) {
    const form = this.element.querySelector(".advancement-form");
    const purchase = this.#readPurchase(form);
    if (!purchase.valid) {
      ui.notifications.warn(purchase.message);
      return;
    }

    if (purchase.type === "talent") await this.#purchaseTalent(form, purchase);
    else if (purchase.type === "attribute") await this.#purchaseAttribute(form, purchase);
    else if (purchase.type === "background") await this.#purchaseBackground(form, purchase);

    ui.notifications.info(game.i18n.format("DREADLIGHT.AdvancementPurchased", { label: purchase.label, cost: purchase.cost }));
    this.render({ force: true });
    this.actor.sheet?.render(true);
  }

  static async #updateHistory(event, target) {
    if (!game.user.isGM) return;
    const row = target.closest("[data-advancement-history-entry]");
    if (!row) return;

    const label = row.querySelector("[name='historyLabel']")?.value.trim() ?? "";
    const cost = Math.max(0, Math.floor(Number(row.querySelector("[name='historyCost']")?.value) || 0));
    const note = row.querySelector("[name='historyNote']")?.value.trim() ?? "";
    if (!label) {
      ui.notifications.warn(game.i18n.localize("DREADLIGHT.AdvancementHistoryLabelRequired"));
      return;
    }

    const updated = await this.#updateHistoryEntry(row.dataset.entryId, { label, cost, note });
    if (updated) ui.notifications.info(game.i18n.localize("DREADLIGHT.AdvancementHistoryUpdated"));
    this.render({ force: true });
    this.actor.sheet?.render(true);
  }

  static async #removeHistory(event, target) {
    if (!game.user.isGM) return;
    const id = target.closest("[data-advancement-history-entry]")?.dataset.entryId;
    if (!id) return;
    if (!window.confirm(game.i18n.localize("DREADLIGHT.AdvancementHistoryRemoveConfirm"))) return;

    const removed = await this.#removeHistoryEntry(id);
    if (removed) ui.notifications.info(game.i18n.localize("DREADLIGHT.AdvancementHistoryRemoved"));
    this.render({ force: true });
    this.actor.sheet?.render(true);
  }

  static async #undoHistory(event, target) {
    if (!game.user.isGM) return;
    const id = target.closest("[data-advancement-history-entry]")?.dataset.entryId;
    if (!id) return;
    if (!window.confirm(game.i18n.localize("DREADLIGHT.AdvancementHistoryUndoConfirm"))) return;

    const undone = await this.#undoHistoryEntry(id);
    if (!undone) {
      ui.notifications.warn(game.i18n.localize("DREADLIGHT.AdvancementHistoryUndoUnavailable"));
      return;
    }
    ui.notifications.info(game.i18n.localize("DREADLIGHT.AdvancementHistoryUndone"));
    this.render({ force: true });
    this.actor.sheet?.render(true);
  }

  async #purchaseTalent(form, purchase) {
    const selected = form.querySelector("input[name='talentId']:checked");
    const packs = await loadAdvancementPacks();
    const doc = packs.talents.find((talent) => talent.id === selected.value);
    if (!doc) return;

    const existing = this.actor.items.find((item) => item.type === "talent" && item.name === doc.name);
    const currentLevel = Math.min(3, Number(existing?.system.level) || 0);
    const nextLevel = Math.min(3, currentLevel + 1);
    const note = form.elements.talentNote?.value.trim() ?? "";
    let talentItem = existing;
    if (existing) {
      await existing.update({ "system.level": nextLevel });
    } else {
      const data = doc.toObject();
      delete data._id;
      data.system.level = nextLevel;
      [talentItem] = await this.actor.createEmbeddedDocuments("Item", [data]);
    }

    const label = currentLevel
      ? game.i18n.format("DREADLIGHT.AdvancementTalentIncreaseLabel", { name: doc.name, from: currentLevel, to: nextLevel })
      : game.i18n.format("DREADLIGHT.AdvancementTalentLearnLabel", { name: doc.name, to: nextLevel });
    await this.#spend(purchase.cost, historyEntry("talent", label, purchase.cost, note, {
      targetId: talentItem?.id ?? "",
      targetName: doc.name,
      from: currentLevel,
      to: nextLevel,
    }));
  }

  async #purchaseAttribute(form, purchase) {
    const selected = form.querySelector("input[name='attributeKey']:checked");
    const attr = selected.value;
    const system = this.actor.system;
    const current = Number(system.attributes?.[attr]?.value) || 0;
    const { next, maxed } = currentAttributeCap(system, attr);
    if (maxed) return;

    const track = TRACK_BY_ATTRIBUTE[attr];
    const trackData = system.tracks?.[track];
    const note = form.elements.attributeNote?.value.trim() ?? "";
    const label = game.i18n.format("DREADLIGHT.AdvancementAttributeLabel", {
      name: game.i18n.localize(CONFIG.DREADLIGHT.attributeLabels[attr]),
      from: current,
      to: next,
    });
    await this.#spend(purchase.cost, historyEntry("attribute", label, purchase.cost, note, {
      key: attr,
      track,
      from: current,
      to: next,
    }), {
      [`system.attributes.${attr}.value`]: next,
      [`system.tracks.${track}.value`]: Math.min((Number(trackData?.value) || 0) + 1, (Number(trackData?.max) || 0) + 1),
      [`system.tracks.${track}.max`]: (Number(trackData?.max) || 0) + 1,
    });
  }

  async #purchaseBackground(form, purchase) {
    const packs = await loadAdvancementPacks();
    const selected = form.elements.backgroundId?.selectedOptions?.[0];
    const value = selected?.value ?? "";
    const isCustom = value === CUSTOM_BACKGROUND_VALUE;
    const doc = packs.backgrounds.find((background) => background.id === value);
    const background = isCustom
      ? {
        name: form.elements.customBackgroundName?.value.trim() ?? "",
        desc: form.elements.customBackgroundDesc?.value.trim() ?? "",
        vantage: form.elements.customBackgroundVantage?.value.trim() ?? "",
      }
      : {
        name: doc?.name ?? selected?.textContent?.trim() ?? "",
        desc: doc?.system.description ?? selected?.dataset.description ?? "",
        vantage: doc ? toDelimited(doc.system.vantage) : selected?.dataset.vantage ?? "",
      };
    if (!background.name) return;

    const note = form.elements.backgroundNote?.value.trim() ?? "";
    const backgrounds = foundry.utils.deepClone(this.actor.system.backgrounds ?? []);
    backgrounds.push(background);
    const label = game.i18n.format("DREADLIGHT.AdvancementBackgroundLabel", { name: background.name });
    await this.#spend(purchase.cost, historyEntry("background", label, purchase.cost, note, {
      targetName: background.name,
    }), {
      "system.backgrounds": backgrounds,
    });
  }

  static #cancel(event, target) {
    this.close();
  }
}
