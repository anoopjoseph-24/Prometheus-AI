import React, { useState, useEffect, useRef } from 'react';
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
  ExternalLink,
  Info,
  Terminal,
  Layers,
  ChevronRight
} from 'lucide-react';

export default function App() {
  const [activeTab, setActiveTab] = useState('crawl');
  const [isCrawling, setIsCrawling] = useState(false);
  const [crawlStatus, setCrawlStatus] = useState('idle'); // idle, crawling, success, error
  const [crawlMessage, setCrawlMessage] = useState('Console initialized. Enter target URL to begin indexing.');
  
  // Scraper inputs
  const [targetUrl, setTargetUrl] = useState('');
  const [maxDepth, setMaxDepth] = useState(2);
  const [maxPages, setMaxPages] = useState(15);
  const [onlySameDomain, setOnlySameDomain] = useState(true);

  // Pages state
  const [pages, setPages] = useState([]);
  const [selectedPage, setSelectedPage] = useState(null);

  // Visual sitemap states (nodes and edges for Canvas Graph)
  const [nodes, setNodes] = useState([]);
  const [edges, setEdges] = useState([]);
  
  const nodesRef = useRef([]);
  const edgesRef = useRef([]);
  const canvasRef = useRef(null);
  const animationRef = useRef(null);
  const dragNodeRef = useRef(null);

  // Sync ref with states for physics frame loop
  useEffect(() => {
    nodesRef.current = nodes;
  }, [nodes]);

  useEffect(() => {
    edgesRef.current = edges;
  }, [edges]);

  // Load existing pages on mount and build static graph coordinates
  useEffect(() => {
    fetchStatus();
  }, []);

  const fetchStatus = async () => {
    try {
      const res = await fetch('/api/pages');
      if (res.ok) {
        const data = await res.json();
        if (data.pages && data.pages.length > 0) {
          setPages(data.pages);
          setCrawlStatus('success');
          setCrawlMessage(`[INFO] Loaded ${data.pages.length} documents from db.json.`);
          buildStaticGraph(data.pages);
        }
      }
    } catch (err) {
      console.error('Failed to load local DB:', err);
    }
  };

  const buildStaticGraph = (pagesList) => {
    if (!pagesList || pagesList.length === 0) return;
    
    const width = 680;
    const height = 350;

    const firstUrl = pagesList[0].url;
    let origin;
    try {
      origin = new URL(firstUrl).origin;
    } catch {
      origin = firstUrl;
    }

    const newNodes = [
      { id: 'root', label: 'Ψ', x: width / 2, y: height / 2, isRoot: true, status: 'success', url: firstUrl }
    ];
    const newEdges = [];

    pagesList.forEach((page, index) => {
      if (page.url === firstUrl) return;
      
      const angle = (index / (pagesList.length || 1)) * Math.PI * 2;
      const radius = 80 + Math.random() * 40;
      const nodeId = page.id || `node-${index}`;
      
      newNodes.push({
        id: nodeId,
        label: page.title || page.url.replace(origin, '') || '/',
        url: page.url,
        x: width / 2 + Math.cos(angle) * radius,
        y: height / 2 + Math.sin(angle) * radius,
        status: 'success',
        wordCount: page.wordCount
      });

      newEdges.push({
        source: 'root',
        target: nodeId
      });
    });

    setNodes(newNodes);
    setEdges(newEdges);
  };

  // Run sitemap force-directed layout simulation on Canvas
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');

    const runSimulation = () => {
      const currentNodes = [...nodesRef.current];
      const currentEdges = [...edgesRef.current];
      const width = canvas.width;
      const height = canvas.height;

      // 1. Repulsion between all nodes
      for (let i = 0; i < currentNodes.length; i++) {
        for (let j = i + 1; j < currentNodes.length; j++) {
          const n1 = currentNodes[i];
          const n2 = currentNodes[j];
          
          const dx = n2.x - n1.x;
          const dy = n2.y - n1.y;
          const dist = Math.sqrt(dx * dx + dy * dy) || 1;
          
          if (dist < 120) {
            const force = (120 - dist) * 0.05;
            const fx = (dx / dist) * force;
            const fy = (dy / dist) * force;
            
            if (!n1.isRoot && n1 !== dragNodeRef.current) {
              n1.x -= fx;
              n1.y -= fy;
            }
            if (!n2.isRoot && n2 !== dragNodeRef.current) {
              n2.x += fx;
              n2.y += fy;
            }
          }
        }
      }

      // 2. Attraction along connection links
      currentEdges.forEach(edge => {
        const sourceNode = currentNodes.find(n => n.id === edge.source);
        const targetNode = currentNodes.find(n => n.id === edge.target);
        
        if (sourceNode && targetNode) {
          const dx = targetNode.x - sourceNode.x;
          const dy = targetNode.y - sourceNode.y;
          const dist = Math.sqrt(dx * dx + dy * dy) || 1;
          const targetDist = 70;
          
          if (dist > targetDist) {
            const force = (dist - targetDist) * 0.03;
            const fx = (dx / dist) * force;
            const fy = (dy / dist) * force;
            
            if (!sourceNode.isRoot && sourceNode !== dragNodeRef.current) {
              sourceNode.x += fx;
              sourceNode.y += fy;
            }
            if (!targetNode.isRoot && targetNode !== dragNodeRef.current) {
              targetNode.x -= fx;
              targetNode.y -= fy;
            }
          }
        }
      });

      // 3. Friction, Boundary checks, and root centering
      currentNodes.forEach(node => {
        if (node.isRoot) {
          node.x += (width / 2 - node.x) * 0.05;
          node.y += (height / 2 - node.y) * 0.05;
        } else {
          node.x = Math.max(20, Math.min(width - 20, node.x));
          node.y = Math.max(20, Math.min(height - 20, node.y));
        }
      });

      // Clear Frame
      ctx.clearRect(0, 0, width, height);

      // Draw Grid Background
      ctx.strokeStyle = '#f4f4f5';
      ctx.lineWidth = 1;
      const gridSize = 25;
      for (let x = 0; x < width; x += gridSize) {
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, height);
        ctx.stroke();
      }
      for (let y = 0; y < height; y += gridSize) {
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(width, y);
        ctx.stroke();
      }

      // Draw Edges (Connection links)
      currentEdges.forEach(edge => {
        const sourceNode = currentNodes.find(n => n.id === edge.source);
        const targetNode = currentNodes.find(n => n.id === edge.target);
        
        if (sourceNode && targetNode) {
          const grad = ctx.createLinearGradient(sourceNode.x, sourceNode.y, targetNode.x, targetNode.y);
          grad.addColorStop(0, '#dc2626'); // Crimson
          grad.addColorStop(1, '#a1a1aa'); // Muted Zinc
          ctx.strokeStyle = grad;
          ctx.lineWidth = 1.2;
          ctx.beginPath();
          ctx.moveTo(sourceNode.x, sourceNode.y);
          ctx.lineTo(targetNode.x, targetNode.y);
          ctx.stroke();
        }
      });

      // Draw Nodes
      currentNodes.forEach(node => {
        ctx.beginPath();
        const radius = node.isRoot ? 14 : 9;
        ctx.arc(node.x, node.y, radius, 0, Math.PI * 2);
        
        let fillColor = '#d4d4d8'; // default zinc
        let shadowColor = 'rgba(0, 0, 0, 0.05)';
        
        if (node.status === 'crawling') {
          fillColor = '#ef4444'; // Red
          shadowColor = 'rgba(239, 68, 68, 0.3)';
        } else if (node.status === 'success') {
          fillColor = node.isRoot ? '#dc2626' : '#10b981'; // Crimson root or emerald child
          shadowColor = node.isRoot ? 'rgba(220, 38, 38, 0.3)' : 'rgba(16, 185, 129, 0.2)';
        }

        ctx.fillStyle = fillColor;
        ctx.shadowBlur = 6;
        ctx.shadowColor = shadowColor;
        ctx.fill();
        ctx.shadowBlur = 0; // reset

        // Border outline
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 1.5;
        ctx.stroke();

        // Node Labels
        ctx.fillStyle = '#27272a'; // dark zinc text
        ctx.font = node.isRoot ? 'bold 11px Inter' : '10px Inter';
        ctx.textAlign = 'center';
        
        const labelText = node.label.length > 20 ? node.label.substring(0, 18) + '...' : node.label;
        ctx.fillText(labelText, node.x, node.y - radius - 4);
      });

      animationRef.current = requestAnimationFrame(runSimulation);
    };

    runSimulation();

    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, []);

  // Click & Drag node handlers
  const handleMouseDown = (e) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    const clickedNode = nodes.find(node => {
      const radius = node.isRoot ? 14 : 9;
      const dx = node.x - x;
      const dy = node.y - y;
      return Math.sqrt(dx * dx + dy * dy) < radius;
    });

    if (clickedNode) {
      dragNodeRef.current = clickedNode;
      if (clickedNode.status === 'success' && !clickedNode.isRoot) {
        const matchedPage = pages.find(p => p.id === clickedNode.id || p.url === clickedNode.url);
        if (matchedPage) setSelectedPage(matchedPage);
      }
    }
  };

  const handleMouseMove = (e) => {
    if (!dragNodeRef.current) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    dragNodeRef.current.x = x;
    dragNodeRef.current.y = y;
  };

  const handleMouseUp = () => {
    dragNodeRef.current = null;
  };

  const handleStartCrawl = (e) => {
    e.preventDefault();
    if (!targetUrl) return;
    setIsCrawling(true);
    setCrawlStatus('crawling');
    setCrawlMessage(`[INFO] Resolving DNS for ${targetUrl}... \n[INFO] Starting crawler thread (Max depth: ${maxDepth}, Max pages: ${maxPages})...`);
    
    // Simulate a basic crawl start (will wire with SSE in Commit 8)
    setTimeout(() => {
      setIsCrawling(false);
      setCrawlStatus('success');
      setCrawlMessage(`[SUCCESS] Crawl completed. Indexed 2 pages under domain.\n[INFO] Local database synced at backend/data/db.json.`);
      const crawledData = [
        { id: '1', url: targetUrl, title: 'Home Page', description: 'Starting page', content: 'This is main page content for the target website. It represents the structural index.', wordCount: 150 },
        { id: '2', url: `${targetUrl}/about`, title: 'About Us', description: 'Company info', content: 'This is company information content and operational details.', wordCount: 220 }
      ];
      setPages(crawledData);
      buildStaticGraph(crawledData);
    }, 2000);
  };

  return (
    <div className="flex min-h-screen bg-workspace-bg">
      
      {/* Left Sidebar: Crimson & Obsidian Theme (Dark Side) */}
      <aside className="w-64 bg-sidebar-bg border-r border-sidebar-border flex flex-col shrink-0 text-sidebar-text">
        {/* Brand Logo */}
        <div className="p-6 border-b border-sidebar-border flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-brand-primary flex items-center justify-center shadow-lg shadow-brand-primary/30">
            <span className="text-white font-bold font-mono text-lg">Ψ</span>
          </div>
          <div>
            <h1 className="text-sm font-bold text-white tracking-wide">PROMETHEUS</h1>
            <p className="text-[10px] text-zinc-500 uppercase tracking-widest font-semibold">RAG intelligence</p>
          </div>
        </div>

        {/* Vertical Nav List */}
        <nav className="flex-1 px-4 py-6 flex flex-col gap-1.5">
          <button
            onClick={() => setActiveTab('crawl')}
            className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg text-xs font-semibold tracking-wide transition-all ${
              activeTab === 'crawl' 
                ? 'text-white bg-sidebar-hoverBg border-l-2 border-brand-primary' 
                : 'hover:text-white hover:bg-sidebar-hoverBg/50'
            }`}
          >
            <Globe size={16} className={activeTab === 'crawl' ? 'text-brand-glow' : ''} />
            Crawl Control
            <ChevronRight size={14} className="ml-auto opacity-50" />
          </button>
          
          <button
            onClick={() => setActiveTab('chunks')}
            className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg text-xs font-semibold tracking-wide transition-all ${
              activeTab === 'chunks' 
                ? 'text-white bg-sidebar-hoverBg border-l-2 border-brand-primary' 
                : 'hover:text-white hover:bg-sidebar-hoverBg/50'
            }`}
          >
            <Database size={16} className={activeTab === 'chunks' ? 'text-brand-glow' : ''} />
            Chunks Index
            <ChevronRight size={14} className="ml-auto opacity-50" />
          </button>

          <button
            onClick={() => setActiveTab('chat')}
            className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg text-xs font-semibold tracking-wide transition-all ${
              activeTab === 'chat' 
                ? 'text-white bg-sidebar-hoverBg border-l-2 border-brand-primary' 
                : 'hover:text-white hover:bg-sidebar-hoverBg/50'
            }`}
          >
            <MessageSquare size={16} className={activeTab === 'chat' ? 'text-brand-glow' : ''} />
            QA Chatbot
            <ChevronRight size={14} className="ml-auto opacity-50" />
          </button>

          <button
            onClick={() => setActiveTab('summary')}
            className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg text-xs font-semibold tracking-wide transition-all ${
              activeTab === 'summary' 
                ? 'text-white bg-sidebar-hoverBg border-l-2 border-brand-primary' 
                : 'hover:text-white hover:bg-sidebar-hoverBg/50'
            }`}
          >
            <FileText size={16} className={activeTab === 'summary' ? 'text-brand-glow' : ''} />
            Site Summaries
            <ChevronRight size={14} className="ml-auto opacity-50" />
          </button>

          <button
            onClick={() => setActiveTab('analytics')}
            className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg text-xs font-semibold tracking-wide transition-all ${
              activeTab === 'analytics' 
                ? 'text-white bg-sidebar-hoverBg border-l-2 border-brand-primary' 
                : 'hover:text-white hover:bg-sidebar-hoverBg/50'
            }`}
          >
            <BarChart3 size={16} className={activeTab === 'analytics' ? 'text-brand-glow' : ''} />
            Analytics Info
            <ChevronRight size={14} className="ml-auto opacity-50" />
          </button>
        </nav>

        {/* Sidebar Footer: System Status */}
        <div className="p-4 border-t border-sidebar-border flex items-center gap-2.5 text-[11px] text-zinc-500">
          <span className="w-2 h-2 rounded-full bg-emerald-500 block animate-pulse"></span>
          <span>Core Agent Online</span>
        </div>
      </aside>

      {/* Right Content Space: Workspace (Bright Side) */}
      <main className="flex-grow min-h-screen workspace-grid flex flex-col text-workspace-text p-8 overflow-y-auto">
        
        {/* Workspace Title bar */}
        <div className="flex items-center justify-between border-b border-workspace-border pb-5 mb-6">
          <div>
            <h2 className="text-xl font-bold tracking-tight text-zinc-900 capitalize">
              {activeTab === 'crawl' && 'Scraper Control & Sitemap'}
              {activeTab === 'chunks' && 'Document Segment Indexer'}
              {activeTab === 'chat' && 'Contextual Knowledge Chat'}
              {activeTab === 'summary' && 'Executive Summarization Hub'}
              {activeTab === 'analytics' && 'Operational Analytics & Health'}
            </h2>
            <p className="text-xs text-workspace-muted mt-1">
              {activeTab === 'crawl' && 'Ingest any URL, crawl recursively, and map out visual links.'}
              {activeTab === 'chunks' && 'Preview documents sliced into semantic vectors.'}
              {activeTab === 'chat' && 'Perform grounding audits and ask contextual website FAQs.'}
              {activeTab === 'summary' && 'Review AI-generated general summaries and automated QAs.'}
              {activeTab === 'analytics' && 'Inspect site health details, word distribution, and links.'}
            </p>
          </div>
          <div className="flex items-center gap-4 text-xs font-semibold text-workspace-muted">
            <span className="bg-zinc-200/50 border border-zinc-300/40 text-zinc-700 px-3 py-1.5 rounded-lg flex items-center gap-1.5">
              <Info size={14} className="text-zinc-600" />
              API: Active Port 5001
            </span>
          </div>
        </div>

        {/* TAB 1: CRAWL HUB */}
        {activeTab === 'crawl' && (
          <div className="flex flex-col gap-6">
            
            {/* Custom Horizontal Crawl Panel (Replaces generic grid boxes) */}
            <div className="workspace-card p-6">
              <form onSubmit={handleStartCrawl} className="flex flex-col md:flex-row items-stretch md:items-end gap-5">
                <div className="flex-1">
                  <label className="text-[11px] font-bold text-zinc-500 uppercase tracking-wider block mb-2">Target Website URL</label>
                  <div className="relative">
                    <input 
                      type="url" 
                      placeholder="https://example.com/docs"
                      value={targetUrl}
                      onChange={(e) => setTargetUrl(e.target.value)}
                      disabled={isCrawling}
                      className="w-full bg-zinc-50 border border-workspace-border focus:border-brand-primary focus:bg-white rounded-xl pl-4 pr-10 py-3 text-sm focus:outline-none text-zinc-900 transition-all font-medium"
                      required
                    />
                    <Globe className="absolute right-3.5 top-3.5 text-zinc-400" size={16} />
                  </div>
                </div>

                <div className="w-full md:w-36">
                  <label className="text-[11px] font-bold text-zinc-500 uppercase tracking-wider block mb-2">Max Depth</label>
                  <select 
                    value={maxDepth}
                    onChange={(e) => setMaxDepth(parseInt(e.target.value) || 2)}
                    disabled={isCrawling}
                    className="w-full bg-zinc-50 border border-workspace-border focus:border-brand-primary focus:bg-white rounded-xl px-3 py-3 text-sm focus:outline-none text-zinc-900 font-medium cursor-pointer"
                  >
                    <option value="1">1 (Direct Page)</option>
                    <option value="2">2 (Standard links)</option>
                    <option value="3">3 (Sub-folders)</option>
                  </select>
                </div>

                <div className="w-full md:w-36">
                  <label className="text-[11px] font-bold text-zinc-500 uppercase tracking-wider block mb-2">Page Limit</label>
                  <input 
                    type="number" 
                    min="1" 
                    max="50"
                    value={maxPages}
                    onChange={(e) => setMaxPages(parseInt(e.target.value) || 15)}
                    disabled={isCrawling}
                    className="w-full bg-zinc-50 border border-workspace-border focus:border-brand-primary focus:bg-white rounded-xl px-4 py-3 text-sm focus:outline-none text-zinc-900 font-medium"
                  />
                </div>

                <div className="flex items-center gap-3 h-12">
                  <input 
                    type="checkbox" 
                    id="domain"
                    checked={onlySameDomain}
                    onChange={(e) => setOnlySameDomain(e.target.checked)}
                    disabled={isCrawling}
                    className="w-4 h-4 rounded border-zinc-300 text-brand-primary focus:ring-brand-primary focus:ring-offset-white cursor-pointer"
                  />
                  <label htmlFor="domain" className="text-xs text-zinc-700 font-semibold select-none cursor-pointer">
                    Domain restrictions
                  </label>
                </div>

                <button 
                  type="submit"
                  disabled={isCrawling || !targetUrl}
                  className="bg-brand-primary hover:bg-brand-accent text-white font-semibold py-3 px-8 rounded-xl flex items-center justify-center gap-2 transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-md shadow-brand-primary/10 select-none text-sm shrink-0"
                >
                  {isCrawling ? (
                    <>
                      <Loader2 className="animate-spin" size={16} />
                      Indexing...
                    </>
                  ) : (
                    <>
                      <Play size={16} />
                      Run Scraper
                    </>
                  )}
                </button>
              </form>
            </div>

            {/* Sitemap Graphic & Real-Time Console Terminal (Custom Dual Panels) */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              
              {/* Graphic Sitemap */}
              <div className="lg:col-span-2 workspace-card p-6 flex flex-col gap-4">
                <div className="flex items-center justify-between border-b border-zinc-100 pb-3">
                  <div>
                    <h3 className="text-sm font-bold text-zinc-800">Recursive Link Network Map</h3>
                    <p className="text-[11px] text-workspace-muted">Physics-based graph visualization showing link tree structure.</p>
                  </div>
                  <div className="flex items-center gap-4 text-[10px] font-bold uppercase tracking-wider text-workspace-muted">
                    <div className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-brand-primary block"></span>Root</div>
                    <div className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-zinc-300 block"></span>Queued</div>
                  </div>
                </div>

                {/* Graph Area */}
                <div className="relative border border-zinc-200 bg-zinc-50/50 rounded-xl overflow-hidden min-h-[300px] flex items-center justify-center">
                  <canvas 
                    ref={canvasRef} 
                    width={680} 
                    height={350}
                    onMouseDown={handleMouseDown}
                    onMouseMove={handleMouseMove}
                    onMouseUp={handleMouseUp}
                    onMouseLeave={handleMouseUp}
                    className="max-w-full cursor-grab active:cursor-grabbing block"
                  />
                  
                  {nodes.length === 0 && (
                    <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-zinc-50/80 backdrop-blur-[1px]">
                      <Globe className="text-zinc-300 animate-bounce" size={40} />
                      <div className="text-center">
                        <span className="text-xs font-bold text-zinc-700 block">Sitemap Graph Empty</span>
                        <span className="text-[10px] text-workspace-muted mt-1 block">Please enter a URL and start the crawl to populate nodes.</span>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Console Monitor (Realistic Black Console contrast against Light background) */}
              <div className="lg:col-span-1 bg-[#09090b] border border-zinc-850 rounded-2xl p-5 flex flex-col gap-4 text-zinc-300 shadow-xl">
                <div className="flex items-center justify-between border-b border-zinc-800 pb-3">
                  <div className="flex items-center gap-2 text-white">
                    <Terminal className="text-brand-glow" size={16} />
                    <span className="text-xs font-bold tracking-wider font-mono">CRAWL_CONSOLE</span>
                  </div>
                  <span className="text-[9px] bg-red-950/40 border border-red-500/20 text-brand-glow px-2 py-0.5 rounded uppercase font-bold font-mono">
                    {crawlStatus}
                  </span>
                </div>

                <div className="flex-grow font-mono text-[10px] text-zinc-400 overflow-y-auto leading-relaxed flex flex-col gap-1.5 min-h-[220px]">
                  <div className="text-zinc-600"># System startup checks passed</div>
                  <div className="text-zinc-600"># Configured with local DB (db.json)</div>
                  <div className="text-brand-glow mt-1 font-semibold whitespace-pre-line">&gt; {crawlMessage}</div>
                </div>
              </div>
            </div>

            {/* Document Indexing Logs */}
            <div className="workspace-card p-6 flex flex-col gap-4">
              <div className="flex items-center justify-between border-b border-zinc-100 pb-3">
                <h3 className="text-sm font-bold text-zinc-800 flex items-center gap-2">
                  <Layers className="text-brand-primary" size={16} />
                  Extracted Content Directories ({pages.length})
                </h3>
              </div>

              {pages.length === 0 ? (
                <div className="text-xs text-workspace-muted p-6 text-center italic">
                  No documents in queue. Run the URL scraper to populate database records.
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead>
                      <tr className="border-b border-zinc-200 text-zinc-500 font-bold uppercase text-[10px] tracking-wider">
                        <th className="pb-3">Title / Path</th>
                        <th className="pb-3">URL Link</th>
                        <th className="pb-3">Index ID</th>
                        <th className="pb-3 text-right">Words</th>
                        <th className="pb-3 text-right">Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-zinc-100 text-zinc-700 font-medium">
                      {pages.map((page, index) => (
                        <tr key={page.id || index} className="hover:bg-zinc-50/50">
                          <td className="py-4 font-bold text-zinc-800">{page.title}</td>
                          <td className="py-4 text-workspace-muted truncate max-w-xs">{page.url}</td>
                          <td className="py-4 font-mono text-zinc-500">{page.id}</td>
                          <td className="py-4 text-right font-mono">{page.wordCount}</td>
                          <td className="py-4 text-right">
                            <button
                              onClick={() => setSelectedPage(page)}
                              className="text-brand-primary hover:text-brand-accent hover:underline flex items-center gap-1 ml-auto text-[11px]"
                            >
                              Inspect <ArrowRight size={12} />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            {/* Inspect Panel */}
            {selectedPage && (
              <div className="workspace-card p-6 flex flex-col gap-4 animate-fadeIn">
                <h3 className="text-sm font-bold text-zinc-800 border-b border-zinc-100 pb-3 flex items-center justify-between">
                  <span>Document Details: {selectedPage.title}</span>
                  <a href={selectedPage.url} target="_blank" rel="noopener noreferrer" className="text-xs text-brand-glow hover:underline flex items-center gap-1">
                    Visit page <ExternalLink size={12} />
                  </a>
                </h3>

                <div className="flex flex-col gap-4 text-xs text-zinc-700">
                  <div className="bg-zinc-50 border border-zinc-200 rounded-xl p-4 leading-relaxed font-sans max-h-56 overflow-y-auto whitespace-pre-line text-zinc-600">
                    {selectedPage.content}
                  </div>
                </div>
              </div>
            )}

          </div>
        )}

        {/* DAY 2-5 PLACEHOLDERS */}
        {activeTab !== 'crawl' && (
          <div className="workspace-card p-12 flex flex-col items-center justify-center text-center gap-5 min-h-[400px]">
            <div className="w-14 h-14 rounded-xl bg-brand-primary/5 border border-brand-primary/10 flex items-center justify-center text-brand-glow animate-pulse">
              {activeTab === 'chunks' && <Database size={24} />}
              {activeTab === 'chat' && <MessageSquare size={24} />}
              {activeTab === 'summary' && <FileText size={24} />}
              {activeTab === 'analytics' && <BarChart3 size={24} />}
            </div>
            
            <div className="max-w-md">
              <h3 className="text-base font-bold text-zinc-800 mb-1">
                {activeTab === 'chunks' && 'Day 2 integration: Semantic Chunker'}
                {activeTab === 'chat' && 'Day 3 integration: RAG Conversational Engine'}
                {activeTab === 'summary' && 'Day 4 integration: Summarizer'}
                {activeTab === 'analytics' && 'Day 5 integration: Operation Charts'}
              </h3>
              <p className="text-xs text-workspace-muted leading-relaxed">
                Visual interfaces and hooks for this module will be initialized dynamically on its respective roadmap step.
              </p>
            </div>
          </div>
        )}

      </main>
    </div>
  );
}
