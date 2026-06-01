const { GoogleGenerativeAI } = require('@google/generative-ai');
const path = require('path');
const dotenv = require('dotenv');

// Load environment variables using absolute path relative to this script
dotenv.config({ path: path.join(__dirname, '..', '.env') });

/**
 * Gets the current API key from environment variables.
 */
function getApiKey() {
  return process.env.GEMINI_API_KEY;
}

/**
 * Gets a fresh or cached GoogleGenerativeAI instance.
 */
function getGenAI() {
  const apiKey = getApiKey();
  if (!apiKey) return null;
  return new GoogleGenerativeAI(apiKey);
}

/**
 * Generates a deterministic mock 3072-dimensional float array based on the text hash.
 * This matches the dimensionality of gemini-embedding-2.
 */
function generateMockEmbedding(text) {
  const vector = [];
  let hash = 0;
  for (let i = 0; i < text.length; i++) {
    hash = (hash << 5) - hash + text.charCodeAt(i);
    hash |= 0;
  }
  
  for (let i = 0; i < 3072; i++) {
    const val = Math.sin(hash + i) * 10000;
    vector.push(val - Math.floor(val) * 2 - 1);
  }
  return vector;
}

/**
 * Calls Gemini gemini-embedding-2 to create a vector embedding for a single text chunk.
 * @param {string} text Text chunk to embed
 * @param {boolean} forceMock If true, bypass Gemini API and generate a mock embedding
 */
async function generateEmbedding(text, forceMock = false) {
  if (forceMock) {
    return generateMockEmbedding(text);
  }

  const apiKey = getApiKey();
  if (!apiKey) {
    console.warn(`\x1b[33m[WARN] GEMINI_API_KEY is not defined in backend/.env. Using deterministic mock embeddings for offline local testing.\x1b[0m`);
    return generateMockEmbedding(text);
  }
  
  const genAI = getGenAI();
  if (!genAI) {
    console.warn(`\x1b[33m[WARN] GoogleGenerativeAI client could not be initialized. Using deterministic mock embeddings.\x1b[0m`);
    return generateMockEmbedding(text);
  }

  try {
    const model = genAI.getGenerativeModel({ model: 'gemini-embedding-2' });
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

/**
 * Calls Gemini gemini-embedding-2 to create vector embeddings for an array of text chunks in batches.
 * This is highly optimized and prevents rate-limiting issues (429 errors).
 * @param {string[]} texts Array of text chunks to embed
 * @returns {Promise<{embeddings: number[][], isMock: boolean}>} Array of vector embeddings and a fallback flag
 */
async function generateEmbeddingsBatch(texts) {
  if (texts.length === 0) return { embeddings: [], isMock: false };
  
  const apiKey = getApiKey();
  if (!apiKey) {
    console.warn(`\x1b[33m[WARN] GEMINI_API_KEY is not defined in backend/.env. Using deterministic mock embeddings for offline local testing.\x1b[0m`);
    return { embeddings: texts.map(t => generateMockEmbedding(t)), isMock: true };
  }

  const genAI = getGenAI();
  if (!genAI) {
    console.warn(`\x1b[33m[WARN] GoogleGenerativeAI client could not be initialized. Using deterministic mock embeddings.\x1b[0m`);
    return { embeddings: texts.map(t => generateMockEmbedding(t)), isMock: true };
  }

  const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

  try {
    const model = genAI.getGenerativeModel({ model: 'gemini-embedding-2' });
    
    // Split texts into chunks of 100 to stay within the API batch limit
    const batchSize = 100;
    const allEmbeddings = [];
    
    for (let i = 0; i < texts.length; i += batchSize) {
      const textBatch = texts.slice(i, i + batchSize);
      console.log(`Embedding batch: processing chunks ${i + 1} to ${Math.min(i + batchSize, texts.length)} of ${texts.length}...`);
      
      const requests = textBatch.map(t => ({
        content: { parts: [{ text: t }] }
      }));
      
      let success = false;
      let retries = 3;
      let delay = 5000; // start with 5 seconds wait on rate limit
      
      while (!success && retries > 0) {
        try {
          const result = await model.batchEmbedContents({ requests });
          if (result && result.embeddings) {
            const values = result.embeddings.map(emb => emb.values);
            allEmbeddings.push(...values);
            success = true;
          } else {
            throw new Error('Received empty response from Gemini Batch Embeddings API.');
          }
        } catch (err) {
          const errMsg = err.message || '';
          if (errMsg.includes('429') || errMsg.includes('Quota exceeded') || errMsg.includes('Too Many Requests')) {
            retries--;
            if (retries > 0) {
              console.warn(`[WARN] Embedding rate limit hit (429). Retrying in ${delay / 1000}s... (${retries} retries left)`);
              await sleep(delay);
              delay *= 1.5; // exponential backoff
            } else {
              throw err;
            }
          } else {
            throw err;
          }
        }
      }
    }
    
    return { embeddings: allEmbeddings, isMock: false };
  } catch (error) {
    console.error('Error querying Gemini Batch Embeddings API:', error.message);
    console.warn('\x1b[33m[WARN] Falling back to offline mock embeddings for this entire batch due to API error.\x1b[0m');
    return { embeddings: texts.map(t => generateMockEmbedding(t)), isMock: true };
  }
}

module.exports = { generateEmbedding, generateEmbeddingsBatch };
