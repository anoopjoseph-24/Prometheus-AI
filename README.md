# Prometheus AI — Website RAG Intelligence Platform

Prometheus AI is a production-ready, Retrieval-Augmented Generation (RAG) website intelligence platform. It crawls website URLs recursively, builds an on-demand semantic knowledge index, generates executive summaries, and lets users converse with a context-grounded AI assistant.

---

## 🌟 Key Features

*   **Recursive Scraper & Link Mapping**: Ingest any URL, crawl linked child pages recursively (up to a restricted depth of 3), and visualize sitemaps using a real-time force-directed physics graph.
*   **Intelligent Text Segmentation & Chunks Preview**: Slices documents into chunks with configurable overlapping. Inspect semantic vector float arrays natively via a built-in Chunks Inspector card.
*   **Dual LLM & Embedding Integrations**:
    *   Uses **Groq API** (`llama-3.3-70b-versatile`) for blazing-fast completions, page summaries, and site FAQs.
    *   Uses **Gemini API** (`gemini-flash-latest`) for vector embedding generations and robust LLM completions fallbacks.
    *   Equipped with automatic retries on rate limits (`429 Too Many Requests`).
*   **Conversational RAG Chatbot**: Chat with an inline-citations chatbot. View match similarity scores and source card previews dynamically.
*   **Executive Dashboard & Interactive FAQs**: View domain-wide core purpose analysis, key takeaways, sitemap directories, and interactive FAQs. Click **"Ask Chatbot"** on any FAQ to auto-query the bot.
*   **Operational Analytics & Health Charts**: Visual analytics tab featuring:
    *   **Knowledge Base & Segment Distribution**: Interactive SVG Donut Chart showing segment/chunk allocation per crawled page, with bi-directional hover highlighting.
    *   **Document Size Leaderboard**: Horizontal progress bars illustrating relative word count scale across crawled documents.
    *   **Top Keyword Density**: Horizontal frequency bars tracking most common corpus terms.
    *   **Crawl Success Gauge**: Circular SVG performance tracking ring.
*   **Serverless MongoDB Atlas Layer**: Dual-mode storage. Queries MongoDB Atlas in serverless environments (Vercel) when `MONGODB_URI` is provided, falling back automatically to local `db.json` files for local-first zero-config development.
*   **Automated database clear-on-exit**: Clears crawled pages and chunks automatically on tab exit using browser unload beacons.

---

## 🛠️ Technology Stack

*   **Frontend**: React, Tailwind CSS, Lucide Icons, HTML5 Canvas API (Physics sitemap).
*   **Backend**: Node.js, Express, Axios, Cheerio (Crawler), Native MongoDB Driver.
*   **AI Engine**: Gemini API (`@google/generative-ai`), Groq Chat Completions API.

---

## 📂 Project Structure

```
├── backend/
│   ├── data/
│   │   └── db.json          # Fallback JSON database
│   ├── utils/
│   │   ├── chat.js          # RAG grounding prompt and completion handlers
│   │   ├── chunker.js       # Semantic text splitters
│   │   ├── db.js            # MongoDB & JSON database hybrid manager
│   │   ├── embeddings.js    # Gemini Embeddings generation utils
│   │   └── summary.js       # Site summarization & FAQ generator
│   ├── .env                 # Environment variables config
│   ├── package.json         # Node scripts & dependencies
│   └── server.js            # Express REST routes & SSE crawlers
├── frontend/
│   ├── src/
│   │   ├── App.jsx          # Main React Application
│   │   ├── index.css        # Tailwind styles & premium overrides
│   │   └── main.jsx         # React bootstrapping
│   ├── package.json
│   ├── tailwind.config.js   # Theme configuration
│   └── vite.config.js       # HMR proxy setup
├── start-dev.sh             # Startup script with auto-port cleanup
└── README.md
```

---

## 🚀 Getting Started

### 1. Prerequisites
- **Node.js** (v18 or above recommended)
- API Keys: **Gemini API Key** and/or **Groq API Key**.

### 2. Configuration
Create a `.env` file in the `backend/` directory (or use the template created for you):
```ini
PORT=5001
GEMINI_API_KEY=your_gemini_api_key_here
GROQ_API_KEY=your_groq_api_key_here

# (Optional) Provide for Serverless / MongoDB deployment
MONGODB_URI=your_mongodb_connection_string
```

### 3. Run Dev Server
In the root directory, run the bootstrapper script:
```bash
chmod +x start-dev.sh
./start-dev.sh
```
*Note: This script automatically detects and terminates zombie processes occupying port `5001` or `5173` before booting to prevent `EADDRINUSE` failures.*

Access the app at: **`http://localhost:5173`**

---

## ☁️ Vercel Deployment

Since Vercel functions are stateless and serverless, local `db.json` writing is not permitted. 

1. Create a free **MongoDB Atlas** cluster.
2. In Vercel Environment Variables, configure:
   * `MONGODB_URI` (pointing to your Atlas cluster)
   * `GEMINI_API_KEY`
   * `GROQ_API_KEY`
3. Vercel automatically routes DB writes directly to Atlas, allowing database persistence to run smoothly.
