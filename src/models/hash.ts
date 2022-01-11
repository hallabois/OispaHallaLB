import { Schema, Types, model } from "mongoose";

export interface Hash {
  hash: string;
  historyStart: string;
  connectedID: Types.ObjectId;
}

const hashSchema = new Schema<Hash>({
  hash: { type: String, required: true },
  historyStart: { type: String, required: true },
  connectedID: { type: Schema.Types.ObjectId, required: true },
});

const Hash = model<Hash>("Hash", hashSchema);

export async function validateUniqueHash(hash: string, historyStart: string) {
  const hashes = await Hash.find().exec();
  for (let i = 0; i < hashes.length; i++) {
    if (hashes[i].hash === hash || hashes[i].historyStart === historyStart) {
      return false;
    }
  }
  return true;
}

export async function addHash(
  hash: string,
  historyStart: string,
  connectedID: Types.ObjectId
) {
  Hash.create({
    hash: hash,
    historyStart: historyStart,
    connectedID: connectedID,
  });
}
