import express from "express";

import logger from "../io/logger";
import { preSize, scores } from "./scores";
import { User } from "./scores";
import { IUser } from "../models/user";
import { validate_token } from "../io/oispahalla";
import { IScore } from "../models/score";

const router = express.Router();

if (process.env.ADMIN_TOKEN == undefined) {
  logger.warning("ADMIN_TOKEN environment variable is not set!");
}

// ALL /admin/
async function preAdmin(req, res, next) {
  if (process.env.ADMIN_TOKEN === req.query.token) {
    logger.info(`Admin request, validated by the token from IP ${req.ip}`);
    next();
  } else {
    const tokenRes = await validate_token(req.query.token);
    console.log(tokenRes);
    if (tokenRes.valid && tokenRes.user_data && tokenRes.user_data.admin) {
      logger.info(`Admin request, validated by OH from IP ${req.ip}`);
      next();
    } else {
      logger.error(`Admin request validation failed from IP ${req.ip}`);
      res.status(401).json({
        message: "Admin token does not match, your IP has been logged",
      });
    }
  }
}

// GET /admin/score/:size/id/:id
async function getScoreById(req, res) {
  let score = await scores[+req.params.size]
    .findById(req.params.id)
    .populate({ path: "user" });
  if (score) {
    score = score.toObject();
    score.rank = await getRankFromScore(score);
    res.status(200).json(score);
    return;
  }
  logger.error(`Admin score request by ID failed: ${req.params.id}`);
  res.status(404).json({ message: "Score not found", userId: req.params.id });
}

// mongoose doesn't (afaik) support populating a map, so we have to do it manually
async function getScoreFromUser(user: IUser) {
  let userObj: IUser = user.toObject();
  for (let key of user.scores.keys()) {
    let score: IScore = await scores[+key].findById(user.scores.get(key));
    score = score.toObject();
    score.rank = await getRankFromScore(score);
    userObj.scores[key] = score;
  }
  return userObj;
}

async function getRankFromScore(score: IScore) {
  const rank = await scores[score.size].countDocuments({
    score: { $gt: score.score },
  });
  return rank;
}

// GET /admin/user/id/:id
async function getUserById(req, res) {
  const user = await User.findById(req.params.id);
  if (!user) {
    logger.error(`Admin user request by ID failed: ${req.params.id}`);
    res.status(404).json({ message: "User not found", id: req.params.id });
    return;
  }

  res.status(200).json(await getScoreFromUser(user));
}

// GET /admin/user/uid/:uid
async function getUserByUid(req, res) {
  const user = await User.findOne({ uid: req.params.uid });
  if (!user) {
    logger.error(`Admin user request by UID failed: ${req.params.uid}`);
    res.status(404).json({ message: "User not found", uid: req.params.uid });
    return;
  }
  res.status(200).json(await getScoreFromUser(user));
}

//GET /admin/user/name/:name
async function getUserByName(req, res) {
  const user = await User.findOne({ screenName: req.params.name });
  if (!user) {
    logger.error(`Admin user request by name failed: ${req.params.name}`);
    res.status(404).json({ message: "User not found", name: req.params.name });
    return;
  }

  res.status(200).json(await getScoreFromUser(user));
}

router.all("*", preAdmin);
router.all("/score/size/:size/*|/score/size/:size", preSize);
router.get("/score/size/:size/id/:id", getScoreById);
router.get("/user/id/:id", getUserById);
router.get("/user/uid/:uid", getUserByUid);
router.get("/user/name/:name", getUserByName);

export default router;
