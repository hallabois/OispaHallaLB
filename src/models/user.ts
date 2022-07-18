import { Schema, Types, Document } from "mongoose";
import { IScore } from "./score";
import mongooseUniqueValidator from "mongoose-unique-validator";

import profanityList from "../data/profanitylist.json";
const profanitySet = new Set(profanityList);

export interface IUser extends Document {
  screenName: string;
  scores: Types.Map<IScore>;
}

export const userSchema = new Schema<IUser>(
  {
    screenName: {
      type: String,
      required: [true, "Screen name is required"],
      unique: true, //only used by mongodb, not a validator
      uniqueCaseInsensitive: [true, "Screen name already exists"],
      trim: true,
      match: /^[a-zA-Z0-9_åäöÅÄÖ]+$/,
      minLength: [3, "Screen name must be at least 3 characters long"],
      maxLength: [20, "Screen name must be at most 20 characters long"],
      validate: {
        validator: (v: string) => {
          return (
            //remove numbers and underscores that could be used inbetween characters to bypass the profanity check
            !profanitySet.has(v.toLowerCase().replaceAll(/[0-9_]/g, "")) &&
            //n33d 4 1337
            !profanitySet.has(
              v
                .replaceAll("0", "o")
                .replaceAll("1", "i")
                .replaceAll("3", "e")
                .replaceAll("4", "a")
                .replaceAll("5", "s")
                .replaceAll("6", "b")
                .replaceAll("7", "t")
                .replaceAll("8", "b")
                .replaceAll("9", "g")
                .replaceAll("_", "")
                .toLowerCase()
            )
          );
        },
        message: (props) =>
          `No, you cannot name yourself '${props.value}', cmon dude.`,
      },
    },
    scores: {
      // can be accessed via user.scores.get('size')
      type: Map,
      of: {
        type: "ObjectId",
        ref: "Score",
      },
    },
  },
  { timestamps: true }
);

userSchema.plugin(mongooseUniqueValidator);
