const { GoogleGenerativeAI } = require('@google/generative-ai');
const dotenv = require('dotenv');

dotenv.config();

const apiKey = process.env.GEMINI_API_KEY;

let genAI = null;
if (apiKey) {
  genAI = new GoogleGenerativeAI(apiKey);
}

/**
 * Generates a deterministic mock 768-dimensional float array based on the text hash.
 * This allows the RAG search and sitemap pipelines to function offline without an API key.
 */
function generateMockEmbedding(text) {
  const vector = [];
  // Basic hash calculation based on text characters
  let hash = 0;
  for (let i = 0; i < text.length; i++) {
    hash = (hash << 5) - hash + text.charCodeAt(i);
    hash |= 0; // Convert to 32bit integer
  }
  
  for (let i = 0; i < 768; i++) {
    // Generate a deterministic float between -1.0 and 1.0 using sin hash
    const val = Math.sin(hash + i) * 10000;
    vector.push(val - Math.floor(val) * 2 - 1);
  }
  return vector;
}

/**
 * Calls Gemini text-embedding-004 to create a vector embedding for a given text chunk.
 * Falls back to offline mock embeddings if no API key is provided.
 * @param {string} text The text content to encode
 * @returns {Promise<number[]>} Array of 768 floating point numbers representing the vector
 */
async function generateEmbedding(text) {
  if (!apiKey) {
    console.warn(`\x1b[33m[WARN] GEMINI_API_KEY is not defined in backend/.env. Using deterministic 768-dimensional mock embeddings for offline local testing.\x1b[0m`);
    return generateMockEmbedding(text);
  }
  
  if (!genAI) {
    genAI = new GoogleGenerativeAI(apiKey);
  }

  try {
    const model = genAI.getGenerativeModel({ model: 'text-embedding-004' });
    const result = await model.embedContent(text);
    
    if (result && result.embedding && result.embedding.values) {
      return result.embedding.values;
    } else {
      throw new Error('Received empty embedding values from Gemini API.');
    }
  } catch (error) {
    console.error('Error querying Gemini Embeddings API:', error.message);
    console.warn('\x1b[33m[WARN] Falling back to offline mock embeddings due to API error.\x1b[0m');
    return generateMockEmbedding(text);
  }
}

module.exports = { generateEmbedding };
