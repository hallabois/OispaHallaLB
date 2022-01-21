import express from "express";
import { Types } from "mongoose";

import { User } from "./scores";

const router = express.Router();

router.get("/verifyid/:id", async (req, res, next) => {
  const isValid = Types.ObjectId.isValid(req.params.id);
  res.status(200).json({ valid: isValid });
});

router.post("/changename/:id", async (req, res, next) => {
  if (!Types.ObjectId.isValid(req.params.id)) {
    return res.status(400).json({ message: "Invalid id" });
  }
  if (!req.body.name) {
    return res.status(400).json({ message: "Missing name" });
  }
  User.findByIdAndUpdate(
    req.params.id,
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
