import { Schema, model } from "mongoose";

export interface Score {
  screenName: string;
  score: number;
  breaks: number;
  history: string;
}

const scoreSchema = new Schema<Score>(
  {
    screenName: { type: String, required: true },
    score: { type: Number, required: true },
    breaks: { type: Number, required: true },
    history: { type: String, required: true },
  },
  { timestamps: true }
);

export const Score = model<Score>("Score", scoreSchema);
