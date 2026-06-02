const fs = require('fs');
const path = require('path');
const { MongoClient } = require('mongodb');

const DB_PATH = path.join(__dirname, '..', 'data', 'db.json');

// Ensure data directory exists for local fallback
const dataDir = path.join(__dirname, '..', 'data');
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}
if (!fs.existsSync(DB_PATH)) {
  fs.writeFileSync(DB_PATH, JSON.stringify({ pages: [], chunks: [], settings: {} }, null, 2));
}

let cachedClient = null;
let cachedDb = null;

async function getMongoDb() {
  const uri = process.env.MONGODB_URI;
  if (!uri || uri.trim().length === 0) {
    return null;
  }

  if (cachedClient && cachedDb) {
    return cachedDb;
  }

  try {
    console.log("🔌 Connecting to MongoDB Atlas...");
    const client = new MongoClient(uri);
    await client.connect();
    
    let dbName = 'prometheus';
    try {
      const urlObj = new URL(uri);
      const pathSegment = urlObj.pathname.substring(1);
      if (pathSegment) dbName = pathSegment;
    } catch (urlErr) {
      // URL segments parsing fallback
    }
    
    const db = client.db(dbName);
    cachedClient = client;
    cachedDb = db;
    console.log(`✅ Connected to MongoDB database: ${dbName}`);
    return db;
  } catch (err) {
    console.error("❌ Failed to connect to MongoDB:", err.message);
    throw err;
  }
}

async function readDB() {
  const db = await getMongoDb();
  if (db) {
    try {
      const pages = await db.collection('pages').find({}).toArray();
      const chunks = await db.collection('chunks').find({}).toArray();
      
      const configDoc = await db.collection('settings').findOne({ key: 'config' });
      const summaryDoc = await db.collection('settings').findOne({ key: 'summary' });
      const faqsDoc = await db.collection('settings').findOne({ key: 'faqs' });

      // Clean MongoDB custom _id fields out to keep payload clean
      const cleanPages = pages.map(({ _id, ...rest }) => rest);
      const cleanChunks = chunks.map(({ _id, ...rest }) => rest);

      return {
        pages: cleanPages,
        chunks: cleanChunks,
        settings: configDoc ? configDoc.value : {},
        summary: summaryDoc ? summaryDoc.value : null,
        faqs: faqsDoc ? faqsDoc.value : null
      };
    } catch (err) {
      console.error("Error reading from MongoDB:", err);
      return { pages: [], chunks: [], settings: {} };
    }
  } else {
    // Local db.json fallback
    try {
      const data = fs.readFileSync(DB_PATH, 'utf8');
      return JSON.parse(data);
    } catch (error) {
      console.error('Error reading local JSON database:', error);
      return { pages: [], chunks: [], settings: {} };
    }
  }
}

async function writeDB(data) {
  const db = await getMongoDb();
  if (db) {
    try {
      // 1. Overwrite Pages
      await db.collection('pages').deleteMany({});
      if (data.pages && data.pages.length > 0) {
        // Strip any existing MongoDB _id fields to avoid inserting duplicate keys
        const cleanPages = data.pages.map(({ _id, ...rest }) => rest);
        await db.collection('pages').insertMany(cleanPages);
      }

      // 2. Overwrite Chunks
      await db.collection('chunks').deleteMany({});
      if (data.chunks && data.chunks.length > 0) {
        // Strip any existing MongoDB _id fields
        const cleanChunks = data.chunks.map(({ _id, ...rest }) => rest);
        await db.collection('chunks').insertMany(cleanChunks);
      }

      // 3. Overwrite Metadata
      await db.collection('settings').updateOne(
        { key: 'config' },
        { $set: { value: data.settings || {} } },
        { upsert: true }
      );
      
      await db.collection('settings').updateOne(
        { key: 'summary' },
        { $set: { value: data.summary || null } },
        { upsert: true }
      );

      await db.collection('settings').updateOne(
        { key: 'faqs' },
        { $set: { value: data.faqs || null } },
        { upsert: true }
      );
    } catch (err) {
      console.error("Error writing to MongoDB:", err);
    }
  } else {
    // Local db.json fallback
    try {
      fs.writeFileSync(DB_PATH, JSON.stringify(data, null, 2));
    } catch (error) {
      console.error('Error writing local JSON database:', error);
    }
  }
}

module.exports = {
  readDB,
  writeDB,
  getMongoDb
};
