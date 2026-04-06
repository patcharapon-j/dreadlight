/**
 * Register all custom Handlebars helpers for the Dreadlight system.
 */
export function registerHandlebarsHelpers() {

  /**
   * segmentedPips(value, max, color)
   * Renders square pips grouped by 5, separated by gaps.
   * Usage: {{{segmentedPips value max "body"}}}
   */
  Handlebars.registerHelper("segmentedPips", (value, max, color) => {
    let html = "";
    for (let i = 0; i < max; i++) {
      if (i > 0 && i % 5 === 0) {
        html += `<div class="pip-gap"></div>`;
      }
      const state = i < value ? "filled" : "empty";
      html += `<div class="pip pip-${color} ${state}"></div>`;
    }
    return new Handlebars.SafeString(html);
  });

  /**
   * trackPips(value, max, color)
   * Renders simple pips (no grouping) for track displays.
   * Usage: {{{trackPips value max "body"}}}
   */
  Handlebars.registerHelper("trackPips", (value, max, color) => {
    let html = "";
    for (let i = 0; i < max; i++) {
      const state = i < value ? "filled" : "empty";
      html += `<div class="pip pip-${color} ${state}"></div>`;
    }
    return new Handlebars.SafeString(html);
  });

  /**
   * talentPips(level, colorClass)
   * 3 pips representing talent levels 1–3.
   * Usage: {{{talentPips level "talent"}}}
   */
  Handlebars.registerHelper("talentPips", (level, colorClass) => {
    let html = "";
    for (let i = 1; i <= 3; i++) {
      const state = i <= level ? "filled" : "empty";
      html += `<div class="pip pip-${colorClass} ${state}"></div>`;
    }
    return new Handlebars.SafeString(html);
  });

  /**
   * gearPips(current, max, colorClass)
   * Gear bonus pips, filled/empty.
   * Usage: {{{gearPips current max "gear"}}}
   */
  Handlebars.registerHelper("gearPips", (current, max, colorClass) => {
    let html = "";
    for (let i = 0; i < max; i++) {
      const state = i < current ? "filled" : "empty";
      html += `<div class="pip pip-${colorClass} ${state}"></div>`;
    }
    return new Handlebars.SafeString(html);
  });

  /**
   * spiralState(totalMarks)
   * Returns localized spiral state label based on mark thresholds.
   * 0–2 → Scarred, 3 → Fraying, 4 → Unraveling, 5+ → Final Session
   */
  Handlebars.registerHelper("spiralState", (totalMarks) => {
    if (totalMarks >= 5) return game.i18n.localize("DREADLIGHT.SpiralFinalSession");
    if (totalMarks >= 4) return game.i18n.localize("DREADLIGHT.SpiralUnraveling");
    if (totalMarks >= 3) return game.i18n.localize("DREADLIGHT.SpiralFraying");
    if (totalMarks >= 1) return game.i18n.localize("DREADLIGHT.SpiralScarred");
    return game.i18n.localize("DREADLIGHT.SpiralUnmarked");
  });

  /**
   * eq(a, b) — Equality check. Works as subexpression: {{#if (eq a b)}}
   */
  Handlebars.registerHelper("eq", (a, b) => a === b);

  /**
   * add(a, b) — Math addition.
   */
  Handlebars.registerHelper("add", (a, b) => Number(a) + Number(b));

  /**
   * times(n, block) — Repeat block N times, passing {index} to context.
   * Usage: {{#times 5}}{{index}}{{/times}}
   */
  Handlebars.registerHelper("times", function (n, block) {
    let result = "";
    for (let i = 0; i < n; i++) {
      result += block.fn({ index: i });
    }
    return result;
  });

  /**
   * attrAbbr(attr) — Localize attribute abbreviation.
   * e.g. "str" → "STR"
   */
  Handlebars.registerHelper("attrAbbr", (attr) => {
    const key = `DREADLIGHT.Attribute${attr.charAt(0).toUpperCase() + attr.slice(1)}Abbr`;
    return game.i18n.localize(key);
  });

  /**
   * attrName(attr) — Localize attribute full name.
   * e.g. "str" → "Strength". Uses CONFIG.DREADLIGHT.attributeLabels.
   */
  Handlebars.registerHelper("attrName", (attr) => {
    const key = CONFIG.DREADLIGHT?.attributeLabels?.[attr];
    return key ? game.i18n.localize(key) : attr;
  });

  /**
   * conditionName(attr) — Get condition name from attribute key.
   * e.g. "str" → "Exhausted". Uses CONFIG.DREADLIGHT.conditionMap.
   */
  Handlebars.registerHelper("conditionName", (attr) => {
    const condition = CONFIG.DREADLIGHT?.conditionMap?.[attr];
    if (!condition) return attr;
    const key = `DREADLIGHT.Condition${condition.charAt(0).toUpperCase() + condition.slice(1)}`;
    return game.i18n.localize(key);
  });

  /**
   * conditionActive(conditions, attr) — Check if the condition for an attribute is active.
   * conditions is an object like { exhausted: true, dazed: false, ... }
   */
  Handlebars.registerHelper("conditionActive", (conditions, attr) => {
    const condition = CONFIG.DREADLIGHT?.conditionMap?.[attr];
    if (!condition || !conditions) return false;
    return !!conditions[condition];
  });

  /**
   * concat(...args) — Concatenate strings.
   * Removes the Handlebars options object from the end of args.
   */
  Handlebars.registerHelper("concat", function (...args) {
    // Last argument is the Handlebars options hash — drop it
    args.pop();
    return args.join("");
  });

  /**
   * lt(a, b) — Less than comparison.
   */
  Handlebars.registerHelper("lt", (a, b) => Number(a) < Number(b));

  /**
   * gte(a, b) — Greater than or equal comparison.
   */
  Handlebars.registerHelper("gte", (a, b) => Number(a) >= Number(b));

  /**
   * capitalize(str) — Capitalize the first letter of a string.
   */
  Handlebars.registerHelper("capitalize", (str) => {
    if (!str) return "";
    return str.charAt(0).toUpperCase() + str.slice(1);
  });

  /**
   * join(arr, sep) — Join an array with a separator.
   */
  Handlebars.registerHelper("join", (arr, sep) => {
    if (!Array.isArray(arr)) return "";
    return arr.join(sep);
  });

  /**
   * and(a, b) — Logical AND.
   */
  Handlebars.registerHelper("and", (a, b) => !!a && !!b);

  /**
   * or(a, b) — Logical OR.
   */
  Handlebars.registerHelper("or", (a, b) => !!a || !!b);

  /**
   * upper(str) — Uppercase a string.
   */
  Handlebars.registerHelper("upper", (str) => {
    if (!str) return "";
    return String(str).toUpperCase();
  });

  /**
   * carryPips(used, max)
   * Renders carry capacity pips — filled for used slots, empty for free.
   * Handles fractional values: partial slot shown as a half-filled pip.
   */
  Handlebars.registerHelper("carryPips", (used, max) => {
    const total = Math.max(0, Number(max) || 0);
    const val = Math.max(0, Number(used) || 0);
    const wholeFilled = Math.floor(val);
    const hasFraction = val - wholeFilled >= 0.125; // anything ≥ ⅛ shows partial
    let html = "";
    for (let i = 0; i < total; i++) {
      if (i > 0 && i % 5 === 0) html += `<div class="pip-gap"></div>`;
      if (i < wholeFilled) {
        html += `<div class="pip pip-gold filled"></div>`;
      } else if (i === wholeFilled && hasFraction) {
        html += `<div class="pip pip-gold partial"></div>`;
      } else {
        html += `<div class="pip pip-gold empty"></div>`;
      }
    }
    return new Handlebars.SafeString(html);
  });

  /**
   * weightLabel(value) — Display a numeric weight as a nice fraction string.
   * 0.25 → "¼", 0.5 → "½", 1 → "1", 2.5 → "2½", etc.
   */
  Handlebars.registerHelper("weightLabel", (value) => {
    const num = Number(value) || 0;
    const whole = Math.floor(num);
    const frac = num - whole;
    let fracStr = "";
    if (Math.abs(frac - 0.25) < 0.01) fracStr = "¼";
    else if (Math.abs(frac - 0.5) < 0.01) fracStr = "½";
    else if (Math.abs(frac - 0.75) < 0.01) fracStr = "¾";
    if (whole === 0 && fracStr) return fracStr;
    if (fracStr) return `${whole}${fracStr}`;
    return String(whole);
  });

  console.log("Dreadlight | Handlebars helpers registered");
}
