const { MongoMemoryServer } = require("mongodb-memory-server");
const mongoose = require("mongoose");

export async function connectDatabase(uri?: string | undefined) {
  if (!uri) {
    const mongod = new MongoMemoryServer();
    await mongod.start();
    uri = mongod.getUri();
  }

  await mongoose.connect(uri, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
  });
}
