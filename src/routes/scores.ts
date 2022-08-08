import express from "express";
import fetch from "node-fetch-commonjs";
import { model, Types, startSession } from "mongoose";

import {
  IScore,
  scoreSchema,
  HACError,
  ScoreError,
  NotFoundError,
} from "../models/score";
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
  const session = await startSession();
  session.startTransaction();
  try {
    let fetch_res = await fetch(
      `${
        process.env.HAC_URL || "https://hac.oispahalla.com:8000"
      }/HAC/validate/${req.body.history}`
    );
    let HACResponse: any = await fetch_res.json();

    if (!fetch_res.ok) {
      throw new Error(
        `HAC server returned unexpected HTTP status code: ${fetch_res.status}`
      );
    }

    if (!HACResponse.valid) {
      throw new HACError("HAC deemed the history to be invalid");
    }
    if (+req.params.size !== HACResponse.board_w) {
      // hac only supports boards with ratio of 1:1 so height and width must be equal
      throw new HACError("HAC returned a history with the wrong size");
    }
    if (
      Math.abs(+req.body.score - HACResponse.score) > HACResponse.score_margin
    ) {
      throw new HACError("Score does not match the HAC response");
    }
    if (+req.body.breaks !== HACResponse.breaks) {
      throw new HACError("Breaks do not match the HAC response");
    }
    if (
      !(await validateUniqueHash(
        HACResponse.run_hash
        // req.body.history.substring(0, 1000)
      ))
    ) {
      throw new ScoreError("Score already exists");
    }

    let score = {} as IScore;
    let user = {} as IUser | null;
    let newScore = true;
    let nameChanged = false;

    if (req.body.user._id && Types.ObjectId.isValid(req.body.user._id)) {
      user = await User.findById(req.body.user._id).exec();
      if (!user) {
        throw new NotFoundError("User not found");
      }

      const previousScore = user.scores.get(req.params.size);
      if (previousScore) {
        newScore = false;
        if (req.body.score <= previousScore.score) {
          throw new ScoreError("Score must be greater than the previous score");
        }
      }

      if (user.screenName !== req.body.user.screenName) {
        user.screenName = req.body.user.screenName;
        nameChanged = true;
      }
    } else {
      user = new User({ screenName: req.body.user.screenName, scores: {} });
    }

    score = await new scores[req.params.size]({
      size: req.params.size,
      score: req.body.score,
      breaks: req.body.breaks,
      history: req.body.history,
      user: user,
      hash: HACResponse.run_hash,
    });

    user.scores.set(req.params.size, score._id);

    user.save(async (err) => {
      try {
        if (err) {
          console.log(err);
          throw err;
        }

        score.save((error, result) => {
          if (error) {
            console.log(error);
            throw error;
          }

          res.status(201).json({
            message: newScore
              ? "Score created successfully"
              : "Score updated successfully",
            createdScore: result,
            nameChanged,
          });
        });
        await session.commitTransaction();
        session.endSession();
        return res;
      } catch (error) {
        // i genuinelly don't know why this is necessary but the outer layer catch doesn't work without it
        // some js weirdness ig i can't be bothered to look into it
        console.log(error);

        let status = 500;

        if (error instanceof (HACError || ScoreError)) {
          status = 403;
        } else if (error instanceof NotFoundError) {
          status = 404;
        }

        res.status(status).json({
          message: error.message || "Error while creating/updating score",
          submittedScore: req.body,
          error: error,
        });
        await session.abortTransaction();
        session.endSession();
        return res;
      }
    });
  } catch (err) {
    console.log(err);

    let status = 500;

    if (err instanceof (HACError || ScoreError)) {
      status = 403;
    } else if (err instanceof NotFoundError) {
      status = 404;
    }

    res.status(status).json({
      message: err.message || "Error while creating/updating score",
      submittedScore: req.body,
      error: err,
    });
    await session.abortTransaction();
    session.endSession();
    return res;
  }
}

router.get("/size/:size/*|/size/:size", preSize);
router.get("/size/:size", getAll);
router.get("/size/:size/count", getCount);
router.get("/size/:size/:maxnum", getTop);
router.get("/size/:size/id/:id", getById);
router.get("/size/:size/fetchboard/:maxnum/:id?", getByIdAndRank);
router.post("/size/:size/", createScore);

export default router;
