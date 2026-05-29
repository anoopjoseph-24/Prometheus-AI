import React, { useState } from 'react';
import { 
  Globe, 
  Settings, 
  Play, 
  Loader2, 
  CheckCircle, 
  AlertTriangle, 
  FileText, 
  MessageSquare, 
  HelpCircle, 
  BarChart3, 
  Sliders, 
  Database,
  ArrowRight,
  RefreshCw,
  ExternalLink
} from 'lucide-react';

export default function App() {
  const [activeTab, setActiveTab] = useState('crawl');
  const [isCrawling, setIsCrawling] = useState(false);
  const [crawlStatus, setCrawlStatus] = useState('idle'); // idle, crawling, success, error
  const [crawlMessage, setCrawlMessage] = useState('System ready. Enter a URL to start.');
  
  // Scraper inputs
  const [targetUrl, setTargetUrl] = useState('');
  const [maxDepth, setMaxDepth] = useState(2);
  const [maxPages, setMaxPages] = useState(15);
  const [onlySameDomain, setOnlySameDomain] = useState(true);

  // Pages state
  const [pages, setPages] = useState([]);
  const [selectedPage, setSelectedPage] = useState(null);

  const handleStartCrawl = (e) => {
    e.preventDefault();
    if (!targetUrl) return;
    setIsCrawling(true);
    setCrawlStatus('crawling');
    setCrawlMessage(`Initializing crawler for ${targetUrl}...`);
    
    // Simulate a basic crawl start (will wire with SSE in Commit 8)
    setTimeout(() => {
      setIsCrawling(false);
      setCrawlStatus('success');
      setCrawlMessage(`Successfully crawled pages. (SSE logic to be wired)`);
      setPages([
        { id: '1', url: targetUrl, title: 'Home Page', description: 'Starting page', content: 'This is main page content', wordCount: 150 },
        { id: '2', url: `${targetUrl}/about`, title: 'About Us', description: 'Company info', content: 'This is company information content', wordCount: 220 }
      ]);
    }, 2000);
  };

  return (
    <div className="flex flex-col min-h-screen bg-dark-bg text-slate-100 bg-grid-pattern">
      {/* Header */}
      <header className="border-b border-dark-border bg-dark-card/40 backdrop-blur-md sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-brand-primary to-rose-700 flex items-center justify-center shadow-lg shadow-brand-primary/20">
              <span className="text-xl font-bold text-white font-mono">P</span>
            </div>
            <div>
              <h1 className="text-xl font-bold tracking-tight text-white flex items-center gap-2">
                Prometheus AI
                <span className="text-xs bg-brand-primary/10 text-brand-glow px-2 py-0.5 rounded-full font-medium border border-brand-primary/20">
                  RAG Intelligence
                </span>
              </h1>
              <p className="text-xs text-dark-muted">Website Crawling & QA Engine</p>
            </div>
          </div>
          
          <nav className="flex items-center gap-1">
            <button 
              onClick={() => setActiveTab('crawl')}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                activeTab === 'crawl' 
                  ? 'bg-dark-card text-brand-glow border border-brand-primary/30' 
                  : 'text-slate-400 hover:text-slate-200 hover:bg-dark-card/50'
              }`}
            >
              <Globe size={16} />
              Crawl Hub
            </button>
            <button 
              onClick={() => setActiveTab('chunks')}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                activeTab === 'chunks' 
                  ? 'bg-dark-card text-brand-glow border border-brand-primary/30' 
                  : 'text-slate-400 hover:text-slate-200 hover:bg-dark-card/50'
              }`}
            >
              <Database size={16} />
              Chunks Visualizer
            </button>
            <button 
              onClick={() => setActiveTab('chat')}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                activeTab === 'chat' 
                  ? 'bg-dark-card text-brand-glow border border-brand-primary/30' 
                  : 'text-slate-400 hover:text-slate-200 hover:bg-dark-card/50'
              }`}
            >
              <MessageSquare size={16} />
              RAG Chat
            </button>
            <button 
              onClick={() => setActiveTab('summary')}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                activeTab === 'summary' 
                  ? 'bg-dark-card text-brand-glow border border-brand-primary/30' 
                  : 'text-slate-400 hover:text-slate-200 hover:bg-dark-card/50'
              }`}
            >
              <FileText size={16} />
              Summary & FAQs
            </button>
            <button 
              onClick={() => setActiveTab('analytics')}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                activeTab === 'analytics' 
                  ? 'bg-dark-card text-brand-glow border border-brand-primary/30' 
                  : 'text-slate-400 hover:text-slate-200 hover:bg-dark-card/50'
              }`}
            >
              <BarChart3 size={16} />
              Analytics
            </button>
          </nav>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-6 flex flex-col gap-6">
        {activeTab === 'crawl' && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            
            {/* Control Panel */}
            <div className="lg:col-span-1 flex flex-col gap-6">
              <div className="glass-card rounded-2xl p-6 flex flex-col gap-5">
                <div className="flex items-center gap-2 text-white border-b border-dark-border pb-3">
                  <Sliders className="text-brand-glow" size={20} />
                  <h2 className="text-lg font-semibold">Crawl Settings</h2>
                </div>

                <form onSubmit={handleStartCrawl} className="flex flex-col gap-4">
                  <div>
                    <label className="text-xs text-slate-400 font-medium block mb-2">Target URL</label>
                    <div className="relative">
                      <input 
                        type="url" 
                        placeholder="https://example.com"
                        value={targetUrl}
                        onChange={(e) => setTargetUrl(e.target.value)}
                        disabled={isCrawling}
                        className="w-full bg-dark-bg/60 border border-dark-border rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-brand-primary text-slate-100 transition-colors disabled:opacity-50"
                        required
                      />
                      <Globe className="absolute right-3.5 top-3.5 text-slate-500" size={16} />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="text-xs text-slate-400 font-medium block mb-2">Max Depth (1 - 3)</label>
                      <input 
                        type="number" 
                        min="1" 
                        max="3"
                        value={maxDepth}
                        onChange={(e) => setMaxDepth(parseInt(e.target.value) || 2)}
                        disabled={isCrawling}
                        className="w-full bg-dark-bg/60 border border-dark-border rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-brand-primary text-slate-100 transition-colors disabled:opacity-50"
                      />
                    </div>
                    <div>
                      <label className="text-xs text-slate-400 font-medium block mb-2">Max Pages (1 - 50)</label>
                      <input 
                        type="number" 
                        min="1" 
                        max="50"
                        value={maxPages}
                        onChange={(e) => setMaxPages(parseInt(e.target.value) || 15)}
                        disabled={isCrawling}
                        className="w-full bg-dark-bg/60 border border-dark-border rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-brand-primary text-slate-100 transition-colors disabled:opacity-50"
                      />
                    </div>
                  </div>

                  <div className="flex items-center gap-3 bg-dark-bg/40 p-3 rounded-xl border border-dark-border/40">
                    <input 
                      type="checkbox" 
                      id="domain"
                      checked={onlySameDomain}
                      onChange={(e) => setOnlySameDomain(e.target.checked)}
                      disabled={isCrawling}
                      className="rounded border-slate-700 bg-slate-900 text-red-600 focus:ring-red-500 focus:ring-offset-slate-900"
                    />
                    <label htmlFor="domain" className="text-xs text-slate-300 select-none">
                      Stay inside starting domain only
                    </label>
                  </div>

                  <button 
                    type="submit"
                    disabled={isCrawling || !targetUrl}
                    className="w-full mt-2 bg-gradient-to-r from-brand-primary to-rose-700 hover:shadow-lg hover:shadow-brand-primary/20 text-white font-medium py-3 rounded-xl flex items-center justify-center gap-2 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {isCrawling ? (
                      <>
                        <Loader2 className="animate-spin" size={18} />
                        Crawling...
                      </>
                    ) : (
                      <>
                        <Play size={18} />
                        Start Crawling
                      </>
                    )}
                  </button>
                </form>
              </div>

              {/* Crawler Monitor */}
              <div className="glass-card rounded-2xl p-6 flex-1 flex flex-col gap-4 min-h-[220px]">
                <div className="flex items-center justify-between border-b border-dark-border pb-3">
                  <div className="flex items-center gap-2 text-white">
                    <RefreshCw className={`text-brand-glow ${isCrawling ? 'animate-spin' : ''}`} size={18} />
                    <h2 className="text-base font-semibold">Console Output</h2>
                  </div>
                </div>

                <div className="flex-1 bg-dark-bg/80 border border-dark-border rounded-xl p-4 font-mono text-xs overflow-y-auto max-h-[250px] text-slate-400">
                  <div># Output terminal initialized</div>
                  <div className="text-brand-glow mt-1">&gt; {crawlMessage}</div>
                </div>
              </div>
            </div>

            {/* Sitemap Graphic Placeholder */}
            <div className="lg:col-span-2 flex flex-col gap-6">
              <div className="glass-card rounded-2xl p-6 flex flex-col gap-4 min-h-[400px] justify-center items-center text-center">
                <Globe className="text-red-500/60 mb-4 animate-pulse" size={48} />
                <h3 className="text-lg font-semibold text-white">Visual Sitemap Canvas</h3>
                <p className="text-sm text-dark-muted max-w-sm">
                  Interactive sitemap rendering node positions. Force-directed physics sitemap graph will be initialized here in the next step.
                </p>
              </div>
            </div>

          </div>
        )}

        {activeTab !== 'crawl' && (
          <div className="glass-card rounded-3xl p-12 flex flex-col items-center justify-center text-center gap-6 min-h-[450px]">
            <div className="w-16 h-16 rounded-2xl bg-brand-primary/10 border border-brand-primary/30 flex items-center justify-center text-brand-glow animate-pulse">
              {activeTab === 'chunks' && <Database size={32} />}
              {activeTab === 'chat' && <MessageSquare size={32} />}
              {activeTab === 'summary' && <FileText size={32} />}
              {activeTab === 'analytics' && <BarChart3 size={32} />}
            </div>
            
            <div className="max-w-md">
              <h3 className="text-xl font-bold text-white mb-2">
                Tab: {activeTab.toUpperCase()}
              </h3>
              <p className="text-sm text-dark-muted">
                Interface is structured. Integrations and API logic for this view will follow scheduled timeline steps.
              </p>
            </div>
          </div>
        )}
      </main>

      {/* Footer */}
      <footer className="border-t border-dark-border bg-dark-card/20 py-6 mt-auto">
        <div className="max-w-7xl mx-auto px-6 flex flex-col md:flex-row items-center justify-between text-xs text-dark-muted gap-4">
          <p>© 2026 Prometheus AI Project. Hackathon Submission.</p>
          <div className="flex items-center gap-6">
            <span>Built with Node.js & React</span>
            <span>Grounding: Google Gemini</span>
            <span className="text-brand-glow">Phase: Day 1 (Setup Shell)</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
