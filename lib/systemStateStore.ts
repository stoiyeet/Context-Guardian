import { getMongoDb, hasMongoConfig } from "@/lib/mongo";

type SystemStateDoc = {
  _id: string;
  payload: unknown;
  updatedAt: string;
};

const COLLECTION_NAME = "system_state";

export async function readSystemState<T>(key: string): Promise<T | null> {
  if (!hasMongoConfig()) {
    return null;
  }

  try {
    const db = await getMongoDb();
    const doc = await db.collection<SystemStateDoc>(COLLECTION_NAME).findOne({ _id: key });
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
    const db = await getMongoDb();
    await db.collection<SystemStateDoc>(COLLECTION_NAME).updateOne(
      { _id: key },
      {
        $set: {
          payload,
          updatedAt: new Date().toISOString(),
        },
      },
      { upsert: true },
    );
    return true;
  } catch {
    return false;
  }
}
