import { connectMongo, hasMongoConfig } from "@/lib/mongo";
import { SystemStateModel } from "@/models/SystemState";

export async function readSystemState<T>(key: string): Promise<T | null> {
  if (!hasMongoConfig()) {
    return null;
  }

  try {
    await connectMongo();
    const doc = await SystemStateModel.findById(key).lean().exec();
    if (!doc) {
      return null;
    }
    return doc.payload as T;
  } catch {
    return null;
  }
}

export async function writeSystemState(key: string, payload: unknown): Promise<boolean> {
  if (!hasMongoConfig()) {
    return false;
  }

  try {
    await connectMongo();
    await SystemStateModel.updateOne(
      { _id: key },
      {
        $set: {
          payload,
          updatedAt: new Date().toISOString(),
        },
      },
      { upsert: true },
    ).exec();
    return true;
  } catch {
    return false;
  }
}
