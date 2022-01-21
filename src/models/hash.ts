import { Schema, Document, model } from "mongoose";
import { IUser } from "./user";

export interface IHash extends Document {
  hash: string;
  // historyStart: string;
  connectedUser: IUser;
}

export const hashSchema = new Schema<IHash>({
  hash: { type: String, required: true },
  // historyStart: { type: String, required: true },
  connectedUser: [{ type: Schema.Types.ObjectId, ref: "User", required: true }],
});

const Hash = model<IHash>("Hash", hashSchema);

export async function validateUniqueHash(hash: string) {
  const hashes = await Hash.find().exec();
  for (let i = 0; i < hashes.length; i++) {
    if (hashes[i].hash === hash) {
      return false;
    }
  }
  return true;
}

export async function addHash(
  hash: string,
  // historyStart: string,
  connectedUser: IUser
) {
  Hash.create({
    hash: hash,
    // historyStart: historyStart,
    connectedUser: connectedUser,
  });
}
