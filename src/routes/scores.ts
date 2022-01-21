import express from "express";
import fetch from "node-fetch-commonjs";
import { model, Types } from "mongoose";

import { IScore, scoreSchema } from "../models/score";
import { IUser, userSchema } from "../models/user";
import { validateUniqueHash, addHash } from "../models/hash";

export const User = model<IUser>("User", userSchema);
export const scores = {
  "3": model<IScore>("Score3", scoreSchema),
  "4": model<IScore>("Score4", scoreSchema),
};

const router = express.Router();

router.all("/size/:size/*|/size/:size", async (req, res, next) => {
  if (!+req.params.size) {
    return res.status(400).json({ message: "Size is NaN" });
  }

  if (!(req.params.size in scores)) {
    return res.status(404).json({ message: "Size not supported" });
  }

  next();
});

router.get("/size/:size/", async (req, res, next) => {
  scores[req.params.size]
    .find({}, "-_id -history -createdAt -updatedAt -__v")
    .populate({ path: "user", select: "screenName -_id" })
    .exec((err, results) => {
      if (err) {
        console.log(err);
        res.status(500).json({
          message: "Error while fetching scores",
          error: err,
        });
        return;
      }
      let ressi = results.map((score) => {
        return {
          size: score.size,
          score: score.score,
          breaks: score.breaks,
          user: { screenName: score.user.screenName },
        };
      });

      res.status(200).json({ scores: ressi });
    });
});

router.get("/size/:size/count", async (req, res, next) => {
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

router.get("/size/:size/:maxnum", async (req, res, next) => {
  if (!+req.params.maxnum) {
    return res.status(400).json({ message: "Maxnum is NaN" });
  }
  scores[req.params.size]
    .find({}, "score -_id")
    .limit(+req.params.maxnum)
    .sort({ score: -1 })
    .populate({ path: "user", select: "screenName -_id" })
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

router.get("/size/:size/id/:id", async (req, res, next) => {
  scores[req.params.size]
    .findOne({ user: req.params.id }, "-history")
    .populate("user", "screenName")
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
      res.status(404).json({ message: "Score not found", user: req.params.id });
    });
});

//used for getting the top scores and the score and rank for an id in one call
router.get("/size/:size/fetchboard/:maxnum/:id?", async (req, res, next) => {
  scores[req.params.size]
    .find({}, "-_id -breaks -history -createdAt -updatedAt -__v -size")
    .limit(+req.params.maxnum)
    .sort({ score: -1 })
    .populate({ path: "user", select: "screenName" })
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

      if (!req.params.id) {
        res.status(200).json({ topBoard });
        return;
      }

      scores[req.params.size]
        .findOne({ user: req.params.id }, "-history")
        .populate({ path: "user", select: "screenName" })
        .exec((err, score) => {
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
              .json({ message: "Score not found", user: req.params.id });
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
              score.rank = rank;
              res.status(200).json({
                topBoard,
                score,
              });
            });
        });
    });
});

router.post("/size/:size/", async (req, res, next) => {
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
      if (+req.params.size !== json.board_w) {
        // hac only supports boards with ratio of 1:1 so height and width must be equal
        res.status(403).json({
          message: "HAC returned a history with the wrong size",
          submittedScore: req.body,
          HACResponse: json,
        });
        return;
      }
      if (+req.body.score !== json.score) {
        res.status(403).json({
          message: "Score does not match the HAC response",
          submittedScore: req.body,
          HACResponse: json,
        });
        return;
      }
      if (+req.body.breaks !== json.breaks) {
        res.status(403).json({
          message: "Breaks do not match the HAC response",
          submittedScore: req.body,
          HACResponse: json,
        });
        return;
      }
      if (
        !(await validateUniqueHash(
          json.run_hash
          // req.body.history.substring(0, 1000)
        ))
      ) {
        res.status(403).json({
          message: "Score already exists",
          submittedScore: req.body,
        });
        return;
      }

      var score = {} as IScore;
      var user = {} as IUser | null;

      if (Types.ObjectId.isValid(req.body.user.id)) {
        user = await User.findById(req.body.user.id).exec();
        console.log(user);
        if (!user) {
          res.status(404).json({
            message: "User not found",
            submittedScore: req.body,
          });
          return;
        }
        const lol = user.scores.get(req.params.size) || 0; // i have to save this to a variable bc ts freaks out otherwise
        if (req.body.score <= lol) {
          res.status(403).json({
            message: "Score must be greater than the previous score",
            submittedScore: req.body,
          });
          return;
        }
        score.user = user;
        score = new scores[req.params.size]({
          size: req.params.size,
          score: req.body.score,
          breaks: req.body.breaks,
          history: req.body.history,
          user: user,
        });
      } else {
        user = new User({ screenName: req.body.user.screenName, scores: {} });
        score = new scores[req.params.size]({
          size: req.params.size,
          score: req.body.score,
          breaks: req.body.breaks,
          history: req.body.history,
          user: user,
        });
      }
      user.scores.set(req.params.size, score._id);
      let error = false;
      user.save((err) => {
        if (err) {
          error = true;
          console.log(err);
          res.status(500).json({
            message: "Error while saving user",
            error: err,
          });
        }
      });
      if (error) return;

      score.save((err, result) => {
        if (err) {
          console.log(err);
          res.status(500).json({
            message: "Error while saving score",
            error: err,
          });
          return;
        }

        addHash(json.run_hash, score.user);
        res.status(201).json({
          message: "Score created",
          createdScore: result,
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
