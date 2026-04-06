const fields = foundry.data.fields;

export class WeaponData extends foundry.abstract.TypeDataModel {
  static defineSchema() {
    return {
      weaponType: new fields.StringField({
        required: true,
        initial: "melee",
        choices: ["melee", "ranged"],
      }),

      gearBonus: new fields.NumberField({ required: true, initial: 0, min: 0, max: 4, integer: true }),

      gearBonusMax: new fields.NumberField({ required: true, initial: 0, min: 0, max: 4, integer: true }),

      damage: new fields.NumberField({ required: true, initial: 0, integer: true }),

      critThreshold: new fields.NumberField({ required: true, initial: 6, min: 1, max: 6, integer: true }),

      range: new fields.StringField({
        required: true,
        initial: "engaged",
        choices: ["engaged", "short", "medium", "long", "extreme"],
      }),

      weight: new fields.NumberField({ required: true, initial: 0, min: 0, integer: true }),

      properties: new fields.ArrayField(
        new fields.StringField({ required: true, initial: "" })
      ),

      notes: new fields.HTMLField({ required: true, initial: "" }),
    };
  }
}
