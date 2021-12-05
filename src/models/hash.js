const { getDatabase } = require("../mongo");

const collectionName = "hashes";

async function validateUniqueHash(hash) {
  const db = await getDatabase();
  const hashes = await db.collection(collectionName).find().toArray();
  for (let i = 0; i < hashes.length; i++) {
    if (hashes[i].hash === hash) {
      return false;
    }
  }
  return true;
}

async function addHash(hash) {
  const db = await getDatabase();
  const hashDocument = await db.collection(collectionName).insertOne({ hash });
  return hashDocument;
}

module.exports = {
  validateUniqueHash,
  addHash,
};
