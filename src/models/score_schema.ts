import { Schema } from "mongoose";

export interface IScore {
  size: number;
  screenName: string;
  score: number;
  breaks: number;
  history: string;
}

export const scoreSchema = new Schema<IScore>(
  {
    size: { type: Number, required: true },
    screenName: { type: String, required: true },
    score: { type: Number, required: true },
    breaks: { type: Number, required: true },
    history: { type: String, required: true },
  },
  { timestamps: true }
);
