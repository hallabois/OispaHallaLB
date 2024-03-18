import { Schema, Document, Types } from "mongoose";
import { IUser } from "./user";
import { addHash } from "./hash";

export interface IScore extends Document {
  size: number;
  score: number;
  breaks: number;
  history: string;
  user: IUser;
  hash: string;
  rank?: number;
  version?: number;
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
    // version: {
    //   type: Number,
    //   default: 1,
    // },
  },
  { timestamps: true }
);

scoreSchema.post("save", async function (this: IScore, next) {
  addHash(this.hash, this.user);
});
