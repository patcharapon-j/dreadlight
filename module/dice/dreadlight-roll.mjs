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
    // Combined Roll for DSN display
    this._dsnRoll = null;
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
    // Build a single Roll formula using custom denominations (db/dd/dg)
    // so DSN automatically applies the correct colorset per pool.
    const parts = [];
    if (this.baseDice > 0) parts.push(`${this.baseDice}db`);
    if (this.dreadDice > 0) parts.push(`${this.dreadDice}dd`);
    if (this.gearDice > 0) parts.push(`${this.gearDice}dg`);
    if (parts.length === 0) { this.evaluated = true; return this; }

    const combined = new Roll(parts.join(" + "));
    await combined.evaluate();

    // Extract results from each die term
    let termIdx = 0;
    if (this.baseDice > 0) {
      this.baseResults = combined.dice[termIdx].results.map(r => r.result);
      termIdx++;
    }
    if (this.dreadDice > 0) {
      this.dreadResults = combined.dice[termIdx].results.map(r => r.result);
      termIdx++;
    }
    if (this.gearDice > 0) {
      this.gearResults = combined.dice[termIdx].results.map(r => r.result);
      termIdx++;
    }
    this._dsnRoll = combined;
    this.evaluated = true;
    return this;
  }

  async push() {
    this.pushed = true;

    // Re-rolled dice use the same custom denominations (db/dd/dg) so DSN
    // automatically applies the correct colorset and face icons per pool.
    // Count how many dice need re-rolling per pool (not locked 1s/6s)
    const rerollCount = (results) => results.filter(v => v !== 1 && v !== 6).length;
    const baseRerolls = rerollCount(this.baseResults);
    const dreadRerolls = rerollCount(this.dreadResults);
    const gearRerolls = rerollCount(this.gearResults);

    // Build a single combined Roll for re-rolled dice so DSN animates them together
    const parts = [];
    const poolMap = []; // track which term index maps to which pool
    if (baseRerolls > 0) { parts.push(`${baseRerolls}db`); poolMap.push("base"); }
    if (dreadRerolls > 0) { parts.push(`${dreadRerolls}dd`); poolMap.push("dread"); }
    if (gearRerolls > 0) { parts.push(`${gearRerolls}dg`); poolMap.push("gear"); }

    this._dsnRoll = null;
    if (parts.length > 0) {
      const combined = new Roll(parts.join(" + "));
      await combined.evaluate();

      const merge = (results, dieTermResults) => {
        let idx = 0;
        return results.map(v => {
          if (v === 1 || v === 6) return v;
          return dieTermResults[idx++].result;
        });
      };

      for (let i = 0; i < poolMap.length; i++) {
        const pool = poolMap[i];
        if (pool === "base") this.baseResults = merge(this.baseResults, combined.dice[i].results);
        else if (pool === "dread") this.dreadResults = merge(this.dreadResults, combined.dice[i].results);
        else if (pool === "gear") this.gearResults = merge(this.gearResults, combined.dice[i].results);
      }

      this._dsnRoll = combined;
    }

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
      portraitChat: this.actor.system.portrait?.chat ?? { offsetX: 50, offsetY: 50, zoom: 1 },
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
    if (!game.dice3d || !this._dsnRoll) return;
    await game.dice3d.showForRoll(this._dsnRoll, game.user, true);
  }
}

export function buildPool({ actor, attribute, talentLevel = 0, gearBonus = 0, difficultyMod = 0, markPenalty = 0 }) {
  const system = actor.system;
  const attrValue = system.attributes[attribute].value;
  const dread = system.dread.value;
  const condition = CONFIG.DREADLIGHT.conditionMap[attribute];
  const conditionPenalty = system.conditions[condition] ? 2 : 0;
  let rawBase = attrValue + talentLevel - conditionPenalty + difficultyMod - markPenalty;
  let totalPool = Math.max(rawBase, dread);
  let dreadDice = dread;
  let baseDice = Math.max(0, totalPool - dreadDice);
  if (baseDice + dreadDice === 0) {
    if (dread > 0) dreadDice = 1;
    else baseDice = 1;
  }
  return { baseDice, dreadDice, gearDice: gearBonus, totalPool: baseDice + dreadDice + gearBonus };
}
