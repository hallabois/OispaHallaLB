import { Schema, Types, Document } from "mongoose";
import { IScore } from "./score";
import mongooseUniqueValidator from "mongoose-unique-validator";

import profanityList from "../data/profanitylist.json";
const profanitySet = new Set(profanityList);

export interface IUser extends Document {
  screenName: string;
  scores: Types.Map<IScore>;
}

export function validateScreenName(screenName: string) {
  if (screenName.length < 3) {
    return {
      valid: false,
      error: "Screen name must be at least 3 characters long",
    };
  }
  if (screenName.length > 20) {
    return {
      valid: false,
      error: "Screen name must be less than 20 characters long",
    };
  }
  if (
    profanitySet.has(screenName.toLowerCase().replaceAll(/[0-9_]/g, "")) ||
            //n33d 4 1337
    profanitySet.has(
      screenName
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
  ) {
    return {
      valid: false,
      error: "Screen name cannot contain profanity",
    };
  }
  return { valid: true };
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
        validator: function (screenName: string) {
          return validateScreenName(screenName).valid;
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
