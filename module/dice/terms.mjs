/**
 * Custom dice terms for Dreadlight's three pool types.
 *
 * Each is a standard six-sided die with a unique denomination so that
 * Dice So Nice can apply per-pool colorsets/presets automatically,
 * and rolls use explicit notation like `2db + 1dd + 1dg`.
 *
 * Denomination keys:
 *   db — Base die
 *   dr — Dread die
 *   dg — Gear die
 */

export class BaseDie extends foundry.dice.terms.Die {
  constructor(termData = {}) {
    super({ ...termData, faces: 6 });
  }

  /** @override */
  static DENOMINATION = "b";
}

export class DreadDie extends foundry.dice.terms.Die {
  constructor(termData = {}) {
    super({ ...termData, faces: 6 });
  }

  /** @override */
  static DENOMINATION = "r";
}

export class GearDie extends foundry.dice.terms.Die {
  constructor(termData = {}) {
    super({ ...termData, faces: 6 });
  }

  /** @override */
  static DENOMINATION = "g";
}
