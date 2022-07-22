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
      //TODO : use this in scores.ts or other way idfk
      // validate: {
      //   validator: async (v: string) => {
      //     let user = await User.findById(v).exec();
      //     // ts keeps complaining about 'this' being possibly undefined when it cannot be in the context of mongoose so ignoring is necessary (i might be missing something)
      //     // @ts-ignore
      //     if (!user || !user.scores.get(this.size)) {
      //       return false;
      //     }
      //   },
      //   message: "Score owner validation failed",
      // },
    },
    hash: {
      type: String,
    },
  },
  { timestamps: true }
);

scoreSchema.pre("validate", async function (this: IScore, next) {
  addHash(this.hash, this.user);
});
