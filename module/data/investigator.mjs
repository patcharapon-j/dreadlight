const fields = foundry.data.fields;

export class InvestigatorData extends foundry.abstract.TypeDataModel {
  static defineSchema() {
    return {
      concept: new fields.StringField({ required: true, initial: "" }),

      backgrounds: new fields.ArrayField(
        new fields.SchemaField({
          name: new fields.StringField({ required: true, initial: "" }),
          desc: new fields.StringField({ required: true, initial: "" }),
          vantage: new fields.StringField({ required: true, initial: "" }),
        }),
        { initial: [{ name: "", desc: "", vantage: "" }, { name: "", desc: "", vantage: "" }] }
      ),

      attributes: new fields.SchemaField({
        str: new fields.SchemaField({
          value: new fields.NumberField({ required: true, initial: 3, min: 0, integer: true }),
        }),
        agl: new fields.SchemaField({
          value: new fields.NumberField({ required: true, initial: 3, min: 0, integer: true }),
        }),
        log: new fields.SchemaField({
          value: new fields.NumberField({ required: true, initial: 3, min: 0, integer: true }),
        }),
        per: new fields.SchemaField({
          value: new fields.NumberField({ required: true, initial: 3, min: 0, integer: true }),
        }),
        ins: new fields.SchemaField({
          value: new fields.NumberField({ required: true, initial: 3, min: 0, integer: true }),
        }),
        emp: new fields.SchemaField({
          value: new fields.NumberField({ required: true, initial: 3, min: 0, integer: true }),
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
        value: new fields.NumberField({ required: true, initial: 0, min: 0, integer: true }),
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
        history: new fields.ArrayField(
          new fields.SchemaField({
            id: new fields.StringField({ required: true, initial: "" }),
            date: new fields.StringField({ required: true, initial: "" }),
            type: new fields.StringField({ required: true, initial: "" }),
            label: new fields.StringField({ required: true, initial: "" }),
            cost: new fields.NumberField({ required: true, initial: 0, min: 0, integer: true }),
            note: new fields.StringField({ required: true, initial: "" }),
            targetId: new fields.StringField({ required: true, initial: "" }),
            targetName: new fields.StringField({ required: true, initial: "" }),
            key: new fields.StringField({ required: true, initial: "" }),
            track: new fields.StringField({ required: true, initial: "" }),
            from: new fields.NumberField({ required: true, initial: 0, min: 0, integer: true }),
            to: new fields.NumberField({ required: true, initial: 0, min: 0, integer: true }),
          }),
          { initial: [] }
        ),
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

      injuries: new fields.ArrayField(
        new fields.SchemaField({
          track: new fields.StringField({ required: true, initial: "body" }),
          d66Key: new fields.StringField({ required: true, initial: "" }),
          name: new fields.StringField({ required: true, initial: "" }),
          effect: new fields.StringField({ required: true, initial: "" }),
          healTime: new fields.StringField({ required: true, initial: "" }),
          lethal: new fields.BooleanField({ required: true, initial: false }),
          penalty: new fields.NumberField({ required: true, initial: 0, min: 0, integer: true }),
        })
      ),

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

    // Broken state — track reaches zero
    this.tracks.body.broken = this.tracks.body.value === 0;
    this.tracks.mind.broken = this.tracks.mind.value === 0;
    this.tracks.soul.broken = this.tracks.soul.value === 0;

    // Calculate carry limit
    this.carryLimit = str + game.settings.get("dreadlight", "carryBonus");
  }
}
