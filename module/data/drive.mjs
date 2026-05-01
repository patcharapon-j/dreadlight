const fields = foundry.data.fields;

export class DriveData extends foundry.abstract.TypeDataModel {
  static defineSchema() {
    return {
      description: new fields.HTMLField({ required: true, initial: "" }),
    };
  }
}
