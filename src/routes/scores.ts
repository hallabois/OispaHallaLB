import express from "express";
import { model, startSession } from "mongoose";

import {
  IScore,
  scoreSchema,
  HACError,
  ScoreError,
  NotFoundError,
} from "../models/score";
import { IUser, userSchema } from "../models/user";
import { validateUniqueHash } from "../models/hash";
import { validate_token } from "../io/oispahalla";

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
    .populate({ path: "user", select: "screenName" })
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
    .populate({ path: "user", select: "screenName" })
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

// GET/POST /size/:size/token/(:token)
export async function getByToken(req, res) {
  let token = req.body.token || req.params.token;

  let tokenRes = await validate_token(token);
  if (!tokenRes.valid || !tokenRes.user_data) {
    return res.status(401).json({ message: "Invalid token" });
  }

  User.findOne({ uid: tokenRes.user_data.uid }).exec(
    (err, user: IUser | null) => {
      if (err) {
        console.log(err);
        res.status(500).json({
          message: "Error while getting score by token",
          error: err,
        });
        return;
      }
      if (!user) {
        res.status(404).json({ message: "User not found" });
        return;
      }
      const userScore = user.scores.get(req.params.size);
      if (!userScore) {
        res.status(404).json({ message: "Score not found" });
        return;
      }
      scores[req.params.size]
        .findOne({ _id: userScore }, "-history -hash")
        .exec((err, score: IScore) => {
          if (err) {
            console.log(err);
            res.status(500).json({
              message: "Error while getting score by token",
              error: err,
            });
            return;
          }
          if (!score) {
            res.status(404).json({ message: "Score not found" });
            return;
          }
          score.user = user;
          res.status(200).json({ score });
        });
    }
  );
}

//used for getting the top scores and the score and rank for a token in one call
// GET/POST /size/:size/fetchboard/:maxnum/(:token?)
// body: { token: "token", rankMinus: 2, rankPlus: 2 }
export async function getByTokenAndRank(req, res) {
  scores[req.params.size]
    .find({}, "-_id -breaks -history -createdAt -updatedAt -hash -__v -size")
    .sort({ score: -1 })
    .populate({ path: "user", select: "screenName" })
    .exec(async (err, topBoard) => {
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

      let token = req.body.token || req.params.token;

      if (!token) {
        res.status(200).json({ topBoard });
        return;
      }

      const tokenRes = await validate_token(token);
      if (!tokenRes.valid || !tokenRes.user_data) {
        return res.status(401).json({ message: "Invalid token" });
      }

      User.findOne({ uid: tokenRes.user_data.uid }).exec(
        (err, user: IUser | null) => {
          if (err) {
            console.log(err);
            res.status(500).json({
              message: "Error while getting score by token",
              error: err,
            });
            return;
          }
          if (!user) {
            res.status(404).json({ message: "User not found" });
            return;
          }
          const userScore = user.scores.get(req.params.size);
          if (!userScore) {
            res.status(200).json({ topBoard });
            return;
          }
          scores[req.params.size] //mongoose didn't want to use .populate() so this is a dumber looking workaround
            .findOne({ _id: userScore }, "-history -hash")
            .exec((err, score: IScore) => {
              if (err) {
                console.log(err);
                res.status(500).json({
                  message: "Error while getting score by token",
                  error: err,
                });
                return;
              }
              if (!score) {
                res.status(200).json({ topBoard });
                return;
              }
              scores[req.params.size]
                .find({ score: { $gt: score.score } })
                .count()
                .exec((err, rank: number) => {
                  if (err) {
                    console.log(err);
                    res.status(500).json({
                      message: "Error while counting scores",
                      error: err,
                    });
                    return;
                  }
                  rank++;
                  let rivals: any = {};
                  if (
                    req.body.rankMinus ||
                    req.body.rankPlus //&&
                    //rank > req.params.maxnum
                  ) {
                    for (let i = 1; i <= req.body.rankMinus; i++) {
                      // rank - i so better than the users
                      let userMinus = topBoard[rank - i - 1];
                      if (userMinus) {
                        rivals[rank - i] = userMinus;
                      }
                    }
                    for (let i = 1; i <= req.body.rankPlus; i++) {
                      // rank + i so worse than the users
                      let userPlus = topBoard[rank + i - 1];
                      if (userPlus) {
                        rivals[rank + i] = userPlus;
                      }
                    }
                  }

                  topBoard = topBoard.slice(0, +req.params.maxnum - 1);
                  score.user = user;
                  res.status(200).json({
                    topBoard,
                    score,
                    rank,
                    rivals,
                  });
                });
            });
        }
      );
    });
}

// POST /size/:size
export async function createScore(req, res) {
  const session = await startSession();
  session.startTransaction();
  try {
    let fetch_res = await fetch(
      `${process.env.HAC_URL || "https://hac.oispahalla.com"}/api/validate`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          run: req.body.history,
        }),
      }
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
    if (
      !(await validateUniqueHash(
        HACResponse.run_hash
        // req.body.history.substring(0, 1000)
      ))
    ) {
      throw new ScoreError("Score already exists");
    }

    let user = {} as IUser | null;
    let newScore = true;
    let nameChanged = false;

    const tokenRes = await validate_token(req.body.user.token);
    if (!tokenRes.valid || !tokenRes.user_data) {
      throw new NotFoundError("Invalid token");
    }

    user = await User.findOne({ uid: tokenRes.user_data.uid }).exec();
    if (!user) {
      user = new User({
        screenName: req.body.user.screenName,
        scores: {},
        uid: tokenRes.user_data.uid,
      });
    }

    const previousScore = user.scores.get(req.params.size);
    if (previousScore) {
      try {
        let prevScore: IScore | undefined = undefined;
        try {
          prevScore = await scores[req.params.size]
            .findOne({ _id: previousScore }, "-history -hash")
            .exec();
        } catch (err) {
          console.log(err);
          res.status(500).json({
            message: "Error while getting score by token",
            error: err,
          });
          return;
        }
        if (!prevScore) {
          throw new NotFoundError("Previous score not found");
        }
        newScore = false;
        if (req.body.score <= prevScore.score) {
          throw new ScoreError("Score must be greater than the previous score");
        }
        scores[req.params.size].deleteOne({ _id: prevScore._id }, (err) => {
          //this should be fine to delete this early since the transaction should handle it fine
          if (err) {
            throw new Error(err);
          }
        });
      } catch (err) {
        let status = 500;
        if (err instanceof ScoreError || err instanceof HACError) {
          status = 403;
        } else if (err instanceof NotFoundError) {
          status = 404;
        }

        res.status(status).json({
          message: err.message || "Error while creating/updating score",
          submittedScore: req.body,
          error: err,
        });
        session.abortTransaction();
        session.endSession();
        return res;
      }
    }

    if (user.screenName !== req.body.user.screenName) {
      user.screenName = req.body.user.screenName;
      nameChanged = true;
    }

    let score: IScore = await new scores[req.params.size]({
      size: req.params.size,
      score: req.body.score,
      breaks: HACResponse.breaks, // placeholder since the app always sends 0 breaks
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

        if (error instanceof ScoreError || err instanceof HACError) {
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

    if (err instanceof ScoreError || err instanceof HACError) {
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
router.get("/size/:size/token/:token", getByToken);
router.post("/size/:size/token", getByToken);
router.get("/size/:size/fetchboard/:maxnum/:token?", getByTokenAndRank);
router.post("/size/:size/fetchboard/:maxnum/", getByTokenAndRank);
router.post("/size/:size/", createScore);

export default router;
