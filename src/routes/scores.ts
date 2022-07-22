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

// GET /size/:size
export async function preSize(req, res, next) {
  // before every /scores/size/:size
  if (!+req.params.size) {
    return res.status(400).json({ message: "Size is NaN" });
  }

  if (!(req.params.size in scores)) {
    return res.status(404).json({ message: "Size not supported" });
  }

  next();
}

// GET /size/:size
export async function getAll(req, res) {
  // returns all scores
  scores[req.params.size]
    .find({}, "-_id -history -size -breaks -createdAt -updatedAt -__v -hash")
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
      let ressi = results.map((score: IScore) => {
        return {
          size: score.size,
          score: score.score,
          breaks: score.breaks,
          user: { screenName: score.user.screenName },
        };
      });

      res.status(200).json({ scores: ressi });
    });
}

// GET /size/:size/count
export async function getCount(req, res) {
  // returns count of scores
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
}

// GET /size/:size/:maxnum
export async function getTop(req, res) {
  // returns top res.params.maxnum scores
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
}

// GET /size/:size/id/:id
export async function getById(req, res) {
  scores[req.params.size]
    .findOne({ user: req.params.id }, "-history -hash")
    .populate("user", "screenName")
    .exec((err, score: IScore) => {
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
}

//used for getting the top scores and the score and rank for an id in one call
// GET /size/:size/fetchboard/:maxnum/:id?
export async function getByIdAndRank(req, res) {
  scores[req.params.size]
    .find({}, "-_id -breaks -history -createdAt -updatedAt -hash -__v -size")
    .limit(+req.params.maxnum)
    .sort({ score: -1 })
    .populate({ path: "user", select: "screenName -_id" })
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
        .exec((err, score: IScore) => {
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
            .exec((err, rank: number) => {
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
}

// POST /size/:size
export async function createScore(req, res) {
  fetch(
    `${process.env.HAC_URL || "https://hac.oispahalla.com:8000"}/HAC/validate/${
      req.body.history
    }`
  ) // history should include the grid size
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
    .then(async (HACResponse: any) => {
      if (!HACResponse) return;
      if (!HACResponse.valid) {
        res.status(403).json({
          message: "HAC deemed the history to be invalid",
          submittedScore: req.body,
          HACResponse: HACResponse,
        });
        return;
      }
      if (+req.params.size !== HACResponse.board_w) {
        // hac only supports boards with ratio of 1:1 so height and width must be equal
        res.status(403).json({
          message: "HAC returned a history with the wrong size",
          submittedScore: req.body,
          HACResponse: HACResponse,
        });
        return;
      }
      if (
        Math.abs(+req.body.score - HACResponse.score) > HACResponse.score_margin
      ) {
        res.status(403).json({
          message: "Score does not match the HAC response",
          submittedScore: req.body,
          HACResponse: HACResponse,
        });
        return;
      }
      if (+req.body.breaks !== HACResponse.breaks) {
        res.status(403).json({
          message: "Breaks do not match the HAC response",
          submittedScore: req.body,
          HACResponse: HACResponse,
        });
        return;
      }
      if (
        !(await validateUniqueHash(
          HACResponse.run_hash
          // req.body.history.substring(0, 1000)
        ))
      ) {
        res.status(403).json({
          message: "Score already exists",
          submittedScore: req.body,
        });
        return;
      }

      let score = {} as IScore;
      let user = {} as IUser | null;
      let newScore = true;
      let nameChanged = false;

      if (req.body.user._id && Types.ObjectId.isValid(req.body.user._id)) {
        user = await User.findById(req.body.user._id).exec();
        if (!user) {
          res.status(404).json({
            message: "User not found",
            submittedScore: req.body,
          });
          return;
        }
        const previousScore = user.scores.get(req.params.size);
        // note: this cannot be <= since if the score.save() fails but user.scores has been set to the new score it wouldn't let the user retry saving
        // this is kind of a hack, it should optimally rollback if the saving fails
        // https://mongoosejs.com/docs/transactions.html
        if (previousScore) {
          newScore = false;
          if (req.body.score < previousScore.score) {
            res.status(403).json({
              message: "Score must be greater than the previous score",
              submittedScore: req.body,
            });
            return;
          }
        }

        if (user.screenName !== req.body.user.screenName) {
          user.screenName = req.body.user.screenName;
          nameChanged = true;
        }
      } else {
        user = new User({ screenName: req.body.user.screenName, scores: {} });
      }

      //   score = new scores[req.params.size]({
      //     size: req.params.size,
      //     score: req.body.score,
      //     breaks: req.body.breaks,
      //     history: req.body.history,
      //     user: user,
      //   });
      // } else {
      score = await new scores[req.params.size]({
        size: req.params.size,
        score: req.body.score,
        breaks: req.body.breaks,
        history: req.body.history,
        user: user,
        hash: HACResponse.run_hash,
      });

      //BUG: if user saving fails the scores map is left with the new score
      //use transactions
      user.scores.set(req.params.size, score._id);
      user.save((err) => {
        if (err) {
          console.log(err);
          res.status(500).json({
            message: "Error while saving user",
            error: err,
          });
          return;
        }
      });

      score.save((err, result) => {
        if (err) {
          console.log(err);
          res.status(500).json({
            message: "Error while saving score",
            error: err,
          });
          return;
        }

        res.status(201).json({
          message: newScore
            ? "Score created successfully"
            : "Score updated successfully",
          createdScore: result,
          nameChanged,
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
}

router.get("/size/:size/*|/size/:size", preSize);
router.get("/size/:size", getAll);
router.get("/size/:size/count", getCount);
router.get("/size/:size/:maxnum", getTop);
router.get("/size/:size/id/:id", getById);
router.get("/size/:size/fetchboard/:maxnum/:id?", getByIdAndRank);
router.post("/size/:size/", createScore);

export default router;
