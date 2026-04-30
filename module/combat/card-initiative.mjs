/**
 * Card initiative support for the revised combat rules.
 *
 * Foundry sorts larger initiative values first, while Dreadlight cards act
 * lowest-first. The stored combatant initiative is therefore an inverted sort
 * key. The true card values are kept in flags.dreadlight.initiativeCards and
 * summarized to chat whenever cards are drawn.
 */
export function registerCardInitiative() {
  game.dreadlight ??= {};
  game.dreadlight.drawInitiativeCards = drawInitiativeCards;

  Hooks.on("combatStart", async (combat) => {
    if (!game.settings.get("dreadlight", "autoDrawCardInitiative")) return;
    await drawInitiativeCards(combat);
  });

  Hooks.on("updateCombat", async (combat, changes) => {
    if (!game.settings.get("dreadlight", "autoDrawCardInitiative")) return;
    if (!foundry.utils.hasProperty(changes, "round")) return;
    await drawInitiativeCards(combat);
  });
}

export async function drawInitiativeCards(combat = game.combat) {
  const combatants = combat?.combatants?.contents ?? [];
  if (!combatants.length) return;

  const deck = _shuffledCards();
  const updates = [];
  const summary = [];

  for (const combatant of combatants) {
    const drawCount = _drawCountForCombatant(combatant);
    const cards = [];
    for (let i = 0; i < drawCount; i++) {
      if (deck.length === 0) deck.push(..._shuffledCards());
      cards.push(deck.pop());
    }

    cards.sort((a, b) => a - b);
    const actingCard = cards[0];
    updates.push({
      _id: combatant.id,
      initiative: 11 - actingCard,
      flags: {
        dreadlight: {
          initiativeCard: actingCard,
          initiativeCards: cards,
        },
      },
    });

    summary.push({ name: combatant.name, cards });
  }

  await combat.updateEmbeddedDocuments("Combatant", updates);
  await _postInitiativeSummary(combat, summary);
}

function _drawCountForCombatant(combatant) {
  const actor = combatant.actor;
  if (actor?.type !== "creature") return 1;
  return Math.min(3, Math.max(1, actor.system.ferocity ?? 1));
}

function _shuffledCards() {
  const cards = Array.from({ length: 10 }, (_, i) => i + 1);
  for (let i = cards.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [cards[i], cards[j]] = [cards[j], cards[i]];
  }
  return cards;
}

async function _postInitiativeSummary(combat, summary) {
  const rows = summary
    .sort((a, b) => a.cards[0] - b.cards[0])
    .map(({ name, cards }) => `<li><strong>${name}</strong>: ${cards.map(card => game.i18n.format("DREADLIGHT.InitiativeCardValue", { card })).join(", ")}</li>`)
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
