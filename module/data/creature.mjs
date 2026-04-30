const fields = foundry.data.fields;

export class CreatureData extends foundry.abstract.TypeDataModel {
  static defineSchema() {
    return {
      appearance: new fields.StringField({ required: true, initial: "" }),

      threatLevel: new fields.StringField({
        required: true,
        initial: "moderate",
        choices: ["minor", "moderate", "major"],
      }),

      // Flexible 0-6 attributes — GM picks which ones matter
      attributes: new fields.ArrayField(
        new fields.SchemaField({
          attr: new fields.StringField({
            required: true,
            initial: "str",
            choices: ["str", "agl", "log", "per", "ins", "emp"],
          }),
          value: new fields.NumberField({ required: true, initial: 3, min: 1, max: 8, integer: true }),
        })
      ),

      body: new fields.SchemaField({
        value: new fields.NumberField({ required: true, initial: 6, min: 0, integer: true }),
        max: new fields.NumberField({ required: true, initial: 6, min: 1, max: 30, integer: true }),
      }),

      armor: new fields.NumberField({ required: true, initial: 0, min: 0, max: 10, integer: true }),

      ferocity: new fields.NumberField({ required: true, initial: 1, min: 1, max: 3, integer: true }),

      // 1-3 structured attacks, each independently rollable
      attacks: new fields.ArrayField(
        new fields.SchemaField({
          name: new fields.StringField({ required: true, initial: "" }),
          attribute: new fields.StringField({
            required: true,
            initial: "str",
            choices: ["str", "agl", "log", "per", "ins", "emp"],
          }),
          damage: new fields.NumberField({ required: true, initial: 1, min: 0, integer: true }),
          critThreshold: new fields.NumberField({ required: true, initial: 6, min: 1, max: 6, integer: true }),
          range: new fields.StringField({
            required: true,
            initial: "engaged",
            choices: ["engaged", "short", "medium", "long", "extreme"],
          }),
        })
      ),

      soulDamage: new fields.SchemaField({
        value: new fields.NumberField({ required: true, initial: 0, min: 0, max: 10, integer: true }),
        description: new fields.StringField({ required: true, initial: "" }),
      }),

      abilities: new fields.HTMLField({ required: true, initial: "" }),
      weakness: new fields.HTMLField({ required: true, initial: "" }),
      notes: new fields.HTMLField({ required: true, initial: "" }),
    };
  }

  prepareDerivedData() {
    // Clamp body value to max
    this.body.value = Math.min(this.body.value, this.body.max);
    this.body.broken = this.body.value === 0;
  }

  /**
   * Look up an attribute value from the flexible attributes array.
   * Returns 0 if the attribute isn't defined on this creature.
   * @param {string} attrKey — e.g. "str", "agl"
   * @returns {number}
   */
  getAttributeValue(attrKey) {
    const entry = this.attributes.find(a => a.attr === attrKey);
    return entry ? entry.value : 0;
  }
}
