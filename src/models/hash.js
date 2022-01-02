const { getDatabase } = require("../mongo");

const collectionName = "hashes";

async function validateUniqueHistoryStart(historyStart) {
  const db = await getDatabase();
  const hashes = await db.collection(collectionName).find().toArray();
  for (let i = 0; i < hashes.length; i++) {
    if (hashes[i].historyStart == historyStart) {
      return false;
    }
  }
  return true;
}

async function validateUniqueHash(hash, historyStart) {
  const db = await getDatabase();
  const hashes = await db.collection(collectionName).find().toArray();
  for (let i = 0; i < hashes.length; i++) {
    if (hashes[i].hash === hash) {
      return false;
    }
  }
  if (await validateUniqueHistoryStart(historyStart)) {
    return true;
  }
  return false;
}

async function addHash(hash, historyStart, connectedID) {
  const db = await getDatabase();
  const hashDocument = await db
    .collection(collectionName)
    .insertOne({ hash, historyStart, connectedID });
  return hashDocument;
}

module.exports = {
  validateUniqueHash,
  addHash,
};
