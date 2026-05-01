const { ApplicationV2, HandlebarsApplicationMixin } = foundry.applications.api;

const ATTRIBUTES = ["str", "agl", "log", "per", "ins", "emp"];
const TALENT_COSTS = { 0: 0, 1: 1, 2: 3 };
const STEPS = ["identity", "attributes", "talents", "details", "gear"];
const CUSTOM_BACKGROUND_VALUE = "__custom__";

function attrPath(attr) {
  return `system.attributes.${attr}.value`;
}

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

async function loadBuilderPacks() {
  const [backgrounds, drives, talents, weapons, armor, equipment] = await Promise.all([
    loadPackDocuments("backgrounds", "background"),
    loadPackDocuments("drives", "drive"),
    loadPackDocuments("talents", "talent"),
    loadPackDocuments("weapons", "weapon"),
    loadPackDocuments("armor", "armor"),
    loadPackDocuments("equipment", "equipment"),
  ]);
  return { backgrounds, drives, talents, weapons, armor, equipment };
}

function selectedByActorName(docs, name) {
  return docs.find((doc) => doc.name === name)?.id ?? "";
}

function customBackgroundData(docs, background) {
  if (!background?.name || selectedByActorName(docs, background.name)) {
    return { name: "", desc: "", vantage: "" };
  }
  return {
    name: background.name ?? "",
    desc: background.desc ?? "",
    vantage: background.vantage ?? "",
  };
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

function splitList(value) {
  if (Array.isArray(value)) return value;
  return String(value ?? "").split(";").map((entry) => entry.trim()).filter(Boolean);
}

function listValue(value) {
  if (Array.isArray(value)) return value.map((entry) => String(entry ?? "").trim()).filter(Boolean);
  return String(value ?? "").split(",").map((entry) => entry.trim()).filter(Boolean);
}

function localizeOrTitle(key, fallback) {
  const label = game.i18n.localize(key);
  return label === key ? fallback : label;
}

function rangeLabel(range) {
  return localizeOrTitle(`DREADLIGHT.Range${cap(range)}`, cap(range));
}

function weaponTypeLabel(type) {
  return localizeOrTitle(`DREADLIGHT.Weapon${cap(type)}`, cap(type));
}

function backgroundToActorData(doc) {
  if (!doc) return { name: "", desc: "", vantage: "" };
  return {
    name: doc.name,
    desc: doc.system.description ?? "",
    vantage: toDelimited(doc.system.vantage),
  };
}

function documentOption(doc, packName) {
  const system = doc.system;
  const typeLabel = localizeOrTitle(`DREADLIGHT.Type${cap(doc.type)}`, cap(doc.type));
  const category = system.category ?? "";
  const categoryText = category ? categoryLabel(category) : typeLabel;
  const properties = listValue(system.properties);
  const applicableTalents = listValue(system.applicableTalents);
  const gearBonus = Number(system.gearBonus) || 0;
  const gearBonusMax = Number(system.gearBonusMax) || 0;
  const weight = Number(system.weight) || 0;
  const supplyPointCost = Number(system.supplyPointCost) || 0;
  const isWeapon = doc.type === "weapon";
  const isArmor = doc.type === "armor";
  const isEquipment = doc.type === "equipment";

  return {
    id: doc.id,
    uuid: doc.uuid,
    packName,
    name: doc.name,
    type: doc.type,
    typeLabel,
    img: doc.img,
    category,
    categoryLabel: categoryText,
    description: system.description ?? system.notes ?? "",
    system,
    owned: false,
    isWeapon,
    isArmor,
    isEquipment,
    weaponType: system.weaponType ?? "",
    weaponTypeLabel: isWeapon ? weaponTypeLabel(system.weaponType ?? "") : "",
    gearBonus,
    gearBonusMax,
    hasGearBonus: gearBonus > 0 || gearBonusMax > 0,
    damage: Number(system.damage) || 0,
    critThreshold: Number(system.critThreshold) || 0,
    range: system.range ?? "",
    rangeLabel: system.range ? rangeLabel(system.range) : "",
    armorRating: Number(system.armorRating) || 0,
    armorCurrent: Number(system.armorCurrent ?? system.armorRating) || 0,
    weight,
    properties,
    hasProperties: properties.length > 0,
    applicableTalents,
    hasApplicableTalents: applicableTalents.length > 0,
    supplyPointCost,
    hasSupplyCost: supplyPointCost > 0,
  };
}

function gearGroupLabel(option) {
  if (option.isWeapon) return option.weaponType === "ranged"
    ? game.i18n.localize("DREADLIGHT.BuilderRangedWeapons")
    : game.i18n.localize("DREADLIGHT.BuilderMeleeWeapons");
  if (option.isArmor) return game.i18n.localize("DREADLIGHT.BuilderArmorGroup");
  return game.i18n.format("DREADLIGHT.BuilderEquipmentCategoryGroup", { category: option.categoryLabel });
}

function gearGroupSort(label) {
  const order = [
    game.i18n.localize("DREADLIGHT.BuilderMeleeWeapons"),
    game.i18n.localize("DREADLIGHT.BuilderRangedWeapons"),
    game.i18n.localize("DREADLIGHT.BuilderArmorGroup"),
  ];
  const index = order.indexOf(label);
  return index === -1 ? 20 : index;
}

function groupGearOptions(options) {
  const groups = new Map();
  for (const option of options) {
    const label = gearGroupLabel(option);
    if (!groups.has(label)) groups.set(label, []);
    groups.get(label).push(option);
  }
  return Array.from(groups.entries())
    .map(([label, items]) => ({
      label,
      count: items.length,
      items: items.sort((a, b) => a.name.localeCompare(b.name)),
    }))
    .sort((a, b) => gearGroupSort(a.label) - gearGroupSort(b.label) || a.label.localeCompare(b.label));
}

export class DreadlightCharacterBuilder extends HandlebarsApplicationMixin(ApplicationV2) {
  static DEFAULT_OPTIONS = {
    id: "dreadlight-character-builder-{id}",
    classes: ["dreadlight", "character-builder"],
    position: { width: 780, height: 860 },
    window: {
      title: "DREADLIGHT.CharacterBuilder",
      resizable: true,
    },
    actions: {
      apply: DreadlightCharacterBuilder.#apply,
      cancel: DreadlightCharacterBuilder.#cancel,
      adjustAttribute: DreadlightCharacterBuilder.#adjustAttribute,
      setTalentLevel: DreadlightCharacterBuilder.#setTalentLevel,
      removeSelectedTalent: DreadlightCharacterBuilder.#removeSelectedTalent,
      nextStep: DreadlightCharacterBuilder.#nextStep,
      previousStep: DreadlightCharacterBuilder.#previousStep,
      goStep: DreadlightCharacterBuilder.#goStep,
      rollSupply: DreadlightCharacterBuilder.#rollSupply,
    },
  };

  static PARTS = {
    sheet: { template: "systems/dreadlight/templates/apps/character-builder.hbs" },
  };

  #step = 0;

  constructor(actor, options = {}) {
    super(options);
    this.actor = actor;
  }

  async _prepareContext(options) {
    const context = await super._prepareContext(options);
    const system = this.actor.system;
    const packs = await loadBuilderPacks();
    const actorTalentLevels = new Map(
      this.actor.items
        .filter((item) => item.type === "talent")
        .map((item) => [item.name, Math.min(2, item.system.level ?? 0)])
    );
    const ownedItemNames = new Set(this.actor.items.map((item) => item.name));

    context.actor = this.actor;
    context.system = system;
    context.steps = STEPS.map((key, index) => ({
      key,
      index,
      label: game.i18n.localize(`DREADLIGHT.BuilderStep${cap(key)}`),
    }));
    context.selectedStep = this.#step;
    context.backgrounds = packs.backgrounds
      .map((doc) => ({
        id: doc.id,
        name: doc.name,
        description: doc.system.description ?? "",
        vantage: splitList(doc.system.vantage),
        startingGear: splitList(doc.system.startingGear),
        suggestedTalents: splitList(doc.system.suggestedTalents),
      }))
      .sort((a, b) => a.name.localeCompare(b.name));
    context.drives = packs.drives
      .map((doc) => ({ id: doc.id, name: doc.name, description: doc.system.description ?? "" }))
      .sort((a, b) => a.name.localeCompare(b.name));
    context.selectedBackground1 = selectedByActorName(packs.backgrounds, system.backgrounds?.[0]?.name);
    context.selectedBackground2 = selectedByActorName(packs.backgrounds, system.backgrounds?.[1]?.name);
    context.customBackground1 = customBackgroundData(packs.backgrounds, system.backgrounds?.[0]);
    context.customBackground2 = customBackgroundData(packs.backgrounds, system.backgrounds?.[1]);
    context.selectedDrive = selectedByActorName(packs.drives, system.details.drive);
    context.attributeRows = ATTRIBUTES.map((attr) => ({
      key: attr,
      value: system.attributes?.[attr]?.value ?? 4,
    }));
    context.talents = packs.talents
      .filter((doc) => !isDreadloreTalent(doc))
      .map((doc) => ({
        id: doc.id,
        name: doc.name,
        type: doc.type,
        img: doc.img,
        system: doc.system,
        level: actorTalentLevels.get(doc.name) ?? 0,
        selected: (actorTalentLevels.get(doc.name) ?? 0) > 0,
        categoryLabel: categoryLabel(doc.system.category ?? ""),
        primaryAttributes: doc.system.primaryAttributes ?? [],
        description: doc.system.description ?? "",
        perkName: doc.system.perkName ?? "",
        perkDescription: doc.system.perkDescription ?? "",
        masteryName: doc.system.masteryName ?? "",
        masteryDescription: doc.system.masteryDescription ?? "",
      }))
      .sort((a, b) => a.categoryLabel.localeCompare(b.categoryLabel) || a.name.localeCompare(b.name));
    context.talentCategories = Array.from(new Set(context.talents.map((talent) => talent.categoryLabel))).sort();
    context.talentPoints = context.talents.reduce((sum, t) => sum + TALENT_COSTS[t.level], 0);
    context.connectionsText = (system.details.connections ?? [])
      .map((conn) => conn.name ? `${conn.name}: ${conn.text}` : conn.text)
      .filter(Boolean)
      .join("\n");
    context.gearOptions = [
      ...packs.weapons.map((doc) => documentOption(doc, "weapons")),
      ...packs.armor.map((doc) => documentOption(doc, "armor")),
      ...packs.equipment.map((doc) => documentOption(doc, "equipment")),
    ].map((option) => ({
      ...option,
      owned: ownedItemNames.has(option.name),
    })).sort((a, b) => a.type.localeCompare(b.type) || a.name.localeCompare(b.name));
    context.gearGroups = groupGearOptions(context.gearOptions);

    return context;
  }

  _onRender(context, options) {
    super._onRender(context, options);
    const form = this.element.querySelector(".character-builder-form");
    if (!form) return;

    const update = () => this.#updateLivePreview(form);
    form.querySelectorAll("input, select, textarea").forEach((input) => {
      input.addEventListener("input", update);
      input.addEventListener("change", update);
    });
    form.querySelector("[data-talent-search]")?.addEventListener("input", () => this.#filterTalents(form));
    form.querySelector("[data-talent-category]")?.addEventListener("change", () => this.#filterTalents(form));
    form.querySelector("[data-talent-selected-only]")?.addEventListener("change", () => this.#filterTalents(form));
    this.#showStep(form, this.#step);
    update();
    this.#filterTalents(form);
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
    form.querySelector("[data-action='nextStep']").hidden = this.#step === STEPS.length - 1;
    form.querySelector("[data-action='apply']").hidden = this.#step !== STEPS.length - 1;
  }

  #updateLivePreview(form) {
    const attrs = this.#readAttributes(form);
    const attrTotal = Object.values(attrs).reduce((sum, value) => sum + value, 0);
    const sixCount = Object.values(attrs).filter((value) => value === 6).length;
    const talentPoints = this.#readTalentPoints(form);
    const body = attrs.str + attrs.agl;
    const mind = attrs.log + attrs.emp;
    const soul = attrs.ins + attrs.per;

    form.querySelector("[data-builder-total='attributes']").textContent = String(attrTotal);
    form.querySelector("[data-builder-total='talents']").textContent = String(talentPoints);
    form.querySelector("[data-track='body']").textContent = String(body);
    form.querySelector("[data-track='mind']").textContent = String(mind);
    form.querySelector("[data-track='soul']").textContent = String(soul);

    this.#updateBackgroundPreview(form);
    this.#updateDrivePreview(form);

    for (const select of form.querySelectorAll("[data-talent-level]")) {
      const level = Number(select.value) || 0;
      const cost = TALENT_COSTS[level] ?? 0;
      const row = select.closest(".builder-talent-row");
      row.querySelector("[data-talent-cost]").textContent = String(cost);
      row.classList.toggle("is-selected", level > 0);
      row.querySelector("[data-talent-level-current]").textContent = String(level);
      for (const button of row.querySelectorAll("[data-talent-level-choice]")) {
        const choice = Number(button.dataset.talentLevelChoice) || 0;
        button.classList.toggle("active", choice === level);
        button.setAttribute("aria-pressed", String(choice === level));
      }
      for (const ability of row.querySelectorAll("[data-talent-preview-level]")) {
        const previewLevel = Number(ability.dataset.talentPreviewLevel) || 0;
        ability.classList.toggle("is-earned", previewLevel > 0 && previewLevel <= level);
      }
    }
    this.#updateSelectedTalents(form);

    form.querySelector("[data-builder-budget='attributes']")?.classList.toggle("is-invalid", attrTotal !== 24 || sixCount > 1);
    form.querySelector("[data-builder-budget='talents']")?.classList.toggle("is-invalid", talentPoints > 8);
    for (const attr of ATTRIBUTES) {
      const input = form.elements[`attr-${attr}`];
      input?.closest(".builder-attr")?.classList.toggle("is-invalid", sixCount > 1 && Number(input.value) === 6);
    }

    const validation = this.#collectValidation(form);
    for (const [index, messages] of validation.stepMessages.entries()) {
      const panel = form.querySelector(`[data-builder-step-panel="${index}"]`);
      const warning = panel?.querySelector("[data-builder-warning]");
      if (warning) {
        warning.textContent = messages.join(" ");
        warning.hidden = messages.length === 0;
      }
      form.querySelector(`[data-builder-step="${index}"]`)?.classList.toggle("is-invalid", messages.length > 0);
    }
    [1, 2].forEach((index) => {
      const background = this.#readBackground(form, index, []);
      form.elements[`background${index}`]
        ?.closest("[data-background-card]")
        ?.classList.toggle("is-invalid", !background.name);
    });

    const status = form.querySelector(".builder-status");
    status.classList.toggle("is-valid", validation.messages.length === 0);
    status.textContent = validation.messages.length ? validation.messages.join(" ") : game.i18n.localize("DREADLIGHT.BuilderReady");
    this.#filterTalents(form);
  }

  #updateBackgroundPreview(form) {
    [form.elements.background1, form.elements.background2].forEach((select, index) => {
      const option = select.selectedOptions?.[0];
      const card = select.closest("[data-background-card]");
      const isCustom = option?.value === CUSTOM_BACKGROUND_VALUE;
      card?.classList.toggle("is-custom", isCustom);
      card?.classList.toggle("is-empty", !option?.value);

      const description = isCustom
        ? form.elements[`customBackground${index + 1}Desc`]?.value ?? ""
        : option?.dataset.description ?? "";
      const vantage = isCustom
        ? form.elements[`customBackground${index + 1}Vantage`]?.value ?? ""
        : option?.dataset.vantage ?? "";
      const gear = isCustom ? "" : option?.dataset.gear ?? "";
      const talents = isCustom ? "" : option?.dataset.talents ?? "";

      const setText = (selector, value, delimiter = ";") => {
        const el = card?.querySelector(selector);
        if (!el) return;
        el.textContent = String(value ?? "").replaceAll(delimiter, ", ");
        el.closest(".builder-background-detail")?.classList.toggle("is-empty", !String(value ?? "").trim());
      };
      setText("[data-background-description]", description);
      setText("[data-background-vantage]", vantage);
      setText("[data-background-gear]", gear);
      setText("[data-background-talents]", talents);
    });

    const gearPreview = form.querySelector("[data-gear-preview]");
    const gear = [form.elements.background1, form.elements.background2]
      .map((select) => select.selectedOptions?.[0]?.dataset.gear ?? "")
      .filter(Boolean)
      .join("\n");
    gearPreview.textContent = gear.replaceAll(";", ", ");
  }

  #updateDrivePreview(form) {
    const option = form.elements.drive.selectedOptions?.[0];
    const preview = form.querySelector("[data-drive-preview]");
    preview.textContent = option?.dataset.description ?? "";
  }

  #readBackground(form, index, backgroundDocs) {
    const select = form.elements[`background${index}`];
    const selected = select?.value ?? "";
    const byId = new Map(backgroundDocs.map((doc) => [doc.id, doc]));
    if (selected && selected !== CUSTOM_BACKGROUND_VALUE) {
      const doc = byId.get(selected);
      if (doc) return backgroundToActorData(doc);
      const option = select.selectedOptions?.[0];
      return {
        name: option?.textContent?.trim() ?? "",
        desc: option?.dataset.description ?? "",
        vantage: option?.dataset.vantage ?? "",
      };
    }
    const name = form.elements[`customBackground${index}Name`]?.value.trim() ?? "";
    const desc = form.elements[`customBackground${index}Desc`]?.value.trim() ?? "";
    const vantage = form.elements[`customBackground${index}Vantage`]?.value.trim() ?? "";
    if (!name && !desc && !vantage) return { name: "", desc: "", vantage: "" };
    return { name, desc, vantage };
  }

  #readAttributes(form) {
    return Object.fromEntries(ATTRIBUTES.map((attr) => {
      const input = form.elements[`attr-${attr}`];
      return [attr, Math.max(2, Math.min(6, Number(input?.value) || 2))];
    }));
  }

  #readTalentPoints(form) {
    return Array.from(form.querySelectorAll("[data-talent-level]"))
      .reduce((sum, select) => sum + (TALENT_COSTS[Number(select.value) || 0] ?? 0), 0);
  }

  #collectValidation(form) {
    const attrs = this.#readAttributes(form);
    const attrTotal = Object.values(attrs).reduce((sum, value) => sum + value, 0);
    const stepMessages = STEPS.map(() => []);
    const bg1 = this.#readBackground(form, 1, []);
    const bg2 = this.#readBackground(form, 2, []);
    if (!bg1.name || !bg2.name) stepMessages[0].push(game.i18n.localize("DREADLIGHT.BuilderBackgroundWarning"));
    if (attrTotal !== 24) stepMessages[1].push(game.i18n.format("DREADLIGHT.BuilderAttrTotalWarning", { total: attrTotal }));
    if (Object.values(attrs).filter((value) => value === 6).length > 1) stepMessages[1].push(game.i18n.localize("DREADLIGHT.BuilderAttrSixWarning"));
    const talentPoints = this.#readTalentPoints(form);
    if (talentPoints > 8) stepMessages[2].push(game.i18n.format("DREADLIGHT.BuilderTalentWarning", { total: talentPoints }));
    const messages = stepMessages.flat();
    return { messages, stepMessages };
  }

  #validate(form) {
    return this.#collectValidation(form).messages[0] ?? null;
  }

  #filterTalents(form) {
    const search = String(form.querySelector("[data-talent-search]")?.value ?? "").trim().toLowerCase();
    const category = form.querySelector("[data-talent-category]")?.value ?? "";
    const selectedOnly = form.querySelector("[data-talent-selected-only]")?.checked ?? false;
    let visible = 0;
    let selected = 0;
    for (const row of form.querySelectorAll("[data-talent-row]")) {
      const level = Number(row.querySelector("[data-talent-level]")?.value) || 0;
      if (level > 0) selected += 1;
      const matchesSearch = !search || String(row.dataset.talentSearch ?? "").toLowerCase().includes(search);
      const matchesCategory = !category || row.dataset.talentCategory === category;
      const matchesSelected = !selectedOnly || level > 0;
      const show = matchesSearch && matchesCategory && matchesSelected;
      row.hidden = !show;
      if (show) visible += 1;
    }
    const count = form.querySelector("[data-talent-visible-count]");
    if (count) count.textContent = game.i18n.format("DREADLIGHT.BuilderTalentCount", { visible, selected });
  }

  #updateSelectedTalents(form) {
    let selected = 0;
    for (const card of form.querySelectorAll("[data-selected-talent]")) {
      const select = form.querySelector(`[data-talent-level="${card.dataset.selectedTalent}"]`);
      const level = Number(select?.value) || 0;
      const cost = TALENT_COSTS[level] ?? 0;
      card.hidden = level < 1;
      card.querySelector("[data-selected-talent-level]").textContent = String(level);
      card.querySelector("[data-selected-talent-cost]").textContent = String(cost);
      if (level > 0) selected += 1;
    }
    const empty = form.querySelector("[data-selected-talents-empty]");
    if (empty) empty.hidden = selected > 0;
  }

  static #adjustAttribute(event, target) {
    const input = target.closest(".builder-attr")?.querySelector("input[data-builder-attr]");
    if (!input) return;
    const delta = Number(target.dataset.attrDelta) || 0;
    const min = Number(input.min) || 2;
    const max = Number(input.max) || 6;
    input.value = String(Math.max(min, Math.min(max, (Number(input.value) || min) + delta)));
    input.dispatchEvent(new Event("input", { bubbles: true }));
  }

  static #removeSelectedTalent(event, target) {
    const form = this.element.querySelector(".character-builder-form");
    const select = form?.querySelector(`[data-talent-level="${target.dataset.talentId}"]`);
    if (!select) return;
    select.value = "0";
    select.dispatchEvent(new Event("input", { bubbles: true }));
  }

  static #setTalentLevel(event, target) {
    const form = this.element.querySelector(".character-builder-form");
    const row = target.closest("[data-talent-row]");
    const select = row?.querySelector("[data-talent-level]");
    if (!form || !select) return;
    select.value = String(Math.max(0, Math.min(2, Number(target.dataset.talentLevelChoice) || 0)));
    select.dispatchEvent(new Event("input", { bubbles: true }));
  }

  static #nextStep(event, target) {
    const form = this.element.querySelector(".character-builder-form");
    this.#showStep(form, this.#step + 1);
  }

  static #previousStep(event, target) {
    const form = this.element.querySelector(".character-builder-form");
    this.#showStep(form, this.#step - 1);
  }

  static #goStep(event, target) {
    const form = this.element.querySelector(".character-builder-form");
    this.#showStep(form, Number(target.dataset.builderStep));
  }

  static async #apply(event, target) {
    const form = this.element.querySelector(".character-builder-form");
    const error = this.#validate(form);
    if (error) {
      ui.notifications.warn(error);
      return;
    }

    const packs = await loadBuilderPacks();
    const drive = packs.drives.find((doc) => doc.id === form.elements.drive.value);
    const attrs = this.#readAttributes(form);
    const body = attrs.str + attrs.agl;
    const mind = attrs.log + attrs.emp;
    const soul = attrs.ins + attrs.per;
    const connections = String(form.elements.connections?.value ?? "")
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter(Boolean)
      .map((line) => {
        const [name, ...textParts] = line.split(":");
        return textParts.length
          ? { name: name.trim(), text: textParts.join(":").trim() }
          : { name: "", text: line };
      });

    const updateData = {
      name: form.elements.characterName.value.trim() || this.actor.name,
      "system.concept": form.elements.concept.value.trim(),
      "system.backgrounds": [
        this.#readBackground(form, 1, packs.backgrounds),
        this.#readBackground(form, 2, packs.backgrounds),
      ],
      "system.details.anchor": form.elements.anchor.value.trim(),
      "system.details.drive": drive?.name ?? "",
      "system.details.driveDesc": form.elements.driveDesc.value.trim() || (drive?.system.description ?? ""),
      "system.details.fear": form.elements.fear.value.trim(),
      "system.details.connections": connections,
      "system.supply.value": Math.max(0, Number(form.elements.supply.value) || 0),
      "system.tracks.body.value": body,
      "system.tracks.body.max": body,
      "system.tracks.mind.value": mind,
      "system.tracks.mind.max": mind,
      "system.tracks.soul.value": soul,
      "system.tracks.soul.max": soul,
    };
    for (const [attr, value] of Object.entries(attrs)) updateData[attrPath(attr)] = value;

    await this.actor.update(updateData);
    await this.#applyTalents(form, packs.talents);
    await this.#applyGear(form);

    ui.notifications.info(game.i18n.localize("DREADLIGHT.BuilderApplied"));
    this.close();
    this.actor.sheet?.render(true);
  }

  async #applyTalents(form, talentDocs) {
    const byId = new Map(talentDocs.map((doc) => [doc.id, doc]));
    const existingByName = new Map(this.actor.items.filter((item) => item.type === "talent").map((item) => [item.name, item]));

    const creations = [];
    const updates = [];
    for (const select of form.querySelectorAll("[data-talent-level]")) {
      const level = Number(select.value) || 0;
      if (level < 1) continue;

      const doc = byId.get(select.dataset.talentLevel);
      if (!doc) continue;
      const existing = existingByName.get(doc.name);
      if (existing) {
        updates.push(existing.update({ "system.level": level }));
      } else {
        const data = doc.toObject();
        delete data._id;
        data.system.level = level;
        creations.push(data);
      }
    }

    if (creations.length) await this.actor.createEmbeddedDocuments("Item", creations);
    if (updates.length) await Promise.all(updates);
  }

  async #applyGear(form) {
    const selected = Array.from(form.querySelectorAll("[data-gear-option]:checked"));
    if (!selected.length) return;

    const existingNames = new Set(this.actor.items.map((item) => item.name));
    const creations = [];
    for (const checkbox of selected) {
      const uuid = checkbox.dataset.gearOption;
      const doc = await fromUuid(uuid);
      if (!doc || existingNames.has(doc.name)) continue;
      const data = doc.toObject();
      delete data._id;
      creations.push(data);
      existingNames.add(doc.name);
    }
    if (creations.length) await this.actor.createEmbeddedDocuments("Item", creations);
  }

  static #rollSupply(event, target) {
    const form = this.element.querySelector(".character-builder-form");
    const roll = Math.floor(Math.random() * 6) + 1 + 4;
    form.elements.supply.value = roll;
    this.#updateLivePreview(form);
  }

  static #cancel(event, target) {
    this.close();
  }
}
