const { GoogleGenerativeAI } = require('@google/generative-ai');
const dotenv = require('dotenv');

dotenv.config();

const apiKey = process.env.GEMINI_API_KEY;
let genAI = null;
if (apiKey) {
  genAI = new GoogleGenerativeAI(apiKey);
}

/**
 * Synthesizes a mockup response based on retrieved chunks when offline.
 */
function generateOfflineResponse(query, chunks, isApiKeyMissing = true) {
  if (chunks.length === 0) {
    return "I couldn't find any relevant information in the crawled pages to answer your question. Please try crawling a different site or asking something else.";
  }

  const bestMatch = chunks[0];
  const citationsList = chunks.map((c, idx) => `[Source ${idx + 1}] (${c.url})`).join(', ');

  if (isApiKeyMissing) {
    return `[OFFLINE DEMO MODE - GEMINI_API_KEY NOT CONFIGURED]

Based on the crawled pages, here is the most relevant section retrieved regarding "${query}":

"${bestMatch.text}"

Citations and sources consulted: ${citationsList}.

*Note: Add your GEMINI_API_KEY inside the backend/.env file to generate fully conversational, AI-synthesized answers.*`;
  } else {
    return `[API QUERY FALLBACK - SEMANTIC SEARCH MATCH]

Based on the crawled pages, here is the most relevant section retrieved regarding "${query}":

"${bestMatch.text}"

Citations and sources consulted: ${citationsList}.

*Note: The Gemini API returned an error (e.g. rate limit, quota exceeded, or temporary outage), so we have fallen back to returning the best-matching raw text snippet directly.*`;
  }
}

/**
 * Context-grounded Gemini prompt execution using gemini-flash-latest
 */
async function answerQuestionWithContext(query, contextChunks) {
  if (!apiKey) {
    return generateOfflineResponse(query, contextChunks, true);
  }

  if (!genAI) {
    genAI = new GoogleGenerativeAI(apiKey);
  }

  try {
    const model = genAI.getGenerativeModel({
      model: 'gemini-flash-latest',
      systemInstruction: 'You are Prometheus AI, a RAG assistant. You must ONLY answer questions based on the provided Context. If the answer cannot be found in the context, politely state that you do not know. Never mention "Antigravity". Always cite your sources using [Source X] notation where X corresponds to the source index number.'
    });

    const contextText = contextChunks
      .map((c, idx) => `[Source ${idx + 1}]\nURL: ${c.url}\nTitle: ${c.title}\nContent: ${c.text}`)
      .join('\n\n---\n\n');

    const prompt = `Context:\n${contextText}\n\nQuestion: ${query}\n\nAnswer:`;

    const result = await model.generateContent(prompt);
    const response = await result.response;
    return response.text();
  } catch (error) {
    console.error('Error generating chat completion:', error.message);
    return `[API ERROR] Failed to query Gemini model. Falling back to retrieved context:\n\n` + generateOfflineResponse(query, contextChunks, false);
  }
}

module.exports = { answerQuestionWithContext };
