const express = require("express");
const router = express.Router();
const fetch = require("node-fetch-commonjs");

const Score = require("../models/score_schema");
const { validateUniqueHash, addHash } = require("../models/hash");

router.get("/", async (req, res, next) => {
  Score.find({}, "-_id").exec((err, results) => {
    if (err) {
      console.log(err);
      res.status(500).json({
        message: "Error while fetching scores",
        error: err,
      });
    } else {
      res.status(200).json(results);
    }
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
    } else {
      res.status(200).json({ count: results.length });
    }
  });
});

router.get("/:maxnum", async (req, res, next) => {
  Score.find({}, "-_id -breaks -history -createdAt -updatedAt -__v") //only screenname and score are needed
    .limit(parseInt(req.params.maxnum))
    .sort({ score: -1 })
    .exec((err, results) => {
      if (err) {
        console.log(err);
        res.status(500).json({
          message: "Error while getting scores",
          error: err,
        });
      } else {
        res.status(200).json(results);
      }
    });
});

router.get("/id/:id", async (req, res, next) => {
  Score.findById(req.params.id).exec((err, score) => {
    if (err) {
      console.log(err);
      res.status(500).json({
        message: "Error while getting score by ID",
        error: err,
      });
    } else {
      if (score) {
        res.status(200).json(score);
      } else {
        console.log("Score request by ID failed:", req.params.id);
        res.status(404).json({ message: "Score not found", id: req.params.id });
      }
    }
  });
});

async function createNewScore(req, res, hash) {
  const score = new Score({
    screenName: req.body.screenName,
    score: req.body.score,
    breaks: req.body.breaks,
    history: req.body.history,
  });
  score
    .save()
    .then((result) => {
      addHash(hash);
      res.status(201).json({
        message: "Score created",
        createdScore: score,
      });
    })
    .catch((err) => {
      console.log(err);
      res.status(500).json({
        message: "Error while creating new score",
        error: err,
      });
    });
}

router.post("/", async (req, res, next) => {
  fetch("https://hac.oispahalla.com:8000/HAC/validate/" + req.body.history) // history should include the grid size
    .then(async function (u) {
      if (u.status == 200) {
        return u.json();
      } else {
        res.status(u.status).json({
          message: `HAC server returned unexpected HTTP status code: ${u.status}`,
          hac_response: u,
        });
      }
    })
    .then(async function (json) {
      if (json.valid) {
        if (req.body.score == json.score) {
          if (req.body.breaks == json.breaks) {
            if (await validateUniqueHash(json.run_hash)) {
              if (req.body.id) {
                //TODO: kinda scuffed since we have to query for the score twice
                Score.findOne({ _id: req.body.id }, (err, score) => {
                  if (err) {
                    console.log(err);
                    res.status(500).json({
                      message:
                        "Internal server error while finding score with ID",
                      error: err,
                    });
                  }
                  if (score) {
                    if (req.body.score > score.score) {
                      const entries = Object.keys(req.body);
                      const updates = {};

                      for (let i = 0; i < entries.length; i += 1) {
                        if (entries[i] != "id") {
                          updates[entries[i]] = Object.values(req.body)[i];
                        }
                      }

                      Score.findOneAndUpdate({ _id: req.body.id }, updates, {
                        new: true,
                      }).exec((err, result) => {
                        if (err) {
                          console.log(err);
                          res.status(500).json({
                            message: "Error while updating score",
                            error: err,
                          });
                        } else {
                          addHash(json.run_hash);
                          res.status(201).json({
                            message: "Score updated",
                            updatedScore: result,
                          });
                        }
                      });
                    } else {
                      res.status(400).json({
                        message:
                          "Score provided is not greater than existing score",
                        currentScore: score,
                      });
                    }
                  } else {
                    createNewScore(req, res, json.run_hash);
                  }
                });
              } else {
                createNewScore(req, res, json.run_hash);
              }
            } else {
              res.status(403).json({
                message: "Score already exists",
                submittedScore: req.body,
              });
            }
          } else {
            res.status(403).json({
              message: "Breaks do not match the HAC response",
              submittedScore: req.body,
              HACResponse: json,
            });
          }
        } else {
          res.status(403).json({
            message: "Score does not match the HAC response",
            submittedScore: req.body,
            HACResponse: json,
          });
        }
      } else {
        res.status(403).json({
          message: "HAC deemed the history to be invalid",
          submittedScore: req.body,
          HACResponse: json,
        });
      }
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

module.exports = router;
