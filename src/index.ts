import dotenv from "dotenv";
dotenv.config();

import express from "express";
import cors from "cors";
import helmet from "helmet";
import morgan from "morgan";
const ObjectID = require("mongoose").Types.ObjectId;

import { startDatabase } from "./mongo";

import scoresRoute from "./routes/scores";
import adminRoute from "./routes/admin";

const app = express();
const port = +process.env.PORT! || 5000;

app.use(helmet());
app.use(express.json());
app.use(cors());
app.use(morgan("dev"));

app.use("/scores", scoresRoute);
app.use("/admin", adminRoute);

app.get("/verifyid/:id", async (req, res, next) => {
  const isValid = ObjectID.isValid(req.params.id);
  if (isValid) {
    res.status(200).json({ valid: true });
  } else {
    res.status(200).json({ valid: false });
  }
});

app.use((req, res, next) => {
  const error = new Error("Not found");
  next(error);
});

app.use((err, req, res, next) => {
  res.status(err.status || 500).json({
    error: {
      message: err.message,
    },
  });
});

startDatabase().then(() => {
  app.listen(port, () => {
    console.log(`Server is running on port ${port}`);
  });
});
