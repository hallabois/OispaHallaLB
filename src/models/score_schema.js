const mongoose = require("mongoose");

const scoreSchema = mongoose.Schema(
  {
    screenName: { type: String, required: true },
    score: { type: Number, required: true },
    breaks: { type: Number, required: true },
    history: { type: String, required: true },
  },
  { timestamps: true }
);

module.exports = mongoose.model("Score", scoreSchema);
