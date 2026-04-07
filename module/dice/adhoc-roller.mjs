import { DreadlightRoll } from "./dreadlight-roll.mjs";

/**
 * Floating ad-hoc dice roller button positioned to the left of the right sidebar.
 * Click to expand a compact panel for configuring base/dread/gear dice.
 */
export function registerAdhocRoller() {
  Hooks.once("ready", () => {
    injectFloatingRoller();
  });
}

function injectFloatingRoller() {
  // Container: button + expandable panel
  const container = document.createElement("div");
  container.classList.add("adhoc-roller-float");
  container.innerHTML = `
    <button type="button" class="adhoc-toggle" title="${game.i18n.localize("DREADLIGHT.AdhocRoll")}">
      <img src="systems/dreadlight/assets/dice/success.png" class="adhoc-toggle-icon">
    </button>
    <div class="adhoc-panel" hidden>
      <div class="adhoc-pool">
        <div class="adhoc-group adhoc-group-base">
          <span class="adhoc-label">${game.i18n.localize("DREADLIGHT.Base")}</span>
          <div class="adhoc-controls">
            <button type="button" class="adhoc-btn adhoc-dec" data-pool="base">\u2212</button>
            <span class="adhoc-count" data-pool="base">0</span>
            <button type="button" class="adhoc-btn adhoc-inc" data-pool="base">+</button>
          </div>
        </div>
        <div class="adhoc-group adhoc-group-dread">
          <span class="adhoc-label">${game.i18n.localize("DREADLIGHT.Dread")}</span>
          <div class="adhoc-controls">
            <button type="button" class="adhoc-btn adhoc-dec" data-pool="dread">\u2212</button>
            <span class="adhoc-count" data-pool="dread">0</span>
            <button type="button" class="adhoc-btn adhoc-inc" data-pool="dread">+</button>
          </div>
        </div>
        <div class="adhoc-group adhoc-group-gear">
          <span class="adhoc-label">${game.i18n.localize("DREADLIGHT.Gear")}</span>
          <div class="adhoc-controls">
            <button type="button" class="adhoc-btn adhoc-dec" data-pool="gear">\u2212</button>
            <span class="adhoc-count" data-pool="gear">0</span>
            <button type="button" class="adhoc-btn adhoc-inc" data-pool="gear">+</button>
          </div>
        </div>
      </div>
      <button type="button" class="adhoc-roll-btn">${game.i18n.localize("DREADLIGHT.RollButton")}</button>
    </div>
  `;

  document.body.appendChild(container);

  // Position the button relative to the sidebar
  const sidebar = document.querySelector("#sidebar");

  function updatePosition() {
    if (sidebar) {
      const rect = sidebar.getBoundingClientRect();
      container.style.right = `${window.innerWidth - rect.left + 10}px`;
    } else {
      container.style.right = "10px";
    }
  }

  updatePosition();

  // Re-position on sidebar collapse/expand/resize/move
  if (sidebar) {
    new ResizeObserver(updatePosition).observe(sidebar);
    sidebar.addEventListener("transitionend", updatePosition);
  }
  window.addEventListener("resize", updatePosition);
  Hooks.on("collapseSidebar", () => {
    // Update immediately and again after the animation completes
    updatePosition();
    setTimeout(updatePosition, 350);
  });

  // Toggle panel
  const toggle = container.querySelector(".adhoc-toggle");
  const panel = container.querySelector(".adhoc-panel");
  toggle.addEventListener("click", () => {
    const open = !panel.hidden;
    panel.hidden = open;
    toggle.classList.toggle("active", !open);
  });

  // State
  const pool = { base: 0, dread: 0, gear: 0 };

  container.querySelectorAll(".adhoc-inc").forEach(btn => {
    btn.addEventListener("click", () => {
      const key = btn.dataset.pool;
      pool[key] = Math.min(pool[key] + 1, game.settings.get("dreadlight", "adhocMaxDice"));
      container.querySelector(`.adhoc-count[data-pool="${key}"]`).textContent = pool[key];
    });
  });

  container.querySelectorAll(".adhoc-dec").forEach(btn => {
    btn.addEventListener("click", () => {
      const key = btn.dataset.pool;
      pool[key] = Math.max(pool[key] - 1, 0);
      container.querySelector(`.adhoc-count[data-pool="${key}"]`).textContent = pool[key];
    });
  });

  container.querySelector(".adhoc-roll-btn").addEventListener("click", async () => {
    const total = pool.base + pool.dread + pool.gear;
    if (total === 0) return;

    const actor = game.user.character;

    const roll = new DreadlightRoll({
      baseDice: pool.base,
      dreadDice: pool.dread,
      gearDice: pool.gear,
      attribute: null,
      actor: actor || null,
    });

    await roll.evaluate();
    await roll.showDSN();
    await sendAdhocRollToChat(roll, actor);
  });
}

async function sendAdhocRollToChat(roll, actor) {
  const templateData = {
    userName: actor?.name || game.user.name,
    hasActor: !!actor,
    actorImg: actor?.img || null,
    portraitChat: actor?.system?.portrait?.chat ?? { offsetX: 50, offsetY: 50, zoom: 1 },
    showPortrait: game.settings.get("dreadlight", "showChatPortrait"),
    baseResults: roll.baseResults,
    dreadResults: roll.dreadResults,
    gearResults: roll.gearResults,
    baseSixes: roll.baseSixes,
    dreadSixes: roll.dreadSixes,
    gearSixes: roll.gearSixes,
    totalSixes: roll.totalSixes,
    extraSuccesses: roll.extraSuccesses,
    outcome: roll.outcome,
    omenGained: roll.omenGained,
    direFailure: roll.direFailure,
  };

  const content = await foundry.applications.handlebars.renderTemplate(
    "systems/dreadlight/templates/chat/adhoc-roll-result.hbs",
    templateData,
  );

  const speaker = actor
    ? ChatMessage.getSpeaker({ actor })
    : { alias: game.user.name };

  return ChatMessage.create({
    speaker,
    content,
    flags: {
      dreadlight: {
        adhocRoll: true,
      },
    },
  });
}
