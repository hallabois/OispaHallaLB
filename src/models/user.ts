import { Schema, Types, Document } from "mongoose";
import { IScore } from "./score";
import mongooseUniqueValidator from "mongoose-unique-validator";

export interface IUser extends Document {
  screenName: string;
  scores: Types.Map<IScore>;
}

export const userSchema = new Schema<IUser>(
  {
    screenName: {
      type: String,
      required: true,
      unique: true,
      uniqueCaseInsensitive: true,
      trim: true,
      minlength: 3,
      maxlength: 20,
    },
    scores: {
      // can be accessed as user.scores.get('size')
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

// export const User = model<IUser>("User", userSchema);
