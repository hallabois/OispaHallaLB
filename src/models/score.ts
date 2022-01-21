import { Schema, Document } from "mongoose";
import { IUser } from "./user";

export interface IScore extends Document {
  size: number;
  score: number;
  breaks: number;
  history: string;
  user: IUser;
}

export const scoreSchema = new Schema<IScore>(
  {
    size: { type: Number, required: true },
    score: { type: Number, required: true },
    breaks: { type: Number, required: true },
    history: { type: String, required: true },
    user: { type: Schema.Types.ObjectId, ref: "User", required: true },
  },
  { timestamps: true }
);
