/**
 * Roll on a D66 table. Two d6s: first = tens digit, second = ones digit.
 *
 * Intentionally uses standard d6 (not custom db/dd/dg) because D66 rolls
 * are table lookups that need visible numbered faces, not pool dice with
 * bane/success icons. The base colorset is applied manually so they still
 * match the system's visual theme.
 *
 * @param {string} tableKey — "body", "mind", or "soul"
 * @param {Actor} actor — the actor rolling
 * @returns {Promise<{roll1: number, roll2: number, d66Key: string, entry: object, tableKey: string, dsnRoll: Roll, actor: Actor}>}
 */
export async function rollD66(tableKey, actor) {
  const combined = new Roll("1d6 + 1d6");
  await combined.evaluate();

  // Style as Dreadlight base dice (black metal) but keep standard numbered faces
  for (const die of combined.dice) {
    const appearance = (die.options.appearance ||= {});
    appearance.colorset = "dreadlight-base";
    appearance.system = "dreadlight";
  }

  const roll1 = combined.dice[0].results[0].result;
  const roll2 = combined.dice[1].results[0].result;
  const d66Key = `${roll1}${roll2}`;

  const table = CONFIG.DREADLIGHT.d66Tables[tableKey];
  const entry = table[d66Key];

  return { roll1, roll2, d66Key, entry, tableKey, dsnRoll: combined, actor };
}
