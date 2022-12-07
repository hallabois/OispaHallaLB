import express from "express";
import { model, startSession } from "mongoose";

import logger from "../io/logger";
import { IScore, scoreSchema } from "../models/score";
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
async function getAll(req, res) {
  // returns all scores
  let results = await scores[req.params.size]
    .find({}, "score user -_id")
    .populate({ path: "user", select: "screenName uid -_id" });
  if (!results) {
    logger.error("No scores found, getAll");
    res.status(404).json({
      message: "No results found",
    });
    return;
  }
  let ressi = results.map((score) => {
    return {
      ...score._doc,
    };
  });

  res.status(200).json({ scores: ressi });
}

// GET /size/:size/count
async function getCount(req, res) {
  // returns count of scores
  let results = await scores[req.params.size].find();
  if (!results) {
    logger.error("No scores found, getCount");
    res.status(404).json({
      message: "No results found",
    });
    return;
  }
  res.status(200).json({ count: results.length });
}

// GET /size/:size/:maxnum
async function getTop(req, res) {
  // returns top res.params.maxnum scores
  if (!+req.params.maxnum) {
    return res.status(400).json({ message: "Maxnum is NaN" });
  }
  let results = await scores[req.params.size]
    .find({}, "score -_id")
    .limit(+req.params.maxnum)
    .sort({ score: -1 })
    .populate({ path: "user", select: "screenName uid -_id" });
  if (!results) {
    logger.error("No scores found, getTop");
    res.status(404).json({
      message: "No results found",
    });
    return;
  }
  res.status(200).json(results);
}

// GET/POST /size/:size/token/(:token)
async function getByToken(req, res) {
  let token = req.body.token || req.params.token;

  let tokenRes = await validate_token(token);
  if (!tokenRes.valid || !tokenRes.user_data) {
    return res
      .status(401)
      .json({ message: "Invalid token, try refreshing the page" });
  }

  let user = await User.findOne({ uid: tokenRes.user_data.uid });
  if (!user) {
    logger.error("User not found, getByToken");
    res.status(404).json({
      message: "User not found",
    });
    return;
  }
  const userScore = user.scores.get(req.params.size);
  if (!userScore) {
    res.status(404).json({ message: "Score not found" });
    return;
  }
  let score = await scores[req.params.size].findOne(
    { _id: userScore },
    "-history -hash"
  );
  if (!score) {
    logger.error("Score not found, getByToken");
    res.status(404).json({ message: "Score not found" });
    return;
  }
  score.user = user;
  res.status(200).json({ score });
}

//used for getting the top scores and the score and rank for a token in one call
// GET/POST /size/:size/fetchboard/:maxnum/(:token?)
// body: { token: "token", rankMinus: 2, rankPlus: 2 }
async function getByTokenAndRank(req, res) {
  let topBoard = await scores[req.params.size]
    .find({}, "score -_id")
    .sort({ score: -1 })
    .populate({ path: "user", select: "screenName uid -_id" });

  let token = req.body.token || req.params.token;

  if (!token) {
    topBoard = topBoard.slice(0, +req.params.maxnum);
    res.status(200).json({ topBoard });
    return;
  }

  const tokenRes = await validate_token(token);
  if (!tokenRes.valid || !tokenRes.user_data) {
    return res
      .status(401)
      .json({ message: "Invalid token, try refreshing the page" });
  }

  let user = await User.findOne({ uid: tokenRes.user_data.uid });

  if (!user) {
    topBoard = topBoard.slice(0, +req.params.maxnum);
    res.status(200).json({ topBoard });
    return;
  }

  const userScore = user.scores.get(req.params.size);
  if (!userScore) {
    topBoard = topBoard.slice(0, +req.params.maxnum);
    res.status(200).json({ topBoard });
    return;
  }

  //mongoose didn't want to use .populate() so this is a dumber looking workaround
  let score: IScore | null = await scores[req.params.size].findOne(
    { _id: userScore },
    "-history -hash"
  );
  if (!score) {
    topBoard = topBoard.slice(0, +req.params.maxnum);
    res.status(200).json({ topBoard });
    return;
  }

  let rank: number = await scores[req.params.size]
    .find({ score: { $gt: score.score } })
    .count();

  rank++;

  let rivals: any = {};

  if ((req.body.rankMinus || req.body.rankPlus) && rank > req.params.maxnum) {
    for (let i = 1; i <= req.body.rankMinus; i++) {
      // rank - i so better than the users
      let userMinus = topBoard[rank - i - 1];
      if (userMinus && rank - i > req.params.maxnum) {
        rivals[rank - i] = userMinus;
      }
    }
    for (let i = 1; i <= req.body.rankPlus; i++) {
      // rank + i so worse than the users
      let userPlus = topBoard[rank + i - 1];
      if (userPlus && rank + i > req.params.maxnum) {
        rivals[rank + i] = userPlus;
      }
    }
  }

  topBoard = topBoard.slice(0, +req.params.maxnum);
  score.user = user;
  res.status(200).json({
    topBoard,
    score,
    rank,
    rivals,
  });
}

// POST /size/:size
async function createScore(req, res) {
  const session = await startSession();
  session.startTransaction();
  try {
    const tokenRes = await validate_token(req.body.user.token);
    if (!tokenRes.valid || !tokenRes.user_data) {
      throw new Error("Invalid token, try refreshing the page");
    }

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

    if (fetch_res.status == 400) {
      throw new Error(`HAC couldn't parse the game: ${await fetch_res.text()}`);
    }

    if (fetch_res.status == 418) {
      logger.error("HAC validation failed:", await fetch_res.text());
      throw new Error(`HAC deemed the history to be invalid`);
    }

    if (!fetch_res.ok) {
      throw new Error(
        `HAC server returned unexpected HTTP status code: ${fetch_res.status}`
      );
    }

    let HACResponse: any = await fetch_res.json();
    if (+req.params.size !== HACResponse.board_w) {
      // hac only supports boards with ratio of 1:1 so height and width must be equal
      throw new Error("HAC returned a history with the wrong size");
    }
    if (
      Math.abs(+req.body.score - HACResponse.score) > HACResponse.score_margin
    ) {
      throw new Error("Score does not match the HAC response");
    }
    if (
      !(await validateUniqueHash(
        HACResponse.run_hash
        // req.body.history.substring(0, 1000)
      ))
    ) {
      throw new Error("Score already exists");
    }

    let user = {} as IUser | null;
    let newScore = true;
    let nameChanged = false;

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
      let prevScore: IScore | undefined = undefined;
      try {
        prevScore = await scores[req.params.size]
          .findOne({ _id: previousScore }, "-history -hash")
          .exec();
      } catch (err) {
        logger.error(err);
        res.status(500).json({
          message: "Error while getting score by token",
          error: err,
        });
        return;
      }
      if (!prevScore) {
        throw new Error("Previous score not found");
      }
      newScore = false;
      if (req.body.score <= prevScore.score) {
        throw new Error("Score must be greater than the previous score");
      }
      scores[req.params.size].deleteOne({ _id: prevScore._id }, (err) => {
        //this should be fine to delete this early since the transaction should handle it fine
        if (err) {
          throw new Error(err);
        }
      });
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

    let userSaved: IUser = await user.save();
    if (!userSaved) {
      logger.error(userSaved);
      throw new Error("User not saved");
    }

    let scoreSaved: IScore = await score.save();
    if (!scoreSaved) {
      logger.error(scoreSaved);
      throw new Error("Score not saved");
    }

    res.status(201).json({
      message: newScore
        ? "Score created successfully"
        : "Score updated successfully",
      createdScore: scoreSaved,
      nameChanged,
    });
    await session.commitTransaction();
  } catch (err) {
    logger.error(err);
    res.status(500).json({
      message: err.message || "Error while creating/updating score",
    });
    await session.abortTransaction();
  } finally {
    session.endSession();
  }
}

router.all("/size/:size/*|/size/:size", preSize);
router.get("/size/:size", getAll);
router.get("/size/:size/count", getCount);
router.get("/size/:size/:maxnum", getTop);
router.get("/size/:size/token/:token", getByToken);
router.get("/size/:size/fetchboard/:maxnum/:token?", getByTokenAndRank);
router.post("/size/:size/token", getByToken);
router.post("/size/:size/fetchboard/:maxnum/", getByTokenAndRank);
router.post("/size/:size/", createScore);

export default router;
