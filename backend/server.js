const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const axios = require('axios');
const cheerio = require('cheerio');

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors());
app.use(express.json());

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
    const cleanText = rawText.replace(/\s+/g, ' ').replace(/\n+/g, ' ').trim();
    
    // Extract raw links
    const links = [];
    $('a[href]').each((_, el) => {
      const href = $(el).attr('href');
      if (href) links.push(href);
    });

    return {
      title,
      description,
      content: cleanText,
      links: [...new Set(links)] // deduplicated
    };
  } catch (error) {
    throw new Error(`Failed to scrape ${url}: ${error.message}`);
  }
}

// Temporary test endpoint to check single-page scraping
app.get('/api/test-scrape', async (req, res) => {
  const { url } = req.query;
  if (!url) {
    return res.status(400).json({ error: 'URL parameter is required' });
  }
  try {
    const data = await scrapePage(url);
    res.json({ success: true, data });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Root status check
app.get('/api/status', (req, res) => {
  res.json({
    status: 'online',
    message: 'Prometheus AI API is running'
  });
});

app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
