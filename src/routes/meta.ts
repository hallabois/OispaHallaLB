import express from "express";
import { IUser, validateScreenName } from "../models/user";
import { validate_token } from "../io/oispahalla";

import logger from "../io/logger";
import { User } from "./scores";

const router = express.Router();

router.get("/verifyname/:name/uid/:uid", async (req, res, next) => {
  const isValid = await validateScreenName(req.params.name, req.params.uid);
  res
    .status(isValid.valid ? 200 : 401)
    .json({ valid: isValid.valid, error: isValid.error });
});

router.post("/changename/:token?", async (req, res, next) => {
  let token = req.body.token || req.params.token;
  if (!token) {
    logger.error("No token provided");
    return res.status(401).json({ error: "No token provided" });
  }

  let tokenRes = await validate_token(token);
  if (!tokenRes.valid || !tokenRes.user_data) {
    logger.error("Invalid token: " + tokenRes);
    return res.status(401).json({ message: "Invalid token" });
  }

  if (!req.body.name) {
    return res.status(400).json({ message: "Missing name" });
  }

  try {
    let user = await User.findOneAndUpdate(
      { uid: tokenRes.user_data.uid },
      { screenName: req.body.name },
      { runValidators: true, context: "query" }
    );
    if (!user) {
      // Create user if not found
      user = new User({
        uid: tokenRes.user_data.uid,
        screenName: req.body.name,
        scores: {},
      });
      let userSaved: IUser = await user.save();
      if (!userSaved) {
        logger.error(userSaved);
        throw new Error("User not saved");
      }
    }
    res.status(200).json({ message: "Name changed" });
  } catch (err) {
    logger.error(err);
    res.status(500).json({
      message: "Error while changing name",
      error: err,
    });
  }
});

export default router;
