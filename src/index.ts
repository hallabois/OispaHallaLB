import dotenv from "dotenv";
dotenv.config();

import express from "express";
import cors from "cors";
import helmet from "helmet";
import morgan from "morgan";

import { connectDatabase } from "./io/mongo";
import logger from "./io/logger";

logger.info("Logger connected");

import scoresRoute from "./routes/scores";
import adminRoute from "./routes/admin";
import metaRoute from "./routes/meta";

const app = express();
const port = +(process?.env?.PORT! ?? 5000);

const stream: morgan.StreamOptions = {
  write: (message) =>
    logger.notice(message.substring(0, message.lastIndexOf("\n"))), // the http loglevel isn't supported by winston-syslog
};

app.use(helmet());
app.use(express.json({ limit: 13000000 })); // Limit json body size to 13mb
app.use(cors());
app.use(morgan("dev", { stream }));

app.use("/scores", scoresRoute);
app.use("/admin", adminRoute);
app.use("/meta", metaRoute);

app.get("/alive", async (req, res, next) => {
  res.status(200).json({ alive: true });
});

app.use((req, res, next) => {
  res.status(404).json({ message: "Not found" });
});

app.use((err: Error, req, res, next) => {
  res.status(500).json({
    message: err.message,
  });
});

connectDatabase(process.env.URI).then(() => {
  app.listen(port, () => {
    logger.info(`Server is running on port ${port}`);
  });
});
