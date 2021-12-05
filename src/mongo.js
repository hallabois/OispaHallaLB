const { MongoMemoryServer } = require("mongodb-memory-server");
const { MongoClient } = require("mongodb");
const mongoose = require("mongoose");

async function startDatabase() {
  const mongo = await MongoMemoryServer.create();
  const mongoDBURL = mongo.getUri();
  const connection = await MongoClient.connect(mongoDBURL, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
  });
  database = connection.db();
  mongoose.connect(mongoDBURL, {});
}

async function getDatabase() {
  if (!database) await startDatabase();
  return database;
}

module.exports = {
  getDatabase,
  startDatabase,
};
