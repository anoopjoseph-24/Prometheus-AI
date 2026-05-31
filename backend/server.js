const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const axios = require('axios');
const cheerio = require('cheerio');
const fs = require('fs');
const path = require('path');

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors());
app.use(express.json());

// Database configuration (JSON)
const DB_PATH = path.join(__dirname, 'data', 'db.json');

// Ensure data directory exists
if (!fs.existsSync(path.join(__dirname, 'data'))) {
  fs.mkdirSync(path.join(__dirname, 'data'));
}

// Initialize database if it doesn't exist
if (!fs.existsSync(DB_PATH)) {
  fs.writeFileSync(DB_PATH, JSON.stringify({ pages: [], chunks: [], settings: {} }, null, 2));
}

// Helper to read database
function readDB() {
  try {
    const data = fs.readFileSync(DB_PATH, 'utf8');
    return JSON.parse(data);
  } catch (error) {
    console.error('Error reading database:', error);
    return { pages: [], chunks: [], settings: {} };
  }
}

// Helper to write database
function writeDB(data) {
  try {
    fs.writeFileSync(DB_PATH, JSON.stringify(data, null, 2));
  } catch (error) {
    console.error('Error writing database:', error);
  }
}

// Utility to clean text content
function cleanText(text) {
  return text
    .replace(/\s+/g, ' ')
    .replace(/\n+/g, ' ')
    .trim();
}

// Utility to validate URLs
function isValidUrl(urlString) {
  try {
    const url = new URL(urlString);
    return url.protocol === 'http:' || url.protocol === 'https:';
  } catch (e) {
    return false;
  }
}

// Scrape a single URL helper
async function scrapePage(url) {
  try {
    const response = await axios.get(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
      },
      timeout: 5000
    });

    const html = response.data;
    const $ = cheerio.load(html);

    const title = $('title').text().trim() || url;
    const description = $('meta[name="description"]').attr('content') || '';

    // Clean scripts, styles, etc.
    $('script, style, nav, footer, header, iframe').remove();
    const rawText = $('body').text();
    const cleanTextStr = cleanText(rawText);
    const words = cleanTextStr.split(/\s+/).filter(Boolean);
    const wordCount = words.length;


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

    const parentId = parentUrl ? Buffer.from(parentUrl).toString('base64').substring(0, 16) : 'root';
    onProgress({ type: 'page_start', url, depth, count: crawledPages.length, parentId });

    try {
      console.log(`Crawling: ${url} at depth ${depth}`);
      const data = await scrapePage(url);
      
      const pageData = {
        id: Buffer.from(url).toString('base64').substring(0, 16),
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

            if (urlObj.hostname === startHostname && !visited.has(finalUrl) && isValidUrl(finalUrl)) {
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

    // Save to db.json
    const db = readDB();
    db.pages = crawledPages;
    db.chunks = []; // Clear old chunks
    db.settings = { currentSite: url, crawledAt: new Date().toISOString() };
    writeDB(db);

    sendEvent('status', {
      message: `Crawling completed. Processed ${crawledPages.length} pages.`,
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
app.get('/api/pages', (req, res) => {
  const db = readDB();
  res.json({ pages: db.pages, settings: db.settings });
});

// Root status check
app.get('/api/status', (req, res) => {
  const db = readDB();
  res.json({
    status: 'online',
    crawledPagesCount: db.pages.length,
    currentSite: db.settings.currentSite || null
  });
});

app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
