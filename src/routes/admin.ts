import express from "express";
const router = express.Router();
import { Score } from "../models/score_schema";

if (process.env.ADMIN_TOKEN == undefined) {
  console.log("ADMIN_TOKEN environment variable is not set!");
  process.exit(1);
}

router.all("*", (req, res, next) => {
  if (process.env.ADMIN_TOKEN == req.query.token) {
    next();
  } else {
    res.status(401).json({ message: "Admin token does not match" });
  }
});

router.delete("/score/:id", async (req, res, next) => {
  Score.findOneAndDelete({ _id: req.params.id })
    .exec()
    .then((score) => {
      if (score) {
        console.log("Admin score delete request:", score);
        res.status(200).json({ removedScore: score });
      } else {
        console.log("Admin score delete request failed:", req.params.id);
        res.status(404).json({ message: "Score not found", id: req.params.id });
      }
    })
    .catch((err) => {
      console.log(err);
      res.status(500).json({ message: "Internal server error", error: err });
    });
});

router.patch("/score/:id", async (req, res, next) => {
  Score.findOneAndUpdate({ _id: req.params.id }, req.body)
    .exec()
    .then((result) => {
      if (result) {
        console.log("Admin score patch request:", result);
        res.status(200).json({ oldScore: result });
      } else {
        console.log("Admin score patch request failed:", req.params.id);
        res.status(404).json({ message: "Score not found", id: req.params.id });
      }
    })
    .catch((err) => {
      console.log(err);
      res.status(500).json({ message: "Internal server error", error: err });
    });
});

export default router;
