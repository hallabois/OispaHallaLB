import express from "express";
import { Types } from "mongoose";
import { validateScreenName } from "../models/user";
import { validate_token } from "../io/oispahalla";

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
    console.log("No token provided");
    return res.status(401).json({ error: "No token provided" });
  }

  let tokenRes = await validate_token(token);
  if (!tokenRes.valid || !tokenRes.user_data) {
    console.log("Invalid token: " + tokenRes);
    return res.status(401).json({ message: "Invalid token" });
  }

  if (!req.body.name) {
    return res.status(400).json({ message: "Missing name" });
  }

  User.findOneAndUpdate(
    { uid: tokenRes.user_data.uid },
    { screenName: req.body.name },
    { runValidators: true, context: "query" },
    (err, user) => {
      if (err) {
        console.log(err);
        res.status(500).json({
          message: "Error while changing name",
          error: err,
        });
        return;
      }
      if (!user) {
        console.log("User not found");
        res.status(404).json({ message: "User not found" });
        return;
      }
      res.status(200).json({ message: "Name changed" });
    }
  );
});

export default router;
