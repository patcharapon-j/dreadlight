const fields = foundry.data.fields;

export class InvestigatorData extends foundry.abstract.TypeDataModel {
  static defineSchema() {
    return {
      concept: new fields.StringField({ required: true, initial: "" }),

      backgrounds: new fields.ArrayField(
        new fields.SchemaField({
          name: new fields.StringField({ required: true, initial: "" }),
          desc: new fields.StringField({ required: true, initial: "" }),
        }),
        { initial: [{ name: "", desc: "" }, { name: "", desc: "" }] }
      ),

      attributes: new fields.SchemaField({
        str: new fields.SchemaField({
          value: new fields.NumberField({ required: true, initial: 3, min: 1, max: 6, integer: true }),
        }),
        agl: new fields.SchemaField({
          value: new fields.NumberField({ required: true, initial: 3, min: 1, max: 6, integer: true }),
        }),
        log: new fields.SchemaField({
          value: new fields.NumberField({ required: true, initial: 3, min: 1, max: 6, integer: true }),
        }),
        per: new fields.SchemaField({
          value: new fields.NumberField({ required: true, initial: 3, min: 1, max: 6, integer: true }),
        }),
        ins: new fields.SchemaField({
          value: new fields.NumberField({ required: true, initial: 3, min: 1, max: 6, integer: true }),
        }),
        emp: new fields.SchemaField({
          value: new fields.NumberField({ required: true, initial: 3, min: 1, max: 6, integer: true }),
        }),
      }),

      tracks: new fields.SchemaField({
        body: new fields.SchemaField({
          value: new fields.NumberField({ required: true, initial: 6, min: 0, integer: true }),
          max: new fields.NumberField({ required: true, initial: 6, min: 0, integer: true }),
        }),
        mind: new fields.SchemaField({
          value: new fields.NumberField({ required: true, initial: 6, min: 0, integer: true }),
          max: new fields.NumberField({ required: true, initial: 6, min: 0, integer: true }),
        }),
        soul: new fields.SchemaField({
          value: new fields.NumberField({ required: true, initial: 6, min: 0, integer: true }),
          max: new fields.NumberField({ required: true, initial: 6, min: 0, integer: true }),
        }),
      }),

      dread: new fields.SchemaField({
        value: new fields.NumberField({ required: true, initial: 0, min: 0, max: 5, integer: true }),
        override: new fields.BooleanField({ required: true, initial: false }),
      }),

      details: new fields.SchemaField({
        anchor: new fields.StringField({ required: true, initial: "" }),
        drive: new fields.StringField({ required: true, initial: "" }),
        driveDesc: new fields.StringField({ required: true, initial: "" }),
        fear: new fields.StringField({ required: true, initial: "" }),
        connections: new fields.ArrayField(
          new fields.SchemaField({
            name: new fields.StringField({ required: true, initial: "" }),
            text: new fields.StringField({ required: true, initial: "" }),
          })
        ),
      }),

      advancement: new fields.SchemaField({
        xp: new fields.NumberField({ required: true, initial: 0, min: 0, integer: true }),
        spent: new fields.NumberField({ required: true, initial: 0, min: 0, integer: true }),
      }),

      supply: new fields.SchemaField({
        value: new fields.NumberField({ required: true, initial: 7, min: 0, integer: true }),
      }),

      portrait: new fields.SchemaField({
        sheet: new fields.SchemaField({
          offsetX: new fields.NumberField({ required: true, initial: 0 }),
          offsetY: new fields.NumberField({ required: true, initial: 0 }),
          zoom: new fields.NumberField({ required: true, initial: 1, min: 0.5, max: 5 }),
        }),
        chat: new fields.SchemaField({
          offsetX: new fields.NumberField({ required: true, initial: 0 }),
          offsetY: new fields.NumberField({ required: true, initial: 0 }),
          zoom: new fields.NumberField({ required: true, initial: 1, min: 0.5, max: 15 }),
        }),
      }),

      conditions: new fields.SchemaField({
        exhausted: new fields.BooleanField({ required: true, initial: false }),
        dazed: new fields.BooleanField({ required: true, initial: false }),
        confused: new fields.BooleanField({ required: true, initial: false }),
        distracted: new fields.BooleanField({ required: true, initial: false }),
        shaken: new fields.BooleanField({ required: true, initial: false }),
        disheartened: new fields.BooleanField({ required: true, initial: false }),
      }),

      marks: new fields.SchemaField({
        body: new fields.ArrayField(
          new fields.SchemaField({
            name: new fields.StringField({ required: true, initial: "" }),
            trigger: new fields.StringField({ required: true, initial: "" }),
            effect: new fields.StringField({ required: true, initial: "" }),
            benefit: new fields.StringField({ required: true, initial: "" }),
          })
        ),
        mind: new fields.ArrayField(
          new fields.SchemaField({
            name: new fields.StringField({ required: true, initial: "" }),
            trigger: new fields.StringField({ required: true, initial: "" }),
            effect: new fields.StringField({ required: true, initial: "" }),
            benefit: new fields.StringField({ required: true, initial: "" }),
          })
        ),
        soul: new fields.ArrayField(
          new fields.SchemaField({
            name: new fields.StringField({ required: true, initial: "" }),
            trigger: new fields.StringField({ required: true, initial: "" }),
            effect: new fields.StringField({ required: true, initial: "" }),
            benefit: new fields.StringField({ required: true, initial: "" }),
          })
        ),
      }),
    };
  }

  prepareDerivedData() {
    const attr = this.attributes;
    const str = attr.str.value;
    const agl = attr.agl.value;
    const log = attr.log.value;
    const per = attr.per.value;
    const ins = attr.ins.value;
    const emp = attr.emp.value;

    // Compute track maximums
    this.tracks.body.max = str + agl;
    this.tracks.mind.max = log + emp;
    this.tracks.soul.max = ins + per;

    // Clamp current values to max
    this.tracks.body.value = Math.min(this.tracks.body.value, this.tracks.body.max);
    this.tracks.mind.value = Math.min(this.tracks.mind.value, this.tracks.mind.max);
    this.tracks.soul.value = Math.min(this.tracks.soul.value, this.tracks.soul.max);

    // Auto-derive dread from soul lost unless override is true
    if (!this.dread.override) {
      const soulMax = this.tracks.soul.max;
      const soulCurrent = this.tracks.soul.value;
      const soulLost = Math.max(0, soulMax - soulCurrent);

      let dreadValue;
      if (soulLost <= 1) dreadValue = 0;
      else if (soulLost <= 3) dreadValue = 1;
      else if (soulLost <= 5) dreadValue = 2;
      else if (soulLost <= 7) dreadValue = 3;
      else if (soulLost <= 9) dreadValue = 4;
      else dreadValue = 5;

      this.dread.value = dreadValue;
    }

    // Calculate spiral (total mark count across all three arrays)
    this.spiral = (this.marks.body?.length ?? 0)
      + (this.marks.mind?.length ?? 0)
      + (this.marks.soul?.length ?? 0);

    // Calculate carry limit
    this.carryLimit = str + 4;
  }
}
