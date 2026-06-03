const express = require('express');
const cors = require('cors');
const path = require('path');
const dotenv = require('dotenv');

// Load environment variables immediately relative to this script
dotenv.config({ path: path.join(__dirname, '.env') });

const axios = require('axios');
const cheerio = require('cheerio');
const fs = require('fs');
const { chunkText } = require('./utils/chunker');
const { generateEmbedding, generateEmbeddingsBatch } = require('./utils/embeddings');
const { answerQuestionWithContext } = require('./utils/chat');
const { generateSiteSummary, generateSiteFAQs } = require('./utils/summary');

const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors());
app.use(express.json());

// Database configuration (MongoDB Atlas / local JSON fallback)
const { readDB, writeDB, getMongoDb } = require('./utils/db');

// Connect to MongoDB Atlas (if MONGODB_URI is provided)
getMongoDb().catch(err => {
  console.error("Initial MongoDB connection failed:", err.message);
});

// Utility to clean text content
function cleanText(text) {
  return text
    .replace(/\s+/g, ' ')
    .replace(/\n+/g, ' ')
    .trim();
}

// Exclude common binary and asset file formats from web crawling
const EXCLUDED_EXTENSIONS = [
  '.pdf', '.zip', '.tar', '.gz', '.rar', '.7z',
  '.png', '.jpg', '.jpeg', '.gif', '.webp', '.svg', '.ico', '.tiff', '.bmp',
  '.mp4', '.mp3', '.wav', '.avi', '.mov', '.flv',
  '.css', '.js', '.json', '.xml',
  '.doc', '.docx', '.xls', '.xlsx', '.ppt', '.pptx'
];

// Utility to validate URLs
function isValidUrl(urlString) {
  try {
    const url = new URL(urlString);
    return url.protocol === 'http:' || url.protocol === 'https:';
  } catch (e) {
    return false;
  }
}

// Helper to determine if a URL is valid for HTML crawling
function shouldCrawlUrl(urlString, startHostname) {
  try {
    if (!isValidUrl(urlString)) return false;
    const urlObj = new URL(urlString);
    
    // Domain restrictions (must stay on target host)
    if (urlObj.hostname !== startHostname) return false;
    
    // Protocol restrictions
    if (urlObj.protocol !== 'http:' && urlObj.protocol !== 'https:') return false;

    // Check file extension exclusion
    const pathname = urlObj.pathname.toLowerCase();
    const hasExcludedExtension = EXCLUDED_EXTENSIONS.some(ext => pathname.endsWith(ext));
    if (hasExcludedExtension) return false;

    return true;
  } catch (e) {
    return false;
  }
}

// Scrape a single URL helper
async function scrapePage(url) {
  try {
    const response = await axios.get(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, Gecko) Chrome/91.0.4472.124 Safari/537.36'
      },
      timeout: 5000,
      responseType: 'text'
    });

    // Check response Content-Type to verify it is HTML before parsing
    const contentType = response.headers['content-type'] || '';
    if (!contentType.includes('text/html') && !contentType.includes('application/xhtml+xml')) {
      throw new Error(`Unsupported content type: ${contentType}`);
    }

    const html = response.data;
    const $ = cheerio.load(html);

    const title = $('title').text().trim() || url;
    const description = $('meta[name="description"]').attr('content') || '';

    // Clean scripts, styles, etc.
    $('script, style, nav, footer, header, iframe').remove();
    const rawText = $('body').text();
    const cleanTextStr = cleanText(rawText);

    // Extract raw links
    const links = [];
    $('a[href]').each((_, el) => {
      const href = $(el).attr('href');
      if (href) links.push(href);
    });

    return {
      title,
      description,
      content: cleanTextStr,
      links: [...new Set(links)] // deduplicated
    };
  } catch (error) {
    throw new Error(`Failed to scrape ${url}: ${error.message}`);
  }
}

// Recursive crawler logic
async function crawlUrl(startUrl, maxDepth = 2, maxPages = 15, onProgress) {
  const visited = new Set();
  const queue = [{ url: startUrl, depth: 1, parentUrl: null }];
  const crawledPages = [];
  const startHostname = new URL(startUrl).hostname;

  while (queue.length > 0 && crawledPages.length < maxPages) {
    const { url, depth, parentUrl } = queue.shift();

    if (visited.has(url)) continue;
    visited.add(url);

    const parentId = parentUrl ? Buffer.from(parentUrl).toString('base64').replace(/=/g, '') : 'root';
    onProgress({ type: 'page_start', url, depth, count: crawledPages.length, parentId });

    try {
      console.log(`Crawling: ${url} at depth ${depth}`);
      const data = await scrapePage(url);
      
      const pageData = {
        id: Buffer.from(url).toString('base64').replace(/=/g, ''),
        url,
        title: data.title,
        description: data.description,
        content: data.content,
        wordCount: data.content.split(/\s+/).filter(Boolean).length,
        crawledAt: new Date().toISOString()
      };

      crawledPages.push(pageData);
      onProgress({ 
        type: 'page_success', 
        page: { url, title: data.title, wordCount: pageData.wordCount, id: pageData.id },
        parentId
      });

      // If we haven't reached max depth, add same-origin links to the queue
      if (depth < maxDepth) {
        for (const rawLink of data.links) {
          try {
            const resolvedUrl = new URL(rawLink, url).href;
            const urlObj = new URL(resolvedUrl);
            urlObj.hash = ''; // Strip fragments

            const finalUrl = urlObj.href;

            if (!visited.has(finalUrl) && shouldCrawlUrl(finalUrl, startHostname)) {
              if (!queue.some(item => item.url === finalUrl)) {
                queue.push({ url: finalUrl, depth: depth + 1, parentUrl: url });
              }
            }
          } catch (e) {
            // Ignore invalid URLs
          }
        }
      }
    } catch (error) {
      console.error(`Error crawling ${url}:`, error.message);
      onProgress({ type: 'page_error', url, error: error.message });
    }
  }

  return crawledPages;
}

// Crawling endpoint with Server-Sent Events (SSE) progress streaming
app.get('/api/crawl', async (req, res) => {
  const { url, depth, maxPages } = req.query;

  if (!url || !isValidUrl(url)) {
    return res.status(400).json({ error: 'A valid starting URL is required.' });
  }

  // Validate starting URL has no excluded file extension
  try {
    const startUrlObj = new URL(url);
    const startPathname = startUrlObj.pathname.toLowerCase();
    const isExcluded = EXCLUDED_EXTENSIONS.some(ext => startPathname.endsWith(ext));
    if (isExcluded) {
      return res.status(400).json({ error: 'Starting URL must be an HTML page, not a binary file or static asset.' });
    }
  } catch (e) {
    return res.status(400).json({ error: 'Invalid URL formatting.' });
  }

  const crawlDepth = parseInt(depth) || 2;
  const crawlMaxPages = parseInt(maxPages) || 15;

  // Set headers for Server-Sent Events
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    'Connection': 'keep-alive'
  });

  // Keep connections alive
  const keepAliveInterval = setInterval(() => {
    res.write(': keepalive\n\n');
  }, 15000);

  const sendEvent = (event, data) => {
    res.write(`event: ${event}\n`);
    res.write(`data: ${JSON.stringify(data)}\n\n`);
  };

  sendEvent('status', { message: `Initializing crawler for ${url}...`, type: 'info' });

  try {
    const crawledPages = await crawlUrl(
      url,
      crawlDepth,
      crawlMaxPages,
      (progress) => {
        if (progress.type === 'page_start') {
          sendEvent('page_start', { url: progress.url, depth: progress.depth, count: progress.count, parentId: progress.parentId });
        } else if (progress.type === 'page_success') {
          sendEvent('page_success', { page: progress.page, parentId: progress.parentId });
        } else if (progress.type === 'page_error') {
          sendEvent('page_error', { url: progress.url, error: progress.error });
        }
      }
    );

    // Safeguard to prevent wiping existing DB when crawl fails completely
    if (!crawledPages || crawledPages.length === 0) {
      throw new Error('No pages were successfully crawled. Please verify the URL and check if the site allows scraping.');
    }

    // Now, chunk and generate embeddings for all pages!
    sendEvent('status', { message: `Preparing text chunks for vector embeddings...`, type: 'info' });
    
    // First, segment all pages into chunks
    const chunkInputs = [];
    for (const page of crawledPages) {
      const pageChunks = chunkText(page.content);
      pageChunks.forEach((chunk, i) => {
        chunkInputs.push({
          page,
          text: chunk.text,
          wordCount: chunk.wordCount,
          charCount: chunk.charCount,
          index: i
        });
      });
    }

    sendEvent('status', { message: `Generating vector embeddings for ${chunkInputs.length} text chunks...`, type: 'info' });

    // Call batched embedding API
    const textsToEmbed = chunkInputs.map(item => item.text);
    const { embeddings, isMock } = await generateEmbeddingsBatch(textsToEmbed);

    // Map embeddings back to chunks
    const dbChunks = chunkInputs.map((item, idx) => ({
      id: `chunk_${item.page.id}_${item.index}`,
      pageId: item.page.id,
      url: item.page.url,
      title: item.page.title,
      text: item.text,
      wordCount: item.wordCount,
      charCount: item.charCount,
      embedding: embeddings[idx]
    }));

    // Save to database
    const db = await readDB();
    db.pages = crawledPages;
    db.chunks = dbChunks;
    db.settings = { 
      currentSite: url, 
      crawledAt: new Date().toISOString(),
      embeddingsType: isMock ? 'mock' : 'gemini'
    };
    db.summary = null;
    db.faqs = null;
    await writeDB(db);

    sendEvent('status', {
      message: `Crawling completed. Processed ${crawledPages.length} pages and generated ${dbChunks.length} text chunks.`,
      type: 'success',
      pagesCount: crawledPages.length
    });
  } catch (error) {
    sendEvent('status', { message: `Crawl failed: ${error.message}`, type: 'error' });
  } finally {
    clearInterval(keepAliveInterval);
    res.end();
  }
});

// Endpoint to retrieve crawled pages
app.get('/api/pages', async (req, res) => {
  const db = await readDB();
  res.json({ pages: db.pages, settings: db.settings });
});

// Endpoint to retrieve chunks
app.get('/api/chunks', async (req, res) => {
  const db = await readDB();
  res.json({ chunks: db.chunks || [] });
});

// Cosine similarity helper
function cosineSimilarity(vecA, vecB) {
  if (!vecA || !vecB || vecA.length !== vecB.length) return 0;
  let dotProduct = 0;
  let normA = 0;
  let normB = 0;
  for (let i = 0; i < vecA.length; i++) {
    dotProduct += vecA[i] * vecB[i];
    normA += vecA[i] * vecA[i];
    normB += vecB[i] * vecB[i];
  }
  if (normA === 0 || normB === 0) return 0;
  return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
}

// Keyword similarity fallback when offline/mock embeddings are active
function getKeywordScore(query, text) {
  const clean = (str) => str.toLowerCase().replace(/[^\w\s]/g, '');
  const queryWords = clean(query).split(/\s+/).filter(w => w.length > 2);
  if (queryWords.length === 0) return 0;
  
  const textCleaned = clean(text);
  let score = 0;
  queryWords.forEach(word => {
    // If it matches exactly as a standalone word, higher weight
    const wordPattern = new RegExp(`\\b${word}\\b`, 'i');
    if (wordPattern.test(textCleaned)) {
      score += 1.0;
    } else if (textCleaned.includes(word)) {
      score += 0.5; // partial match inside another word
    }
  });
  return score / queryWords.length;
}

// Chat / Q&A endpoint
app.post('/api/chat', async (req, res) => {
  const { query } = req.body;

  if (!query || query.trim().length === 0) {
    return res.status(400).json({ error: 'Query parameter is required.' });
  }

  try {
    const db = await readDB();
    const chunks = db.chunks || [];

    if (chunks.length === 0) {
      return res.json({
        answer: 'No website data has been crawled yet. Please enter a URL on the Scraper tab to populate the database.',
        sources: []
      });
    }

    // 1. Generate query embedding (match the mock status of database embeddings)
    const useMock = db.settings?.embeddingsType === 'mock';
    const queryEmbedding = await generateEmbedding(query, useMock);

    // 2. Compute similarity for each chunk
    const scoredChunks = chunks.map((chunk) => {
      const similarity = useMock 
        ? getKeywordScore(query, chunk.text) 
        : cosineSimilarity(queryEmbedding, chunk.embedding);
      return { ...chunk, similarity };
    });

    // 3. Sort by similarity desc and select top-5
    scoredChunks.sort((a, b) => b.similarity - a.similarity);
    const threshold = useMock ? 0.05 : 0.15;
    const topChunks = scoredChunks.slice(0, 5).filter(c => c.similarity > threshold);

    // Fallback if none matches threshold
    const relevantChunks = topChunks.length > 0 ? topChunks : scoredChunks.slice(0, 3);

    // 4. Generate answer
    const answer = await answerQuestionWithContext(query, relevantChunks);

    // 5. Deduplicate and format sources to return to client
    const sources = relevantChunks.map((chunk) => ({
      id: chunk.id,
      url: chunk.url,
      title: chunk.title,
      text: chunk.text,
      similarity: chunk.similarity
    }));

    res.json({
      answer,
      sources
    });
  } catch (error) {
    console.error('Chat endpoint error:', error);
    res.status(500).json({ error: `Failed to process Q&A query: ${error.message}` });
  }
});

// Root status check
app.get('/api/status', async (req, res) => {
  const db = await readDB();
  res.json({
    status: 'online',
    crawledPagesCount: db.pages.length,
    currentSite: db.settings.currentSite || null
  });
});

// Document-specific summary generator
app.get('/api/pages/:id/summary', async (req, res) => {
  const { id } = req.params;
  try {
    const db = await readDB();
    const page = db.pages.find(p => p.id === id);
    if (!page) {
      return res.status(404).json({ error: 'Page not found.' });
    }

    if (page.summary) {
      return res.json({ summary: page.summary });
    }

    const groqApiKey = process.env.GROQ_API_KEY;
    const systemPrompt = `You are a concise document assistant. Summarize the provided document in exactly two bullet points. Be extremely clear and highlight key names, stats, or numbers. Return the output as plain text.`;

    let summaryText = '';

    // 1. Try Groq API
    if (groqApiKey && groqApiKey.trim().length > 0) {
      try {
        console.log(`Generating page summary for ${page.title} via Groq...`);
        const response = await axios.post(
          'https://api.groq.com/openai/v1/chat/completions',
          {
            model: 'llama-3.3-70b-versatile',
            messages: [
              { role: 'system', content: systemPrompt },
              { role: 'user', content: `Document Title: ${page.title}\nDocument Content:\n${page.content.substring(0, 4000)}` }
            ],
            temperature: 0.2
          },
          {
            headers: {
              'Authorization': `Bearer ${groqApiKey}`,
              'Content-Type': 'application/json'
            },
            timeout: 10000
          }
        );
        if (response.data && response.data.choices && response.data.choices[0]) {
          summaryText = response.data.choices[0].message.content.trim();
        }
      } catch (err) {
        console.error('Groq page summary failed:', err.message);
      }
    }

    // 2. Try Gemini API
    if (!summaryText) {
      const geminiApiKey = process.env.GEMINI_API_KEY;
      if (geminiApiKey) {
        try {
          console.log(`Generating page summary for ${page.title} via Gemini...`);
          const genAI = new GoogleGenerativeAI(geminiApiKey);
          const model = genAI.getGenerativeModel({ model: 'gemini-flash-latest' });
          const prompt = `${systemPrompt}\n\nDocument Title: ${page.title}\nDocument Content:\n${page.content.substring(0, 4000)}`;
          const result = await model.generateContent(prompt);
          const response = await result.response;
          summaryText = response.text().trim();
        } catch (err) {
          console.error('Gemini page summary failed:', err.message);
        }
      }
    }

    // 3. Fallback
    if (!summaryText) {
      const words = page.content.split(/\s+/).filter(Boolean);
      const sentences = page.content.split(/[.!?]+/).filter(s => s.trim().length > 5);
      const bullet1 = sentences[0] ? sentences[0].trim() + '.' : `Document contains ${words.length} words of text.`;
      const bullet2 = sentences[1] ? sentences[1].trim() + '.' : `Indexing was successfully completed.`;
      summaryText = `• ${bullet1}\n• ${bullet2}`;
    }

    page.summary = summaryText;
    await writeDB(db);

    res.json({ summary: summaryText });
  } catch (error) {
    console.error('Error in page summary endpoint:', error);
    res.status(500).json({ error: `Failed to generate page summary: ${error.message}` });
  }
});

// Executive site summarization endpoint
app.get('/api/summary', async (req, res) => {
  try {
    const db = await readDB();
    if (db.summary) {
      return res.json(db.summary);
    }
    if (!db.pages || db.pages.length === 0) {
      return res.status(404).json({ error: 'No website content found. Crawl a site first.' });
    }
    const summary = await generateSiteSummary(db.pages);
    db.summary = summary;
    await writeDB(db);
    res.json(summary);
  } catch (error) {
    console.error('Error in /api/summary:', error);
    res.status(500).json({ error: `Failed to generate summary: ${error.message}` });
  }
});

// Auto-generated FAQs endpoint
app.get('/api/faqs', async (req, res) => {
  try {
    const db = await readDB();
    if (db.faqs) {
      return res.json({ faqs: db.faqs });
    }
    if (!db.pages || db.pages.length === 0) {
      return res.status(404).json({ error: 'No website content found. Crawl a site first.' });
    }
    const faqs = await generateSiteFAQs(db.pages);
    db.faqs = faqs;
    await writeDB(db);
    res.json({ faqs });
  } catch (error) {
    console.error('Error in /api/faqs:', error);
    res.status(500).json({ error: `Failed to generate FAQs: ${error.message}` });
  }
});

// Force regenerate summary & FAQs endpoint
app.post('/api/summary/regenerate', async (req, res) => {
  try {
    const db = await readDB();
    if (!db.pages || db.pages.length === 0) {
      return res.status(404).json({ error: 'No website content found. Crawl a site first.' });
    }
    const [summary, faqs] = await Promise.all([
      generateSiteSummary(db.pages),
      generateSiteFAQs(db.pages)
    ]);
    db.summary = summary;
    db.faqs = faqs;
    await writeDB(db);
    res.json({ summary, faqs });
  } catch (error) {
    console.error('Error in /api/summary/regenerate:', error);
    res.status(500).json({ error: `Failed to regenerate: ${error.message}` });
  }
});

// Endpoint to clear all database contents on tab/site close
app.post('/api/db/clear', async (req, res) => {
  try {
    console.log("🧹 Received client exit trigger. Clearing database...");
    await writeDB({ pages: [], chunks: [], settings: {} });
    res.json({ success: true, message: 'Database cleared successfully.' });
  } catch (error) {
    console.error('Failed to clear database:', error);
    res.status(500).json({ error: 'Failed to clear database.' });
  }
});

app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
