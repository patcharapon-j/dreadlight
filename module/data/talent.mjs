const fields = foundry.data.fields;

export class TalentData extends foundry.abstract.TypeDataModel {
  static defineSchema() {
    return {
      level: new fields.NumberField({ required: true, initial: 1, min: 0, max: 3, integer: true }),

      primaryAttributes: new fields.ArrayField(
        new fields.StringField({ required: true, initial: "" })
      ),

      category: new fields.StringField({ required: true, initial: "" }),

      description: new fields.HTMLField({ required: true, initial: "" }),

      perkName: new fields.StringField({ required: true, initial: "" }),

      perkDescription: new fields.HTMLField({ required: true, initial: "" }),

      masteryName: new fields.StringField({ required: true, initial: "" }),

      masteryDescription: new fields.HTMLField({ required: true, initial: "" }),
    };
  }
}
