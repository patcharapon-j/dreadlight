import { DreadlightRoll } from "./dreadlight-roll.mjs";

export async function sendRollToChat(roll) {
  const templateData = roll.toTemplateData();
  const content = await renderTemplate("systems/dreadlight/templates/chat/roll-result.hbs", templateData);

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

export function registerChatListeners() {
  Hooks.on("renderChatMessage", (message, html) => {
    // html is a jQuery object for renderChatMessage hook
    const pushBtn = html[0]?.querySelector(".push-btn") || html.find(".push-btn")[0];
    if (!pushBtn) return;

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

      const templateData = roll.toTemplateData();
      const content = await renderTemplate("systems/dreadlight/templates/chat/roll-result.hbs", templateData);

      await message.update({
        content,
        "flags.dreadlight.rollData.pushed": true,
        "flags.dreadlight.rollData.baseResults": roll.baseResults,
        "flags.dreadlight.rollData.dreadResults": roll.dreadResults,
        "flags.dreadlight.rollData.gearResults": roll.gearResults,
      });
    });
  });
}
