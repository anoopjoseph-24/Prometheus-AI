const { GoogleGenerativeAI } = require('@google/generative-ai');
const path = require('path');
const dotenv = require('dotenv');
const axios = require('axios');

// Load environment variables using absolute path relative to this script
dotenv.config({ path: path.join(__dirname, '..', '.env') });

function getApiKey() {
  return process.env.GEMINI_API_KEY;
}

function getGenAI() {
  const apiKey = getApiKey();
  if (!apiKey) return null;
  return new GoogleGenerativeAI(apiKey);
}

/**
 * Extracts a concise summary context from crawled pages to stay within token limits.
 */
function prepareContextSummary(pages) {
  if (!pages || pages.length === 0) return '';
  return pages.map((p, idx) => {
    // Take the title, url, description, and first 1200 characters of text to preserve vital details & statistics
    const textSnippet = p.content ? p.content.substring(0, 1200) : '';
    return `[Document #${idx + 1}]\nURL: ${p.url}\nTitle: ${p.title}\nDescription: ${p.description || 'N/A'}\nContent Snippet: ${textSnippet}\n---\n`;
  }).join('\n');
}

/**
 * Cleans markdown code blocks (e.g. ```json ... ```) from LLM text responses.
 */
function cleanJsonResponse(text) {
  let cleaned = text.trim();
  if (cleaned.startsWith('```json')) {
    cleaned = cleaned.substring(7);
  } else if (cleaned.startsWith('```')) {
    cleaned = cleaned.substring(3);
  }
  if (cleaned.endsWith('```')) {
    cleaned = cleaned.substring(0, cleaned.length - 3);
  }
  return cleaned.trim();
}

/**
 * Offline Mock Generator for Site Summary
 */
function generateOfflineMockSummary(pages) {
  if (!pages || pages.length === 0) {
    return {
      purpose: 'No website content available. Please run the scraper to index a website first.',
      keySections: [],
      keyTakeaways: []
    };
  }

  const startUrl = pages[0].url;
  let domain = startUrl;
  try {
    domain = new URL(startUrl).hostname;
  } catch (e) {}

  const totalWords = pages.reduce((sum, p) => sum + (p.wordCount || 0), 0);
  const keySections = pages.slice(0, 4).map(p => {
    let title = p.title || 'Section';
    let path = p.url;
    try {
      path = new URL(p.url).pathname;
    } catch(e){}
    return {
      title: title.length > 40 ? title.substring(0, 38) + '...' : title,
      description: `Contains crawled content from path "${path}". Words: ${p.wordCount || 0}.`
    };
  });

  return {
    purpose: `[OFFLINE DEMO MODE] This is a directory map of the site "${domain}". We have indexed ${pages.length} document(s) representing a total of ${totalWords} crawled words. Please configure GROQ_API_KEY in the backend/.env file to generate fully conversational AI-synthesized summaries.`,
    keySections,
    keyTakeaways: [
      `Crawled site origin: ${startUrl}`,
      `Total indexed pages: ${pages.length}`,
      `Total indexed word count: ${totalWords} words`,
      `Fallback mode is running. Configure GROQ_API_KEY to unlock advanced summarization.`
    ]
  };
}

/**
 * Offline Mock Generator for FAQ Q&As
 */
function generateOfflineMockFAQs(pages) {
  if (!pages || pages.length === 0) {
    return [];
  }

  const startUrl = pages[0].url;
  const totalWords = pages.reduce((sum, p) => sum + (p.wordCount || 0), 0);
  
  const faqs = [
    {
      question: 'What is the primary URL indexed for this site?',
      answer: `The primary URL crawled by Prometheus AI is "${startUrl}".`
    },
    {
      question: 'How many documents and words are stored in the local index?',
      answer: `The database contains exactly ${pages.length} crawled pages with a total of ${totalWords} extracted words.`
    }
  ];

  pages.slice(0, 3).forEach((p, idx) => {
    faqs.push({
      question: `What information is available on page #${idx + 1} ("${p.title}")?`,
      answer: `This page is titled "${p.title}" and is located at URL "${p.url}". It contains approximately ${p.wordCount || 0} words of crawled text.`
    });
  });

  faqs.push({
    question: 'How do I unlock interactive AI-grounded Q&A?',
    answer: 'Simply open the "backend/.env" file, add your "GROQ_API_KEY=gsk_..." setting, and restart the development server. The platform will automatically generate smart questions based on the ingested content.'
  });

  return faqs;
}

/**
 * Generates an executive website summary using Groq Llama 3.3 (or Gemini, or Offline fallback).
 */
async function generateSiteSummary(pages) {
  if (!pages || pages.length === 0) {
    return generateOfflineMockSummary(pages);
  }

  const contextText = prepareContextSummary(pages);
  const groqApiKey = process.env.GROQ_API_KEY;

  const systemPrompt = `You are an expert website analyst. Analyze the provided website content and generate a comprehensive site summary.
You MUST respond ONLY with a valid JSON object matching the schema below. Do not include any explanations, markdown annotations (except the JSON output block), introduction, or formatting other than the JSON itself.
Ensure you represent key details, statistics, contact numbers, and numbers accurately from the text.

JSON Schema:
{
  "purpose": "A detailed 2-3 sentence overview explaining the core mission, products, services, or topic of the website, including any prominent figures, numbers, or stats.",
  "keySections": [
    { "title": "Section/Page Title", "description": "A description of this section/page, what it covers, and what key info/numbers it provides." }
  ],
  "keyTakeaways": [
    "A vital takeaway or fact about the site (use statistics, figures, or key facts where possible, e.g. admissions deadlines, program duration, contact numbers)."
  ]
}`;

  // 1. Try Groq API
  if (groqApiKey && groqApiKey.trim().length > 0) {
    try {
      console.log('Querying Groq API for site summary...');
      const response = await axios.post(
        'https://api.groq.com/openai/v1/chat/completions',
        {
          model: 'llama-3.3-70b-versatile',
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: `Analyze this website content and produce the JSON summary.\n\nWebsite Content:\n${contextText}` }
          ],
          temperature: 0.2,
          response_format: { type: 'json_object' }
        },
        {
          headers: {
            'Authorization': `Bearer ${groqApiKey}`,
            'Content-Type': 'application/json'
          },
          timeout: 15000
        }
      );

      if (response.data && response.data.choices && response.data.choices[0]) {
        const text = response.data.choices[0].message.content;
        const cleaned = cleanJsonResponse(text);
        return JSON.parse(cleaned);
      }
    } catch (error) {
      console.error('Groq summary generation failed:', error.message);
    }
  }

  // 2. Try Gemini API
  const geminiApiKey = getApiKey();
  if (geminiApiKey) {
    try {
      console.log('Querying Gemini API for site summary...');
      const genAI = getGenAI();
      if (genAI) {
        const model = genAI.getGenerativeModel({
          model: 'gemini-flash-latest',
          generationConfig: { responseMimeType: 'application/json' }
        });
        const prompt = `${systemPrompt}\n\nWebsite Content:\n${contextText}`;
        const result = await model.generateContent(prompt);
        const response = await result.response;
        const cleaned = cleanJsonResponse(response.text());
        return JSON.parse(cleaned);
      }
    } catch (error) {
      console.error('Gemini summary generation failed:', error.message);
    }
  }

  // 3. Offline Fallback
  console.log('Using offline mock summary fallback...');
  return generateOfflineMockSummary(pages);
}

/**
 * Generates interactive FAQ Q&As using Groq Llama 3.3 (or Gemini, or Offline fallback).
 */
async function generateSiteFAQs(pages) {
  if (!pages || pages.length === 0) {
    return generateOfflineMockFAQs(pages);
  }

  const contextText = prepareContextSummary(pages);
  const groqApiKey = process.env.GROQ_API_KEY;

  const systemPrompt = `You are an expert website Q&A editor. Analyze the provided website content and generate a list of 5 to 7 highly relevant Frequently Asked Questions (FAQs) with detailed, factual answers.
The FAQs should focus on high-value info that users actually search for (admissions requirements, fees, dates, contact details, key numbers).
You MUST respond ONLY with a valid JSON array matching the schema below. Do not include any explanations, introduction, or formatting other than the JSON itself.
Ensure all stats and details in the answers are 100% grounded in the text.

JSON Schema:
[
  {
    "question": "A logical, relevant question about the site?",
    "answer": "A detailed, accurate answer grounded strictly in the provided content (including specific numbers, stats, dates, or contact info)."
  }
]`;

  // 1. Try Groq API
  if (groqApiKey && groqApiKey.trim().length > 0) {
    try {
      console.log('Querying Groq API for FAQs...');
      const response = await axios.post(
        'https://api.groq.com/openai/v1/chat/completions',
        {
          model: 'llama-3.3-70b-versatile',
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: `Analyze this website content and produce the JSON FAQs array.\n\nWebsite Content:\n${contextText}` }
          ],
          temperature: 0.3,
          response_format: { type: 'json_object' }
        },
        {
          headers: {
            'Authorization': `Bearer ${groqApiKey}`,
            'Content-Type': 'application/json'
          },
          timeout: 15000
        }
      );

      if (response.data && response.data.choices && response.data.choices[0]) {
        const text = response.data.choices[0].message.content;
        const cleaned = cleanJsonResponse(text);
        let parsed = JSON.parse(cleaned);
        // If the model wrapped the array in a parent object, extract it
        if (!Array.isArray(parsed) && parsed.faqs) {
          parsed = parsed.faqs;
        } else if (!Array.isArray(parsed) && typeof parsed === 'object') {
          parsed = Object.values(parsed)[0]; // Fallback to first field if object
        }
        if (Array.isArray(parsed)) return parsed;
      }
    } catch (error) {
      console.error('Groq FAQ generation failed:', error.message);
    }
  }

  // 2. Try Gemini API
  const geminiApiKey = getApiKey();
  if (geminiApiKey) {
    try {
      console.log('Querying Gemini API for FAQs...');
      const genAI = getGenAI();
      if (genAI) {
        const model = genAI.getGenerativeModel({
          model: 'gemini-flash-latest',
          generationConfig: { responseMimeType: 'application/json' }
        });
        const prompt = `${systemPrompt}\n\nWebsite Content:\n${contextText}`;
        const result = await model.generateContent(prompt);
        const response = await result.response;
        const cleaned = cleanJsonResponse(response.text());
        let parsed = JSON.parse(cleaned);
        if (!Array.isArray(parsed) && parsed.faqs) {
          parsed = parsed.faqs;
        } else if (!Array.isArray(parsed) && typeof parsed === 'object') {
          parsed = Object.values(parsed)[0];
        }
        if (Array.isArray(parsed)) return parsed;
      }
    } catch (error) {
      console.error('Gemini FAQ generation failed:', error.message);
    }
  }

  // 3. Offline Fallback
  console.log('Using offline mock FAQs fallback...');
  return generateOfflineMockFAQs(pages);
}

module.exports = { generateSiteSummary, generateSiteFAQs };
