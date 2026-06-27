# Prometheus AI

🌐 Live Demo: https://prometheus-ai-psi.vercel.app/

Prometheus AI is a Retrieval-Augmented Generation (RAG) website intelligence platform that transforms websites into searchable knowledge bases. The system recursively crawls websites, extracts and processes content, generates semantic embeddings, and answers user questions using context-grounded AI.

## Features

- Recursive website crawling
- Intelligent content extraction and cleaning
- Word-aware chunking with overlap
- Semantic embeddings using Gemini
- AI-powered question answering using Groq & Gemini
- Executive summaries and FAQ generation
- MongoDB Atlas knowledge storage
- Context-grounded responses using RAG

## Workflow

Target URL → Crawl → Extract Content → Chunk → Generate Embeddings → Store in MongoDB → Semantic Retrieval → AI Response

## Tech Stack

**Frontend:** React, CSS  
**Backend:** Node.js, Express.js  
**Database:** MongoDB Atlas  
**AI Models:** Gemini Embeddings, Groq LLM, Gemini Flash (Fallback)  
**Libraries:** Axios, Cheerio

## Deployment

- Frontend: Vercel
- Backend: Render
- Database: MongoDB Atlas

## Developer

**Anoop Joseph**

Built to demonstrate intelligent website understanding using Retrieval-Augmented Generation (RAG).
