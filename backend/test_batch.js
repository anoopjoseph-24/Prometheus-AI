const { GoogleGenerativeAI } = require('@google/generative-ai');
const dotenv = require('dotenv');

dotenv.config();

const apiKey = process.env.GEMINI_API_KEY;
if (!apiKey) {
  console.error('API key not found.');
  process.exit(1);
}

const genAI = new GoogleGenerativeAI(apiKey);

async function testBatch() {
  try {
    console.log('Testing batchEmbedContents on gemini-embedding-2...');
    const model = genAI.getGenerativeModel({ model: 'gemini-embedding-2' });
    
    const texts = ['Chunk number one', 'Chunk number two', 'Chunk number three'];
    const requests = texts.map(t => ({
      content: { parts: [{ text: t }] }
    }));

    const result = await model.batchEmbedContents({ requests });
    if (result && result.embeddings) {
      console.log(`✅ Success! Received ${result.embeddings.length} embeddings.`);
      result.embeddings.forEach((emb, i) => {
        console.log(`  Embedding ${i + 1} dimensions: ${emb.values.length}`);
      });
    } else {
      console.log('❌ Failed: result or result.embeddings is undefined.');
    }
  } catch (error) {
    console.error('❌ Error during batchEmbedContents:', error.message);
  }
}

testBatch();
