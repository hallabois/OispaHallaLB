import { Schema, Document, Types } from "mongoose";
import { IUser } from "./user";
import { addHash } from "./hash";
import { User } from "../routes/scores";

export interface IScore extends Document {
  size: number;
  score: number;
  breaks: number;
  history: string;
  user: IUser;
  hash: string;
}

// export interface IHACResponse {
//   run_hash: string;
//   board_w: number;
//   board_h: number;
//   valid: boolean;
//   score: number;
//   score_margin: number;
//   breaks: number;
//   length: number;
// }

export class ScoreError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ScoreError";
  }
}

export class HACError extends Error {
  constructor(message) {
    super(message);
    this.name = "HACError";
  }
}

export class NotFoundError extends Error {
  constructor(message) {
    super(message);
    this.name = "NotFoundError";
  }
}

export const scoreSchema = new Schema<IScore>(
  {
    size: {
      type: Number,
      required: [true, "Size must be defined"],
      min: [2, "Size must be at least 2x2"],
    },
    score: {
      type: Number,
      required: [true, "Score must be defined"],
      min: [4, "Score must be at least 4"],
    },
    breaks: {
      type: Number,
      required: [true, "Breaks must be defined"],
      min: [0, "The amount of breaks used must be a positive number"],
    },
    history: {
      type: String,
      required: [true, "The game history must be defined"],
    },
    user: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: [true, "Owner of the score must be defined"],
    },
    hash: {
      type: String,
    },
  },
  { timestamps: true }
);

scoreSchema.post("save", async function (this: IScore, next) {
  addHash(this.hash, this.user);
});
