import { DreadlightRoll, buildPool } from "./dreadlight-roll.mjs";
import { sendRollToChat } from "./chat-message.mjs";

export class DreadlightRollDialog {
  static async create({ actor, attribute, talent = null, gearItem = null }) {
    const system = actor.system;
    const talents = actor.items
      .filter(i => i.type === "talent")
      .map(t => ({ id: t.id, name: t.name, level: t.system.level, attrs: t.system.primaryAttributes }));
    const gearItems = actor.items
      .filter(i => ["weapon", "equipment"].includes(i.type) && (i.system.gearBonus || 0) > 0)
      .map(g => ({ id: g.id, name: g.name, bonus: g.system.gearBonus }));

    const templateData = {
      actor, attribute,
      attrValue: system.attributes[attribute].value,
      talents, gearItems,
      selectedTalentId: talent?.id || "",
      selectedGearId: gearItem?.id || "",
      difficulties: CONFIG.DREADLIGHT.difficulties,
    };

    const html = await renderTemplate("systems/dreadlight/templates/dialogs/roll-dialog.hbs", templateData);

    return new Promise((resolve) => {
      const dlg = new Dialog({
        title: `${game.i18n.localize("DREADLIGHT.RollTitle")} — ${game.i18n.localize(CONFIG.DREADLIGHT.attributeLabels[attribute])}`,
        content: html,
        buttons: {
          roll: {
            icon: '<span class="roll-icon">⬡</span>',
            label: game.i18n.localize("DREADLIGHT.RollButton"),
            callback: async (dialogHtml) => {
              // dialogHtml is a jQuery object in Dialog
              const form = dialogHtml[0].querySelector("form") || dialogHtml[0];
              const talentId = form.querySelector("[name=talent]")?.value || "";
              const gearId = form.querySelector("[name=gear]")?.value || "";
              const diffChecked = form.querySelector("[name=difficulty]:checked");
              const diffMod = parseInt(diffChecked?.value || "0");

              const selectedTalent = talentId ? actor.items.get(talentId) : null;
              const selectedGear = gearId ? actor.items.get(gearId) : null;

              const pool = buildPool({
                actor, attribute,
                talentLevel: selectedTalent?.system.level || 0,
                gearBonus: selectedGear?.system.gearBonus || 0,
                difficultyMod: diffMod,
              });

              const diffName = Object.keys(CONFIG.DREADLIGHT.difficulties)
                .find(k => CONFIG.DREADLIGHT.difficulties[k] === diffMod) || "normal";

              const roll = new DreadlightRoll({
                ...pool, attribute,
                talentName: selectedTalent?.name || null,
                gearName: selectedGear?.name || null,
                difficulty: diffName,
                actor,
              });

              await roll.evaluate();
              await roll.showDSN();
              await sendRollToChat(roll);
              resolve(roll);
            },
          },
        },
        default: "roll",
        close: () => resolve(null),
      }, { classes: ["dreadlight", "roll-dialog"], width: 340 });

      dlg.render(true);
    });
  }
}
