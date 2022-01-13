import express from "express";
import fetch from "node-fetch-commonjs";

import { Score } from "../models/score_schema";
import { validateUniqueHash, addHash } from "../models/hash";
const ObjectID = require("mongoose").Types.ObjectId;

const router = express.Router();

router.get("/", async (req, res, next) => {
  Score.find({}, "-_id -history").exec((err, results) => {
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

router.get("/count", async (req, res, next) => {
  Score.find().exec((err, results) => {
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

router.get("/:maxnum", async (req, res, next) => {
  return Score.find({}, "-_id -breaks -history -createdAt -updatedAt -__v")
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

router.get("/id/:id", async (req, res, next) => {
  Score.findById(req.params.id, "-history").exec((err, score) => {
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

router.post("/", async (req, res, next) => {
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

      let score = new Score({
        _id: ObjectID.isValid(req.body.id) ? req.body.id : new ObjectID(),
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
