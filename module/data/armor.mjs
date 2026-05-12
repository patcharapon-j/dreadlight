const fields = foundry.data.fields;

export class ArmorData extends foundry.abstract.TypeDataModel {
  static defineSchema() {
    return {
      armorRating: new fields.NumberField({ required: true, initial: 2, min: 0, max: 8, integer: true }),

      armorCurrent: new fields.NumberField({ required: true, initial: 2, min: 0, max: 8, integer: true }),

      weight: new fields.NumberField({ required: true, initial: 1, min: 0 }),

      // Per §16.9: only armor that is currently worn is free against carry limit.
      // Carried-but-not-worn armor counts at full slot cost.
      worn: new fields.BooleanField({ required: true, initial: true }),

      properties: new fields.ArrayField(
        new fields.StringField({ required: true, initial: "" })
      ),

      notes: new fields.HTMLField({ required: true, initial: "" }),
    };
  }
}
