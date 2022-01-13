import express from "express";
import fetch from "node-fetch-commonjs";
import { model } from "mongoose";

import { IScore, scoreSchema } from "../models/score_schema";
import { validateUniqueHash, addHash } from "../models/hash";
const ObjectID = require("mongoose").Types.ObjectId;

const router = express.Router();

export const scores = {
  "3": model<IScore>("Score", scoreSchema),
  "4": model<IScore>("Score", scoreSchema),
};

router.all("/:size/*", async (req, res, next) => {
  console.log(typeof req.params.size, req.params.size);

  if (!+req.params.size) {
    return res.status(400).json({ message: "Size is NaN" });
  }

  if (!(req.params.size in scores)) {
    return res.status(404).json({ message: "Size not supported" });
  }

  next();
});

router.get("/:size/", async (req, res, next) => {
  scores[req.params.size].find({}, "-_id -history").exec((err, results) => {
    if (err) {
      console.log(err);
      res.status(500).json({
        message: "Error while fetching scores",
        error: err,
      });
      return;
    }
    res.status(200).json(results);
  });
});

router.get("/:size/count", async (req, res, next) => {
  scores[req.params.size].find().exec((err, results) => {
    if (err) {
      console.log(err);
      res.status(500).json({
        message: "Error while counting scores",
        error: err,
      });
      return;
    }
    res.status(200).json({ count: results.length });
  });
});

router.get("/:size/:maxnum", async (req, res, next) => {
  if (!+req.params.maxnum) {
    return res.status(400).json({ message: "Maxnum is NaN" });
  }
  scores[req.params.size]
    .find({}, "-_id -breaks -history -createdAt -updatedAt -__v -size")
    .limit(+req.params.maxnum)
    .sort({ score: -1 })
    .exec((err, results) => {
      if (err) {
        console.log(err);
        res.status(500).json({
          message: "Error while getting scores",
          error: err,
        });
        return;
      }
      res.status(200).json(results);
    });
});

router.get("/:size/id/:id", async (req, res, next) => {
  scores[req.params.size]
    .findById(req.params.id, "-history")
    .exec((err, score) => {
      if (err) {
        console.log(err);
        res.status(500).json({
          message: "Error while getting score by ID",
          error: err,
        });
        return;
      }
      if (score) {
        res.status(200).json(score);
        return;
      }
      console.log("Score request by ID failed:", req.params.id);
      res.status(404).json({ message: "Score not found", id: req.params.id });
    });
});

//used for getting the top scores and the score and rank for an id in one call
router.get("/:size/fetchboard/:maxnum/:id", async (req, res, next) => {
  console.log(req.params.size);
  scores[req.params.size]
    .find({}, "-_id -breaks -history -createdAt -updatedAt -__v -size")
    .limit(+req.params.maxnum)
    .sort({ score: -1 })
    .exec((err, topBoard) => {
      if (err) {
        console.log(err);
        res
          .status(500)
          .json({
            message: "Error while getting scores",
            error: err,
          })
          .send();
        return;
      }

      scores[req.params.size].findById(req.params.id).exec((err, score) => {
        if (err) {
          console.log(err);
          res.status(500).json({
            message: "Error while getting score by ID",
            error: err,
          });
          return;
        }
        if (!score) {
          console.log("Score request by ID failed:", req.params.id);
          res
            .status(404)
            .json({ message: "Score not found", id: req.params.id });
          return;
        }
        scores[req.params.size]
          .find({ score: { $gt: score.score } })
          .count()
          .exec((err, rank) => {
            if (err) {
              console.log(err);
              res.status(500).json({
                message: "Error while getting rank",
                error: err,
              });
              return;
            }
            rank++;
            res.status(200).json({
              topBoard,
              score,
              rank,
            });
          });
      });
    });
});

router.post("/:size/", async (req, res, next) => {
  fetch("https://hac.oispahalla.com:8000/HAC/validate/" + req.body.history) // history should include the grid size
    .then(async (u) => {
      if (u.ok) {
        return u.json();
      }
      res.status(u.status).json({
        message: `HAC server returned unexpected HTTP status code: ${u.status}`,
        submittedScore: req.body,
        HACResponse: u,
      });
      return false;
    })
    .then(async (json: any) => {
      if (!json) return;
      if (!json.valid) {
        res.status(403).json({
          message: "HAC deemed the history to be invalid",
          submittedScore: req.body,
          HACResponse: json,
        });
        return;
      }
      if (req.params.size != json.board_w) {
        // hac only supports boards with ratio of 1:1 so height and width must be equal
        res.status(403).json({
          message: "HAC returned a history with the wrong size",
          submittedScore: req.body,
          HACResponse: json,
        });
        return;
      }
      if (req.body.score != json.score) {
        res.status(403).json({
          message: "Score does not match the HAC response",
          submittedScore: req.body,
          HACResponse: json,
        });
        return;
      }
      if (req.body.breaks != json.breaks) {
        res.status(403).json({
          message: "Breaks do not match the HAC response",
          submittedScore: req.body,
          HACResponse: json,
        });
        return;
      }
      if (
        !(await validateUniqueHash(
          json.run_hash,
          req.body.history.substring(0, 1000)
        ))
      ) {
        res.status(403).json({
          message: "Score already exists",
          submittedScore: req.body,
        });
        return;
      }

      let score = new scores[req.params.size]({
        _id: ObjectID.isValid(req.body.id) ? req.body.id : new ObjectID(),
        size: req.params.size,
        screenName: req.body.screenName,
        score: req.body.score,
        breaks: req.body.breaks,
        history: req.body.history,
      });

      score.save((err) => {
        if (err) {
          console.log(err);
          res.status(500).json({
            message: "Error while saving score",
            error: err,
          });
          return;
        }

        addHash(json.run_hash, req.body.history.substring(0, 1000), score._id);
        res.status(201).json({
          message: "Score created",
          createdScore: score,
        });
      });
    })
    .catch((err) => {
      console.log(err);
      res.status(500).json({
        message: "Error while creating new score",
        submittedScore: req.body,
        error: err,
      });
    });
});

export default router;
