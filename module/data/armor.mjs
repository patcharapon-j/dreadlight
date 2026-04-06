const fields = foundry.data.fields;

export class ArmorData extends foundry.abstract.TypeDataModel {
  static defineSchema() {
    return {
      armorRating: new fields.NumberField({ required: true, initial: 2, min: 0, max: 8, integer: true }),

      weight: new fields.NumberField({ required: true, initial: 0, min: 0, integer: true }),

      properties: new fields.ArrayField(
        new fields.StringField({ required: true, initial: "" })
      ),

      notes: new fields.HTMLField({ required: true, initial: "" }),
    };
  }
}
