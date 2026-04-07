const fields = foundry.data.fields;

export class NpcData extends foundry.abstract.TypeDataModel {
  static defineSchema() {
    return {
      tier: new fields.StringField({
        required: true,
        initial: "minor",
        choices: ["minor", "important", "major"],
      }),

      appearance: new fields.StringField({ required: true, initial: "" }),
      notes: new fields.HTMLField({ required: true, initial: "" }),

      // Important tier: up to 3 key attributes
      keyAttributes: new fields.ArrayField(
        new fields.SchemaField({
          attr: new fields.StringField({
            required: true,
            initial: "str",
            choices: ["str", "agl", "log", "per", "ins", "emp"],
          }),
          value: new fields.NumberField({ required: true, initial: 3, min: 2, max: 5, integer: true }),
        })
      ),

      // Important tier: up to 2 key talents
      keyTalents: new fields.ArrayField(
        new fields.SchemaField({
          name: new fields.StringField({ required: true, initial: "" }),
          level: new fields.NumberField({ required: true, initial: 1, min: 0, max: 3, integer: true }),
        })
      ),

      // Important + Major: Body and Mind tracks
      body: new fields.SchemaField({
        value: new fields.NumberField({ required: true, initial: 6, min: 0, integer: true }),
        max: new fields.NumberField({ required: true, initial: 6, min: 4, max: 12, integer: true }),
      }),
      mind: new fields.SchemaField({
        value: new fields.NumberField({ required: true, initial: 6, min: 0, integer: true }),
        max: new fields.NumberField({ required: true, initial: 6, min: 4, max: 12, integer: true }),
      }),

      // Major tier: full six attributes
      attributes: new fields.SchemaField({
        str: new fields.SchemaField({
          value: new fields.NumberField({ required: true, initial: 3, min: 0, max: 6, integer: true }),
        }),
        agl: new fields.SchemaField({
          value: new fields.NumberField({ required: true, initial: 3, min: 0, max: 6, integer: true }),
        }),
        log: new fields.SchemaField({
          value: new fields.NumberField({ required: true, initial: 3, min: 0, max: 6, integer: true }),
        }),
        per: new fields.SchemaField({
          value: new fields.NumberField({ required: true, initial: 3, min: 0, max: 6, integer: true }),
        }),
        ins: new fields.SchemaField({
          value: new fields.NumberField({ required: true, initial: 3, min: 0, max: 6, integer: true }),
        }),
        emp: new fields.SchemaField({
          value: new fields.NumberField({ required: true, initial: 3, min: 0, max: 6, integer: true }),
        }),
      }),

      // Major tier: Soul track
      soul: new fields.SchemaField({
        value: new fields.NumberField({ required: true, initial: 6, min: 0, integer: true }),
        max: new fields.NumberField({ required: true, initial: 6, min: 0, integer: true }),
      }),
    };
  }

  prepareDerivedData() {
    if (this.tier === "major") {
      const attr = this.attributes;
      // Derive track maximums from attributes (same as investigator)
      this.body.max = attr.str.value + attr.agl.value;
      this.mind.max = attr.log.value + attr.emp.value;
      this.soul.max = attr.ins.value + attr.per.value;
    }

    // Clamp track values to max (Important + Major)
    if (this.tier === "important" || this.tier === "major") {
      this.body.value = Math.min(this.body.value, this.body.max);
      this.mind.value = Math.min(this.mind.value, this.mind.max);

      this.body.broken = this.body.value === 0;
      this.mind.broken = this.mind.value === 0;
    }

    if (this.tier === "major") {
      this.soul.value = Math.min(this.soul.value, this.soul.max);
      this.soul.broken = this.soul.value === 0;
    }
  }
}
