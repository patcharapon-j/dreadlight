const fields = foundry.data.fields;

export class BackgroundData extends foundry.abstract.TypeDataModel {
  static defineSchema() {
    return {
      description: new fields.HTMLField({ required: true, initial: "" }),

      vantage: new fields.StringField({ required: true, initial: "" }),

      startingGear: new fields.StringField({ required: true, initial: "" }),

      suggestedTalents: new fields.StringField({ required: true, initial: "" }),
    };
  }
}
