/**
 * Card initiative support for the revised combat rules.
 *
 * Dreadlight cards act lowest-first, while Foundry's native combat tracker
 * sorts higher initiative values first. We keep the real rules order in a
 * combat flag with one entry per drawn card, then mirror the currently relevant
 * card back to the native combatant initiative as an inverted sort key.
 */
const MODULE_ID = "dreadlight";
const CARD_FLAG = "cardInitiative";
const INVERTED_CARD_BASE = 11;

let redrawLock = false;
let turnSyncLock = false;

export function registerCardInitiative() {
  game.dreadlight ??= {};
  game.dreadlight.drawInitiativeCards = drawInitiativeCards;
  game.dreadlight.advanceInitiativeCard = advanceInitiativeCard;
  game.dreadlight.rewindInitiativeCard = rewindInitiativeCard;
  game.dreadlight.flipInitiativeCard = flipInitiativeCard;
  game.dreadlight.swapInitiativeCards = swapInitiativeCards;
  game.dreadlight.reorderInitiativeCards = reorderInitiativeCards;

  Hooks.on("combatStart", async (combat) => {
    if (!game.user.isGM) return;
    if (!game.settings.get(MODULE_ID, "autoDrawCardInitiative")) return;
    await drawInitiativeCards(combat);
  });

  Hooks.on("updateCombat", async (combat, changes) => {
    DreadlightInitiativeTracker.render();

    if (!game.user.isGM) return;

    if (foundry.utils.hasProperty(changes, "round")) {
      if (!game.settings.get(MODULE_ID, "autoDrawCardInitiative")) return;
      if (redrawLock) return;

      const state = getCardInitiativeState(combat);
      if (state?.round === combat.round) return;
      await drawInitiativeCards(combat, { postSummary: false });
      return;
    }

    if (foundry.utils.hasProperty(changes, "turn")) {
      if (redrawLock || turnSyncLock) return;
      await _advanceFromNativeTurn(combat);
    }
  });

  Hooks.on("createCombatant", () => DreadlightInitiativeTracker.render());
  Hooks.on("createCombat", () => DreadlightInitiativeTracker.render());
  Hooks.on("updateCombatant", () => DreadlightInitiativeTracker.render());
  Hooks.on("deleteCombatant", () => DreadlightInitiativeTracker.render());
  Hooks.on("deleteCombat", () => DreadlightInitiativeTracker.render());
  Hooks.once("ready", () => DreadlightInitiativeTracker.init());
}

export async function drawInitiativeCards(combat = game.combat, { postSummary = false } = {}) {
  const combatants = combat?.combatants?.contents ?? [];
  if (!combatants.length) return;
  if (!game.user.isGM) return ui.notifications?.warn(game.i18n.localize("DREADLIGHT.InitiativeGmOnly"));

  redrawLock = true;
  try {
    const deck = _shuffledCards();
    const entries = [];
    const combatantCards = new Map();

    for (const combatant of combatants) {
      const drawCount = _drawCountForCombatant(combatant);
      const cards = [];

      for (let i = 0; i < drawCount; i++) {
        if (deck.length === 0) deck.push(..._shuffledCards());
        cards.push(deck.pop());
      }

      cards.sort((a, b) => a - b);
      combatantCards.set(combatant.id, cards);

      cards.forEach((card, index) => {
        entries.push(_makeEntry(combatant, card, index, combat.round));
      });
    }

    entries.sort(_sortEntries);
    _renumberInitiativeOrder(entries);

    const state = {
      round: combat.round,
      activeIndex: entries.findIndex(entry => !entry.spent),
      entries,
      pendingSwapKey: null,
    };

    await combat.updateEmbeddedDocuments("Combatant", _buildCombatantUpdates(combat, state, combatantCards));
    await combat.setFlag(MODULE_ID, CARD_FLAG, state);
    await _syncNativeTurn(combat, state);

    if (postSummary) await _postInitiativeSummary(combat, entries);
    DreadlightInitiativeTracker.render();
  } finally {
    redrawLock = false;
  }
}

export async function advanceInitiativeCard(combat = game.combat) {
  const state = getCardInitiativeState(combat);
  if (!state || !game.user.isGM) return;

  const current = state.entries[state.activeIndex];
  if (!current) {
    await _advanceToNextRound(combat);
    return;
  }

  if (current) current.spent = true;
  state.activeIndex = _nextReadyIndex(state.entries, state.activeIndex + 1);
  if (state.activeIndex < 0) {
    await _commitInitiativeState(combat, state);
    await _sleep(460);
    await _advanceToNextRound(combat);
    return;
  }

  await _commitInitiativeState(combat, state);
}

export async function rewindInitiativeCard(combat = game.combat) {
  const state = getCardInitiativeState(combat);
  if (!state || !game.user.isGM) return;

  const active = state.entries[state.activeIndex];
  const targetIndex = active ? state.activeIndex - 1 : state.entries.length - 1;
  if (targetIndex < 0) return;

  state.entries[targetIndex].spent = false;
  state.activeIndex = targetIndex;
  await _commitInitiativeState(combat, state);
}

export async function flipInitiativeCard(combat = game.combat, key) {
  const state = getCardInitiativeState(combat);
  if (!state || !key || !game.user.isGM) return;

  const index = state.entries.findIndex(entry => entry.key === key);
  if (index < 0) return;

  state.entries[index].spent = !state.entries[index].spent;
  if (state.entries[index].spent && index === state.activeIndex) {
    state.activeIndex = _nextReadyIndex(state.entries, index + 1);
  } else if (!state.entries[index].spent && (state.activeIndex < 0 || index < state.activeIndex)) {
    state.activeIndex = index;
  }

  await _commitInitiativeState(combat, state);
}

export async function swapInitiativeCards(combat = game.combat, sourceKey, targetKey) {
  const state = getCardInitiativeState(combat);
  if (!state || !sourceKey || !targetKey || sourceKey === targetKey || !game.user.isGM) return;

  const source = state.entries.find(entry => entry.key === sourceKey);
  const target = state.entries.find(entry => entry.key === targetKey);
  if (!source || !target) return;

  const sourceAssignment = _entryAssignment(source);
  Object.assign(source, _entryAssignment(target));
  Object.assign(target, sourceAssignment);

  state.pendingSwapKey = null;
  await _commitInitiativeState(combat, state);
}

export async function reorderInitiativeCards(combat = game.combat, sourceKey, targetKey, placement = "before") {
  const state = getCardInitiativeState(combat);
  if (!state || !sourceKey || !targetKey || sourceKey === targetKey || !game.user.isGM) return;

  const activeKey = state.entries[state.activeIndex]?.key ?? null;
  const sourceIndex = state.entries.findIndex(entry => entry.key === sourceKey);
  if (sourceIndex < 0) return;

  const [source] = state.entries.splice(sourceIndex, 1);
  const targetIndex = state.entries.findIndex(entry => entry.key === targetKey);
  if (targetIndex < 0) return;

  const insertAt = placement === "after" ? targetIndex + 1 : targetIndex;
  state.entries.splice(insertAt, 0, source);
  _renumberInitiativeOrder(state.entries);
  state.activeIndex = state.entries.findIndex(entry => entry.key === activeKey);
  if (state.activeIndex < 0) state.activeIndex = _nextReadyIndex(state.entries, 0);

  await _commitInitiativeState(combat, state);
}

export function getCardInitiativeState(combat = game.combat) {
  const state = combat?.getFlag?.(MODULE_ID, CARD_FLAG);
  if (!state?.entries?.length) return null;
  return foundry.utils.deepClone(state);
}

async function _commitInitiativeState(combat, state) {
  const activeKey = state.entries[state.activeIndex]?.key ?? null;
  state.entries.sort(_sortEntries);
  _renumberInitiativeOrder(state.entries);
  if (activeKey) state.activeIndex = state.entries.findIndex(entry => entry.key === activeKey);
  if (state.activeIndex < 0 || state.entries[state.activeIndex]?.spent) {
    state.activeIndex = _nextReadyIndex(state.entries, 0);
  }

  await combat.updateEmbeddedDocuments("Combatant", _buildCombatantUpdates(combat, state));
  await combat.setFlag(MODULE_ID, CARD_FLAG, state);
  await _syncNativeTurn(combat, state);
  DreadlightInitiativeTracker.render();
}

function _makeEntry(combatant, card, cardIndex, round) {
  return {
    key: `${combatant.id}-${round}-${cardIndex}-${foundry.utils.randomID(5)}`,
    combatantId: combatant.id,
    combatantName: combatant.name,
    actorId: combatant.actor?.id ?? null,
    actorType: combatant.actor?.type ?? null,
    img: combatant.img,
    card,
    cardIndex,
    spent: false,
  };
}

function _entryAssignment(entry) {
  return {
    combatantId: entry.combatantId,
    combatantName: entry.combatantName,
    actorId: entry.actorId,
    actorType: entry.actorType,
    img: entry.img,
  };
}

function _buildCombatantUpdates(combat, state, knownCards = null) {
  const updates = [];

  for (const combatant of combat.combatants.contents) {
    const entries = state.entries
      .filter(entry => entry.combatantId === combatant.id)
      .sort(_sortEntries);
    const cards = knownCards?.get(combatant.id) ?? entries.map(entry => entry.card).sort((a, b) => a - b);
    const ready = entries.filter(entry => !entry.spent);
    const activeCard = ready[0]?.card ?? cards[0] ?? null;
    const spentCards = entries.filter(entry => entry.spent).map(entry => entry.card);

    updates.push({
      _id: combatant.id,
      initiative: activeCard ? INVERTED_CARD_BASE - activeCard : 0,
      "flags.dreadlight.initiativeCard": activeCard,
      "flags.dreadlight.initiativeCards": cards,
      "flags.dreadlight.spentInitiativeCards": spentCards,
    });
  }

  return updates;
}

async function _syncNativeTurn(combat, state) {
  const active = state.entries[state.activeIndex];
  if (!active) return;

  const turns = combat.turns?.length ? combat.turns : combat.combatants.contents;
  const turn = turns.findIndex(combatant => combatant.id === active.combatantId);
  if (turn >= 0 && combat.turn !== turn) {
    turnSyncLock = true;
    try {
      await combat.update({ turn });
    } finally {
      turnSyncLock = false;
    }
  }
}

async function _advanceToNextRound(combat) {
  if (!combat || !game.user.isGM) return;

  redrawLock = true;
  try {
    if (typeof combat.nextRound === "function") {
      await combat.nextRound();
    } else {
      await combat.update({ round: (combat.round ?? 0) + 1, turn: 0 });
    }
  } finally {
    redrawLock = false;
  }

  await drawInitiativeCards(game.combat ?? combat, { postSummary: false });
}

async function _advanceFromNativeTurn(combat) {
  const state = getCardInitiativeState(combat);
  if (!state || state.round !== combat.round) return;

  const active = state.entries[state.activeIndex];
  const nativeTurn = combat.turns?.[combat.turn];
  if (!active || !nativeTurn || nativeTurn.id === active.combatantId) return;

  active.spent = true;
  state.activeIndex = _nextReadyIndex(state.entries, state.activeIndex + 1);
  if (state.activeIndex < 0) {
    await _commitInitiativeState(combat, state);
    await _sleep(460);
    await _advanceToNextRound(combat);
    return;
  }

  await _commitInitiativeState(combat, state);
}

function _sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function _nextReadyIndex(entries, start) {
  for (let i = start; i < entries.length; i++) {
    if (!entries[i].spent) return i;
  }
  return -1;
}

function _drawCountForCombatant(combatant) {
  const actor = combatant.actor;
  if (actor?.type !== "creature") return 1;
  return Math.min(3, Math.max(1, Number(actor.system.ferocity ?? 1)));
}

function _shuffledCards() {
  const cards = Array.from({ length: 10 }, (_, i) => i + 1);
  for (let i = cards.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [cards[i], cards[j]] = [cards[j], cards[i]];
  }
  return cards;
}

function _sortEntries(a, b) {
  const aOrder = Number.isFinite(a.order) ? a.order : null;
  const bOrder = Number.isFinite(b.order) ? b.order : null;
  if (aOrder !== null && bOrder !== null) return aOrder - bOrder;
  return (a.card - b.card) || (a.cardIndex - b.cardIndex) || a.combatantName.localeCompare(b.combatantName);
}

function _renumberInitiativeOrder(entries) {
  entries.forEach((entry, index) => {
    entry.order = index;
  });
}

async function _postInitiativeSummary(combat, entries) {
  const rows = entries
    .map(entry => `<li><strong>${_escapeHTML(entry.combatantName)}</strong>: ${game.i18n.format("DREADLIGHT.InitiativeCardValue", { card: entry.card })}</li>`)
    .join("");

  await ChatMessage.create({
    speaker: ChatMessage.getSpeaker(),
    content: `
      <div class="dreadlight initiative-summary">
        <h3>${game.i18n.format("DREADLIGHT.InitiativeRound", { round: combat.round })}</h3>
        <ol>${rows}</ol>
      </div>
    `,
    flags: {
      dreadlight: { cardInitiative: { combatId: combat.id, round: combat.round } },
    },
  });
}

function _escapeHTML(value) {
  return String(value ?? "").replace(/[&<>"']/g, char => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;",
  }[char]));
}

class DreadlightInitiativeTracker {
  static element = null;
  static pendingSwapKey = null;
  static draggingKey = null;
  static structureSignature = null;

  static init() {
    this.element = document.createElement("div");
    this.element.id = "dreadlight-initiative-tracker";
    this.element.className = "dreadlight initiative-tracker";
    this.element.addEventListener("click", event => this.#onClick(event));
    this.element.addEventListener("dragstart", event => this.#onDragStart(event));
    this.element.addEventListener("dragover", event => this.#onDragOver(event));
    this.element.addEventListener("dragleave", event => this.#onDragLeave(event));
    this.element.addEventListener("drop", event => this.#onDrop(event));
    this.element.addEventListener("dragend", () => this.#clearDragState());

    const parent = document.querySelector("#ui-top") ?? document.body;
    parent.appendChild(this.element);
    this.render();
  }

  static render() {
    if (!this.element) return;

    const combat = game.combat;
    const state = getCardInitiativeState(combat);
    if (!combat) {
      this.element.classList.add("is-hidden");
      this.element.innerHTML = "";
      this.structureSignature = null;
      return;
    }

    if (!state) {
      const signature = `${combat.id}:${combat.round}:empty`;
      if (this.structureSignature === signature && this.element.querySelector(".initiative-shell.is-empty")) return;

      const canControl = game.user.isGM;
      this.element.classList.remove("is-hidden");
      this.element.innerHTML = `
        <div class="initiative-shell is-empty" data-round="${combat.round}">
          <div class="initiative-toolbar">
            <button type="button" class="initiative-icon-btn" data-action="draw" ${canControl ? "" : "disabled"} title="${_escapeHTML(game.i18n.localize("DREADLIGHT.InitiativeDraw"))}">
              <i class="fa-solid fa-shuffle"></i>
            </button>
            <div class="initiative-title">
              <span>${_escapeHTML(game.i18n.localize("DREADLIGHT.InitiativeTracker"))}</span>
              <strong>${_escapeHTML(game.i18n.format("DREADLIGHT.InitiativeRoundShort", { round: combat.round }))}</strong>
            </div>
            <button type="button" class="initiative-icon-btn" data-action="previous" disabled title="${_escapeHTML(game.i18n.localize("DREADLIGHT.InitiativePrevious"))}">
              <i class="fa-solid fa-backward-step"></i>
            </button>
            <button type="button" class="initiative-icon-btn" data-action="next" disabled title="${_escapeHTML(game.i18n.localize("DREADLIGHT.InitiativeNext"))}">
              <i class="fa-solid fa-forward-step"></i>
            </button>
          </div>
          <div class="initiative-empty">${_escapeHTML(game.i18n.localize("DREADLIGHT.InitiativeNoCards"))}</div>
        </div>
      `;
      this.structureSignature = signature;
      return;
    }

    const signature = this.#structureSignature(combat, state);
    if (this.structureSignature === signature && this.element.querySelector(".initiative-rail")) {
      this.#updateCardState(state);
      return;
    }

    const active = state.entries[state.activeIndex];
    const canControl = game.user.isGM;
    const cards = state.entries.map((entry, index) => this.#renderCard(entry, index, state, active, canControl)).join("");

    this.element.classList.remove("is-hidden");
    this.element.innerHTML = `
      <div class="initiative-shell" data-round="${combat.round}">
        <div class="initiative-toolbar">
          <button type="button" class="initiative-icon-btn" data-action="draw" ${canControl ? "" : "disabled"} title="${_escapeHTML(game.i18n.localize("DREADLIGHT.InitiativeDraw"))}">
            <i class="fa-solid fa-shuffle"></i>
          </button>
          <div class="initiative-title">
            <span>${_escapeHTML(game.i18n.localize("DREADLIGHT.InitiativeTracker"))}</span>
            <strong>${_escapeHTML(game.i18n.format("DREADLIGHT.InitiativeRoundShort", { round: combat.round }))}</strong>
          </div>
          <button type="button" class="initiative-icon-btn" data-action="previous" ${canControl ? "" : "disabled"} title="${_escapeHTML(game.i18n.localize("DREADLIGHT.InitiativePrevious"))}">
            <i class="fa-solid fa-backward-step"></i>
          </button>
          <button type="button" class="initiative-icon-btn" data-action="next" ${canControl ? "" : "disabled"} title="${_escapeHTML(game.i18n.localize("DREADLIGHT.InitiativeNext"))}">
            <i class="fa-solid fa-forward-step"></i>
          </button>
        </div>
        <div class="initiative-rail" style="--card-count: ${state.entries.length};">${cards}</div>
      </div>
    `;
    this.structureSignature = signature;
  }

  static #renderCard(entry, index, state, active, canControl) {
    const isActive = active?.key === entry.key;
    const isPending = this.pendingSwapKey === entry.key;
    const hasPending = Boolean(this.pendingSwapKey);
    const classes = [
      "initiative-card",
      entry.actorType ? `type-${entry.actorType}` : "type-unknown",
      isActive ? "is-active" : "",
      entry.spent ? "is-spent" : "",
      isPending ? "is-pending-swap" : "",
      hasPending && !isPending ? "is-swap-target" : "",
    ].filter(Boolean).join(" ");
    const label = entry.spent ? "DREADLIGHT.InitiativeSpent" : "DREADLIGHT.InitiativeReady";
    const spentLabel = _escapeHTML(game.i18n.localize("DREADLIGHT.InitiativeSpent"));
    const spentTicker = Array.from({ length: 8 }, () => spentLabel).join("&ensp;");
    const image = _escapeHTML(entry.img || "icons/svg/mystery-man.svg");

    return `
      <article class="${classes}" data-key="${_escapeHTML(entry.key)}" draggable="${canControl ? "true" : "false"}" style="--i: ${index};">
        <button type="button" class="initiative-card-button" data-action="${hasPending && !isPending ? "finish-swap" : "select-card"}" ${canControl ? "" : "disabled"}>
          <span class="initiative-card-inner">
            <span class="initiative-card-face initiative-card-front">
              <span class="initiative-card-number">${entry.card}</span>
              <span class="initiative-card-portrait"><img src="${image}" alt="" /></span>
              <span class="initiative-card-name">${_escapeHTML(entry.combatantName)}</span>
              <span class="initiative-card-status">${_escapeHTML(game.i18n.localize(label))}</span>
            </span>
            <span class="initiative-card-face initiative-card-back">
              <span class="initiative-card-back-portrait"><img src="${image}" alt="" /></span>
              <span class="initiative-card-back-mark">${entry.card}</span>
              <span class="initiative-card-back-label">${spentTicker}</span>
            </span>
          </span>
        </button>
        <div class="initiative-card-actions">
          <button type="button" data-action="flip" ${canControl ? "" : "disabled"} title="${_escapeHTML(game.i18n.localize("DREADLIGHT.InitiativeFlip"))}">
            <i class="fa-solid fa-rotate"></i>
          </button>
          <button type="button" data-action="swap" ${canControl ? "" : "disabled"} title="${_escapeHTML(game.i18n.localize("DREADLIGHT.InitiativeSwap"))}">
            <i class="fa-solid fa-right-left"></i>
          </button>
        </div>
      </article>
    `;
  }

  static #updateCardState(state) {
    const active = state.entries[state.activeIndex];
    const hasPending = Boolean(this.pendingSwapKey);

    for (const entry of state.entries) {
      const card = Array.from(this.element.querySelectorAll(".initiative-card"))
        .find(element => element.dataset.key === entry.key);
      if (!card) continue;

      const isActive = active?.key === entry.key;
      const isPending = this.pendingSwapKey === entry.key;
      for (const className of Array.from(card.classList)) {
        if (className.startsWith("type-")) card.classList.remove(className);
      }
      card.classList.add(entry.actorType ? `type-${entry.actorType}` : "type-unknown");
      card.classList.toggle("is-active", isActive);
      card.classList.toggle("is-spent", entry.spent);
      card.classList.toggle("is-pending-swap", isPending);
      card.classList.toggle("is-swap-target", hasPending && !isPending);

      const cardButton = card.querySelector(".initiative-card-button");
      if (cardButton) cardButton.dataset.action = hasPending && !isPending ? "finish-swap" : "select-card";
      card.draggable = game.user.isGM;

      const status = card.querySelector(".initiative-card-status");
      if (status) {
        const label = entry.spent ? "DREADLIGHT.InitiativeSpent" : "DREADLIGHT.InitiativeReady";
        status.textContent = game.i18n.localize(label);
      }

      const name = card.querySelector(".initiative-card-name");
      if (name) name.textContent = entry.combatantName;

      const imageSrc = entry.img || "icons/svg/mystery-man.svg";
      for (const image of card.querySelectorAll(".initiative-card-portrait img, .initiative-card-back-portrait img")) {
        if (image.getAttribute("src") !== imageSrc) image.setAttribute("src", imageSrc);
      }
    }
  }

  static #structureSignature(combat, state) {
    const entries = state.entries
      .map(entry => `${entry.key}:${entry.card}:${entry.order ?? ""}`)
      .join("|");
    return `${combat.id}:${state.round}:${entries}`;
  }

  static async #onClick(event) {
    const target = event.target instanceof Element ? event.target : event.target?.parentElement;
    const button = target?.closest("button[data-action]");
    if (!button || button.disabled) return;

    const combat = game.combat;
    const action = button.dataset.action;
    const card = button.closest(".initiative-card");
    const key = card?.dataset.key;

    if (action === "draw") {
      this.pendingSwapKey = null;
      await drawInitiativeCards(combat);
      return;
    }

    if (action === "next") {
      this.pendingSwapKey = null;
      await advanceInitiativeCard(combat);
      return;
    }

    if (action === "previous") {
      this.pendingSwapKey = null;
      await rewindInitiativeCard(combat);
      return;
    }

    if (action === "flip") {
      this.pendingSwapKey = null;
      await flipInitiativeCard(combat, key);
      return;
    }

    if (action === "swap") {
      this.pendingSwapKey = this.pendingSwapKey === key ? null : key;
      this.render();
      return;
    }

    if (action === "finish-swap" && this.pendingSwapKey) {
      const sourceKey = this.pendingSwapKey;
      this.pendingSwapKey = null;
      await swapInitiativeCards(combat, sourceKey, key);
      return;
    }

    if (action === "select-card" && this.pendingSwapKey === key) {
      this.pendingSwapKey = null;
      this.render();
    }
  }

  static #onDragStart(event) {
    if (!game.user.isGM) return event.preventDefault();

    const card = event.target?.closest?.(".initiative-card");
    if (!card?.dataset.key) return event.preventDefault();

    this.pendingSwapKey = null;
    this.draggingKey = card.dataset.key;
    card.classList.add("is-dragging");
    event.dataTransfer.effectAllowed = "move";
    event.dataTransfer.setData("text/plain", this.draggingKey);
  }

  static #onDragOver(event) {
    if (!this.draggingKey || !game.user.isGM) return;

    const card = event.target?.closest?.(".initiative-card");
    if (!card || card.dataset.key === this.draggingKey) return;

    event.preventDefault();
    event.dataTransfer.dropEffect = "move";
    this.#clearDropTargets();

    const rect = card.getBoundingClientRect();
    const placement = event.clientX > rect.left + (rect.width / 2) ? "after" : "before";
    card.classList.add(placement === "after" ? "is-drop-after" : "is-drop-before");
  }

  static #onDragLeave(event) {
    const card = event.target?.closest?.(".initiative-card");
    if (!card?.contains(event.relatedTarget)) {
      card?.classList.remove("is-drop-before", "is-drop-after");
    }
  }

  static async #onDrop(event) {
    if (!this.draggingKey || !game.user.isGM) return;

    const card = event.target?.closest?.(".initiative-card");
    const targetKey = card?.dataset.key;
    if (!targetKey || targetKey === this.draggingKey) {
      this.#clearDragState();
      return;
    }

    event.preventDefault();
    const rect = card.getBoundingClientRect();
    const placement = event.clientX > rect.left + (rect.width / 2) ? "after" : "before";
    const sourceKey = this.draggingKey;
    this.#clearDragState();
    await reorderInitiativeCards(game.combat, sourceKey, targetKey, placement);
  }

  static #clearDragState() {
    this.draggingKey = null;
    this.#clearDropTargets();
    this.element?.querySelectorAll(".initiative-card.is-dragging")
      .forEach(card => card.classList.remove("is-dragging"));
  }

  static #clearDropTargets() {
    this.element?.querySelectorAll(".initiative-card.is-drop-before, .initiative-card.is-drop-after")
      .forEach(card => card.classList.remove("is-drop-before", "is-drop-after"));
  }
}
