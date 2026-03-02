import mongoose from "mongoose";

const uri = process.env.MONGODB_URI;
const dbName = process.env.MONGODB_DB_NAME ?? "context_guardian";

export function hasMongoConfig(): boolean {
  return Boolean(uri);
}

type CachedMongoose = {
  conn: typeof mongoose | null;
  promise: Promise<typeof mongoose> | null;
};

const globalForMongoose = globalThis as typeof globalThis & {
  __cgMongoose?: CachedMongoose;
};

const cached = globalForMongoose.__cgMongoose ?? {
  conn: null,
  promise: null,
};

globalForMongoose.__cgMongoose = cached;

export async function connectMongo(): Promise<typeof mongoose> {
  if (!uri) {
    throw new Error("MONGODB_URI is not configured.");
  }

  if (cached.conn) {
    return cached.conn;
  }

  if (!cached.promise) {
    cached.promise = mongoose.connect(uri, {
      dbName,
      serverSelectionTimeoutMS: 10_000,
    });
  }

  cached.conn = await cached.promise;
  return cached.conn;
}
