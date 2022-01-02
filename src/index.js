const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const morgan = require("morgan");

const { startDatabase } = require("./mongo");

const scoresRoute = require("./routes/scores");
const adminRoute = require("./routes/admin");

const app = express();
const port = process.env.PORT || 5000;

app.use(helmet());
app.use(express.json());
app.use(cors());
app.use(morgan("dev"));

app.use("/scores", scoresRoute);
app.use("/admin", adminRoute);

app.use((req, res, next) => {
  const error = new Error("Not found");
  error.status = 404;
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
