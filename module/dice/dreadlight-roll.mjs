export class DreadlightRoll {
  constructor(options) {
    this.baseDice = options.baseDice || 0;
    this.dreadDice = options.dreadDice || 0;
    this.gearDice = options.gearDice || 0;
    this.attribute = options.attribute;
    this.talentName = options.talentName || null;
    this.gearName = options.gearName || null;
    this.difficulty = options.difficulty || "normal";
    this.actor = options.actor;
    this.baseResults = [];
    this.dreadResults = [];
    this.gearResults = [];
    this.evaluated = false;
    this.pushed = false;
    // Store Roll instances for DSN
    this._baseRoll = null;
    this._dreadRoll = null;
    this._gearRoll = null;
  }

  get totalDice() { return this.baseDice + this.dreadDice + this.gearDice; }
  get baseSixes() { return this.baseResults.filter(r => r === 6).length; }
  get dreadSixes() { return this.dreadResults.filter(r => r === 6).length; }
  get gearSixes() { return this.gearResults.filter(r => r === 6).length; }
  get totalSixes() { return this.baseSixes + this.dreadSixes + this.gearSixes; }
  get baseOnes() { return this.baseResults.filter(r => r === 1).length; }
  get dreadOnes() { return this.dreadResults.filter(r => r === 1).length; }
  get gearOnes() { return this.gearResults.filter(r => r === 1).length; }

  get outcome() {
    if (this.totalSixes === 0) return "failure";
    if (this.dreadSixes > 0 && this.baseSixes === 0 && this.gearSixes === 0) return "dire";
    if (this.dreadSixes > 0) return "tainted";
    return "clean";
  }

  get extraSuccesses() { return Math.max(0, this.totalSixes - 1); }

  get dreadGained() {
    let dread = 0;
    if (this.outcome === "failure") dread += 1;
    if (this.outcome === "tainted" || this.outcome === "dire") dread += this.dreadSixes;
    return dread;
  }

  async evaluate() {
    if (this.baseDice > 0) {
      this._baseRoll = new Roll(`${this.baseDice}d6`);
      await this._baseRoll.evaluate();
      this.baseResults = this._baseRoll.dice[0].results.map(r => r.result);
    }
    if (this.dreadDice > 0) {
      this._dreadRoll = new Roll(`${this.dreadDice}d6`);
      await this._dreadRoll.evaluate();
      this.dreadResults = this._dreadRoll.dice[0].results.map(r => r.result);
    }
    if (this.gearDice > 0) {
      this._gearRoll = new Roll(`${this.gearDice}d6`);
      await this._gearRoll.evaluate();
      this.gearResults = this._gearRoll.dice[0].results.map(r => r.result);
    }
    this.evaluated = true;
    return this;
  }

  async push() {
    this.pushed = true;
    const reroll = async (results) => {
      const newResults = [];
      for (const val of results) {
        if (val === 1 || val === 6) {
          newResults.push(val); // locked
        } else {
          const r = new Roll("1d6");
          await r.evaluate();
          newResults.push(r.total);
        }
      }
      return newResults;
    };
    this.baseResults = await reroll(this.baseResults);
    this.dreadResults = await reroll(this.dreadResults);
    this.gearResults = await reroll(this.gearResults);
    return this;
  }

  get pushConsequences() {
    if (!this.pushed) return null;
    return {
      mindLoss: this.baseOnes,
      soulLoss: this.dreadOnes,
      gearDamage: this.gearOnes,
      dreadGain: 1,
    };
  }

  toTemplateData() {
    return {
      actor: this.actor,
      actorId: this.actor.id,
      actorImg: this.actor.img,
      actorName: this.actor.name,
      attribute: this.attribute,
      talentName: this.talentName,
      gearName: this.gearName,
      difficulty: this.difficulty,
      baseResults: this.baseResults,
      dreadResults: this.dreadResults,
      gearResults: this.gearResults,
      baseSixes: this.baseSixes,
      dreadSixes: this.dreadSixes,
      gearSixes: this.gearSixes,
      totalSixes: this.totalSixes,
      extraSuccesses: this.extraSuccesses,
      outcome: this.outcome,
      dreadGained: this.dreadGained,
      pushed: this.pushed,
      consequences: this.pushConsequences,
    };
  }

  async showDSN() {
    if (!game.dice3d) return;
    if (this._baseRoll) {
      await game.dice3d.showForRoll(this._baseRoll, game.user, true, null, false, null, { colorset: "dreadlight-base" });
    }
    if (this._dreadRoll) {
      await game.dice3d.showForRoll(this._dreadRoll, game.user, true, null, false, null, { colorset: "dreadlight-dread" });
    }
    if (this._gearRoll) {
      await game.dice3d.showForRoll(this._gearRoll, game.user, true, null, false, null, { colorset: "dreadlight-gear" });
    }
  }
}

export function buildPool({ actor, attribute, talentLevel = 0, gearBonus = 0, difficultyMod = 0 }) {
  const system = actor.system;
  const attrValue = system.attributes[attribute].value;
  const dread = system.dread.value;
  const condition = CONFIG.DREADLIGHT.conditionMap[attribute];
  const conditionPenalty = system.conditions[condition] ? 2 : 0;
  let rawBase = attrValue + talentLevel - conditionPenalty + difficultyMod;
  let totalPool = Math.max(rawBase, dread);
  let dreadDice = dread;
  let baseDice = Math.max(0, totalPool - dreadDice);
  if (baseDice + dreadDice === 0) {
    if (dread > 0) dreadDice = 1;
    else baseDice = 1;
  }
  return { baseDice, dreadDice, gearDice: gearBonus, totalPool: baseDice + dreadDice + gearBonus };
}
