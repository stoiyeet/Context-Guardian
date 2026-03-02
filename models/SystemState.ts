import { Schema, model, models, type Model } from "mongoose";

const systemStateSchema = new Schema(
  {
    _id: {
      type: String,
      required: true,
      trim: true,
    },
    payload: {
      type: Schema.Types.Mixed,
      required: true,
    },
    updatedAt: {
      type: String,
      required: true,
    },
  },
  {
    collection: "system_state",
    versionKey: false,
  },
);

export type SystemStateModelType = {
  _id: string;
  payload: unknown;
  updatedAt: string;
};

export const SystemStateModel =
  (models.SystemState as Model<SystemStateModelType>) ||
  model<SystemStateModelType>("SystemState", systemStateSchema);
