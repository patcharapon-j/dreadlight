const fields = foundry.data.fields;

export class EquipmentData extends foundry.abstract.TypeDataModel {
  static defineSchema() {
    return {
      gearBonus: new fields.NumberField({ required: true, initial: 0, min: 0, max: 4, integer: true }),

      gearBonusMax: new fields.NumberField({ required: true, initial: 0, min: 0, max: 4, integer: true }),

      category: new fields.StringField({ required: true, initial: "general" }),

      weight: new fields.NumberField({ required: true, initial: 0, min: 0, integer: true }),

      applicableTalents: new fields.ArrayField(
        new fields.StringField({ required: true, initial: "" })
      ),

      supplyPointCost: new fields.NumberField({ required: true, initial: 0, min: 0, integer: true }),

      description: new fields.HTMLField({ required: true, initial: "" }),
    };
  }
}
