const { GoogleGenerativeAI } = require('@google/generative-ai');
const dotenv = require('dotenv');

dotenv.config();

const apiKey = process.env.GEMINI_API_KEY;
console.log('API Key loaded:', apiKey ? apiKey.substring(0, 10) + '...' : 'undefined');

if (!apiKey) {
  console.error('API key is not configured.');
  process.exit(1);
}

const genAI = new GoogleGenerativeAI(apiKey);

async function runTests() {
  console.log('\n--- TESTING CHAT MODELS ---');
  const chatModels = ['gemini-flash-latest', 'gemini-2.0-flash', 'gemini-1.5-flash'];
  for (const modelName of chatModels) {
    try {
      console.log(`Testing Chat Model: ${modelName}...`);
      const model = genAI.getGenerativeModel({ model: modelName });
      const result = await model.generateContent('Say Hello');
      const response = await result.response;
      console.log(`✅ Success with ${modelName}! Response: "${response.text().trim()}"`);
    } catch (error) {
      console.error(`❌ Error with ${modelName}:`, error.message);
    }
  }

  console.log('\n--- TESTING EMBEDDING MODELS ---');
  const embeddingModels = ['text-embedding-004', 'gemini-embedding-2', 'gemini-embedding-001'];
  for (const modelName of embeddingModels) {
    try {
      console.log(`Testing Embedding Model: ${modelName}...`);
      const model = genAI.getGenerativeModel({ model: modelName });
      const result = await model.embedContent('Hello World');
      if (result && result.embedding && result.embedding.values) {
        console.log(`✅ Success with ${modelName}! Dimensions: ${result.embedding.values.length}`);
      } else {
        console.log(`❌ Empty response with ${modelName}`);
      }
    } catch (error) {
      console.error(`❌ Error with ${modelName}:`, error.message);
    }
  }
}

runTests();
