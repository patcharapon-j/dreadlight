import { DreadlightRoll } from "./dreadlight-roll.mjs";
import { rollD66 } from "./d66-roll.mjs";

export async function sendRollToChat(roll) {
  const templateData = roll.toTemplateData();
  const content = await foundry.applications.handlebars.renderTemplate("systems/dreadlight/templates/chat/roll-result.hbs", templateData);

  return ChatMessage.create({
    speaker: ChatMessage.getSpeaker({ actor: roll.actor }),
    content,
    flags: {
      dreadlight: {
        rollData: {
          baseResults: roll.baseResults,
          dreadResults: roll.dreadResults,
          gearResults: roll.gearResults,
          baseDice: roll.baseDice,
          dreadDice: roll.dreadDice,
          gearDice: roll.gearDice,
          attribute: roll.attribute,
          talentName: roll.talentName,
          gearName: roll.gearName,
          difficulty: roll.difficulty,
          pushed: roll.pushed,
          actorId: roll.actor.id,
        },
      },
    },
  });
}

export async function sendD66ToChat(d66Result) {
  const { actor, tableKey, roll1, roll2, d66Key, entry, dsnRoll } = d66Result;

  // Show Dice So Nice animation
  if (game.dice3d && dsnRoll) {
    await game.dice3d.showForRoll(dsnRoll, game.user, true);
  }

  const templateData = {
    tableKey,
    actorImg: actor.img,
    actorName: actor.name,
    portraitChat: actor.system.portrait?.chat ?? { offsetX: 0, offsetY: 0, zoom: 1 },
    roll1, roll2, d66Key, entry,
  };

  const content = await foundry.applications.handlebars.renderTemplate(
    "systems/dreadlight/templates/chat/d66-result.hbs",
    templateData,
  );

  return ChatMessage.create({
    speaker: ChatMessage.getSpeaker({ actor }),
    content,
    flags: {
      dreadlight: {
        d66: { tableKey, roll1, roll2, d66Key, entry, actorId: actor.id },
      },
    },
  });
}

export async function sendD66PromptToChat(actor, trackKey) {
  const tableLabel = {
    body: "DREADLIGHT.D66RollCriticalInjury",
    mind: "DREADLIGHT.D66RollTrauma",
    soul: "DREADLIGHT.D66RollManifestation",
  };
  const brokenLabel = {
    body: "DREADLIGHT.D66BrokenBody",
    mind: "DREADLIGHT.D66BrokenMind",
    soul: "DREADLIGHT.D66BrokenSoul",
  };

  const templateData = {
    tableKey: trackKey,
    actorImg: actor.img,
    actorName: actor.name,
    actorId: actor.id,
    portraitChat: actor.system.portrait?.chat ?? { offsetX: 0, offsetY: 0, zoom: 1 },
    brokenMessage: game.i18n.localize(brokenLabel[trackKey]),
    rollLabel: game.i18n.localize(tableLabel[trackKey]),
  };

  const content = await foundry.applications.handlebars.renderTemplate(
    "systems/dreadlight/templates/chat/d66-prompt.hbs",
    templateData,
  );

  return ChatMessage.create({
    speaker: ChatMessage.getSpeaker({ actor }),
    content,
    flags: {
      dreadlight: {
        d66Prompt: { tableKey: trackKey, actorId: actor.id },
      },
    },
  });
}

export function registerChatListeners() {
  Hooks.on("renderChatMessageHTML", (message, html) => {
    // html is an HTMLElement in v13's renderChatMessageHTML hook
    const pushBtn = html.querySelector(".push-btn");
    if (pushBtn) {
      pushBtn.addEventListener("click", async (ev) => {
        ev.preventDefault();
        const flags = message.flags?.dreadlight?.rollData;
        if (!flags || flags.pushed) return;

        const actor = game.actors.get(flags.actorId);
        if (!actor) return;

        // Only the owning player can push
        if (!actor.isOwner) return;

        const roll = new DreadlightRoll({
          baseDice: flags.baseDice,
          dreadDice: flags.dreadDice,
          gearDice: flags.gearDice,
          attribute: flags.attribute,
          talentName: flags.talentName,
          gearName: flags.gearName,
          difficulty: flags.difficulty,
          actor,
        });

        roll.baseResults = [...flags.baseResults];
        roll.dreadResults = [...flags.dreadResults];
        roll.gearResults = [...flags.gearResults];
        roll.evaluated = true;

        await roll.push();

        // Show Dice So Nice 3D dice for the re-rolled dice, then update the card
        await roll.showDSN();

        const templateData = roll.toTemplateData();
        const content = await foundry.applications.handlebars.renderTemplate("systems/dreadlight/templates/chat/roll-result.hbs", templateData);

        await message.update({
          content,
          "flags.dreadlight.rollData.pushed": true,
          "flags.dreadlight.rollData.baseResults": roll.baseResults,
          "flags.dreadlight.rollData.dreadResults": roll.dreadResults,
          "flags.dreadlight.rollData.gearResults": roll.gearResults,
        });
      });
    }

    // D66 prompt roll button
    const d66Btn = html.querySelector(".d66-roll-btn");
    if (d66Btn) {
      d66Btn.addEventListener("click", async (ev) => {
        ev.preventDefault();
        const tableKey = d66Btn.dataset.tableKey;
        const actorId = d66Btn.dataset.actorId;
        const actor = game.actors.get(actorId);
        if (!actor) return;

        const result = await rollD66(tableKey, actor);
        await sendD66ToChat(result);
      });
    }

    // D66 apply-to-sheet button
    const applyBtn = html.querySelector(".d66-apply-btn");
    if (applyBtn) {
      // Hide if already applied
      const applied = message.flags?.dreadlight?.d66?.applied;
      if (applied) {
        applyBtn.textContent = game.i18n.localize("DREADLIGHT.D66Applied");
        applyBtn.disabled = true;
        applyBtn.classList.add("applied");
      }

      applyBtn.addEventListener("click", async (ev) => {
        ev.preventDefault();
        const d66 = message.flags?.dreadlight?.d66;
        if (!d66 || d66.applied) return;

        const actorId = applyBtn.dataset.actorId;
        const actor = game.actors.get(actorId);
        if (!actor || !actor.isOwner) return;

        const injuries = actor.system.injuries ?? [];
        await actor.update({
          "system.injuries": [...injuries, {
            track: d66.tableKey,
            d66Key: d66.d66Key,
            name: d66.entry.name,
            effect: d66.entry.effect,
            healTime: d66.entry.healTime,
            lethal: d66.entry.lethal,
          }],
        });

        // Mark as applied so button is disabled on re-render
        await message.update({ "flags.dreadlight.d66.applied": true });
      });
    }
  });
}
