import express from "express";
const router = express.Router();
import { scores } from "./scores";

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

router.all("/score/size/:size/*|/score/size/:size", async (req, res, next) => {
  if (!+req.params.size) {
    return res.status(400).json({ message: "Size is NaN" });
  }

  if (!(req.params.size in scores)) {
    return res.status(404).json({ message: "Size not supported" });
  }

  next();
});

router.get("/score/size/:size/:id", async (req, res, next) => {
  //doesn't parse history out
  scores[req.params.size]
    .findOne({ userId: req.params.id })
    .exec((err, score) => {
      if (err) {
        console.log(err);
        res.status(500).json({
          message: "Error while getting admin score by ID",
          error: err,
        });
        return;
      }
      if (score) {
        res.status(200).json(score);
        return;
      }
      console.log("Admin score request by ID failed:", req.params.id);
      res
        .status(404)
        .json({ message: "Score not found", userId: req.params.id });
    });
});

router.delete("/score/size/:size/:id", async (req, res, next) => {
  scores[req.params.size]
    .findOneAndDelete({ userId: req.params.id })
    .exec()
    .then((score) => {
      if (score) {
        console.log("Admin score delete request:", score);
        res.status(200).json({ removedScore: score });
      } else {
        console.log("Admin score delete request failed:", req.params.id);
        res
          .status(404)
          .json({ message: "Score not found", userId: req.params.id });
      }
    })
    .catch((err) => {
      console.log(err);
      res.status(500).json({ message: "Internal server error", error: err });
    });
});

router.patch("/score/size/:size/:id", async (req, res, next) => {
  scores[req.params.size]
    .findOneAndUpdate({ userId: req.params.id }, req.body)
    .exec()
    .then((result) => {
      if (result) {
        console.log("Admin score patch request:", result);
        res.status(200).json({ oldScore: result });
      } else {
        console.log("Admin score patch request failed:", req.params.id);
        res
          .status(404)
          .json({ message: "Score not found", userId: req.params.id });
      }
    })
    .catch((err) => {
      console.log(err);
      res.status(500).json({ message: "Internal server error", error: err });
    });
});

export default router;
