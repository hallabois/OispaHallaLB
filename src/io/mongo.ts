import { MongoMemoryReplSet } from "mongodb-memory-server";
import mongoose from "mongoose";

export async function connectDatabase(uri?: string | undefined) {
  if (!uri) {
    const mongod = await MongoMemoryReplSet.create({ replSet: { count: 4 } });
    uri = mongod.getUri();
  }

  mongoose.connect(uri);
}
