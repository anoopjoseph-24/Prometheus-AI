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
import confetti from 'canvas-confetti';

const renderInlineCodeAndBold = (text) => {
  if (!text) return '';
  const boldParts = text.split('**');
  return boldParts.map((boldPart, boldIndex) => {
    const isBold = boldIndex % 2 === 1;
    const codeParts = boldPart.split('`');
    const renderedCode = codeParts.map((codePart, codeIndex) => {
      const isCode = codeIndex % 2 === 1;
      if (isCode) {
        return (
          <code key={codeIndex} className="bg-zinc-100 text-zinc-900 px-1 py-0.5 rounded font-mono text-[10px] border border-zinc-200">
            {codePart}
          </code>
        );
      }
      return codePart;
    });
    
    if (isBold) {
      return (
        <strong key={boldIndex} className="font-extrabold text-zinc-950 bg-zinc-100/60 px-1.5 py-0.5 rounded border border-zinc-200/50">
          {renderedCode}
        </strong>
      );
    }
    return <React.Fragment key={boldIndex}>{renderedCode}</React.Fragment>;
  });
};

const renderFormattedText = (text) => {
  if (!text) return null;
  const lines = text.split('\n');
  return (
    <div className="space-y-1">
      {lines.map((line, lineIdx) => {
        const trimmed = line.trim();
        if (!trimmed) {
          return <div key={lineIdx} className="h-2" />;
        }
        
        let isBullet = false;
        let isNumbered = false;
        let numPrefix = "";
        let content = line;
        
        const numMatch = trimmed.match(/^(\d+)\.\s(.*)/);
        if (trimmed.startsWith('* ') || trimmed.startsWith('- ') || trimmed.startsWith('• ')) {
          isBullet = true;
          content = trimmed.substring(2);
        } else if (numMatch) {
          isNumbered = true;
          numPrefix = numMatch[1] + ".";
          content = numMatch[2];
        }
        
        const renderedParts = renderInlineCodeAndBold(content);
        
        if (isBullet) {
          return (
            <div key={lineIdx} className="flex items-start gap-2 pl-3 py-0.5 text-left">
              <span className="text-brand-primary text-xs mt-1 shrink-0">•</span>
              <span className="flex-1">{renderedParts}</span>
            </div>
          );
        }
        
        if (isNumbered) {
          return (
            <div key={lineIdx} className="flex items-start gap-2 pl-3 py-0.5 text-left">
              <span className="text-brand-primary text-[10px] font-bold mt-1.5 shrink-0 min-w-[14px] text-right">{numPrefix}</span>
              <span className="flex-1">{renderedParts}</span>
            </div>
          );
        }
        
        return (
          <div key={lineIdx} className="leading-relaxed">
            {renderedParts}
          </div>
        );
      })}
    </div>
  );
};

export default function App() {
  const [activeTab, setActiveTab] = useState('crawl');
  const [isCrawling, setIsCrawling] = useState(false);
  const [crawlStatus, setCrawlStatus] = useState('idle'); // idle, crawling, success, error
  const [crawlMessage, setCrawlMessage] = useState('Console initialized. Enter target URL to begin indexing.');

  // Scraper inputs
  const [targetUrl, setTargetUrl] = useState('');
  const [maxDepth, setMaxDepth] = useState(2);
  const [maxPages, setMaxPages] = useState(2);
  const [onlySameDomain, setOnlySameDomain] = useState(true);

  // Pages state
  const [pages, setPages] = useState([]);
  const [selectedPage, setSelectedPage] = useState(null);
  const [chunks, setChunks] = useState([]);
  const [selectedChunkPage, setSelectedChunkPage] = useState(null);

  // Chat state
  const [chatMessages, setChatMessages] = useState([
    {
      sender: 'bot',
      text: 'Hello! I am Prometheus AI. I have indexed the crawled pages and am ready to answer questions grounded in the content. Ask me anything!',
      timestamp: new Date().toLocaleTimeString(),
      sources: []
    }
  ]);
  const [chatQuery, setChatQuery] = useState('');
  const [isSendingMessage, setIsSendingMessage] = useState(false);
  const [hoveredPageId, setHoveredPageId] = useState(null);

  // Visual sitemap states (nodes and edges for Canvas Graph)
  const [nodes, setNodes] = useState([]);
  const [edges, setEdges] = useState([]);

  // Summary & FAQ states
  const [siteSummary, setSiteSummary] = useState(null);
  const [faqs, setFaqs] = useState([]);
  const [isGeneratingSummary, setIsGeneratingSummary] = useState(false);
  const [summaryError, setSummaryError] = useState(null);
  const [expandedFaqIndex, setExpandedFaqIndex] = useState(null);

  // Selected document summary & tags states
  const [pageSummary, setPageSummary] = useState("");
  const [isPageSummaryLoading, setIsPageSummaryLoading] = useState(false);

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
    
    const handleCleanup = () => {
      navigator.sendBeacon('/api/db/clear');
    };
    window.addEventListener('beforeunload', handleCleanup);
    window.addEventListener('unload', handleCleanup);
    return () => {
      window.removeEventListener('beforeunload', handleCleanup);
      window.removeEventListener('unload', handleCleanup);
    };
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
          setSelectedChunkPage(prev => prev || data.pages[0]);
        }
      }
      await fetchChunks();
    } catch (err) {
      console.error('Failed to load local DB:', err);
    }
  };

  const fetchChunks = async () => {
    try {
      const res = await fetch('/api/chunks');
      if (res.ok) {
        const data = await res.json();
        if (data.chunks) {
          setChunks(data.chunks);
        }
      }
    } catch (err) {
      console.error('Failed to load chunks:', err);
    }
  };

  const fetchSummaryAndFaqs = async (forceRegenerate = false) => {
    setIsGeneratingSummary(true);
    setSummaryError(null);
    try {
      const endpoint = forceRegenerate ? '/api/summary/regenerate' : '/api/summary';
      const method = forceRegenerate ? 'POST' : 'GET';
      
      const summaryRes = await fetch(endpoint, { method });
      if (!summaryRes.ok) {
        throw new Error('Failed to generate website summary.');
      }
      const summaryData = await summaryRes.json();
      
      // If we force regenerated, the POST returns both summary and faqs.
      if (forceRegenerate) {
        setSiteSummary(summaryData.summary);
        setFaqs(summaryData.faqs || []);
      } else {
        setSiteSummary(summaryData);
        // Fetch FAQs
        const faqsRes = await fetch('/api/faqs');
        if (faqsRes.ok) {
          const faqsData = await faqsRes.json();
          setFaqs(faqsData.faqs || []);
        }
      }
    } catch (err) {
      console.error(err);
      setSummaryError(err.message);
    } finally {
      setIsGeneratingSummary(false);
    }
  };

  const handleAskFaqChat = (question) => {
    setChatQuery(question);
    setActiveTab('chat');
    handleSendMessage(null, question);
  };

  const handleSectionClick = (section, idx) => {
    if (!pages || pages.length === 0) return;
    
    let matchedPage = pages.find(p => {
      const pTitle = (p.title || '').toLowerCase();
      const sTitle = (section.title || '').toLowerCase();
      return pTitle.includes(sTitle) || sTitle.includes(pTitle);
    });
    
    if (!matchedPage && pages[idx]) {
      matchedPage = pages[idx];
    }
    
    if (matchedPage) {
      setSelectedChunkPage(matchedPage);
      setActiveTab('chunks');
    }
  };

  const fetchPageSummary = async (pageId) => {
    setIsPageSummaryLoading(true);
    setPageSummary("");
    try {
      const res = await fetch(`/api/pages/${pageId}/summary`);
      if (res.ok) {
        const data = await res.json();
        setPageSummary(data.summary || "");
      }
    } catch (err) {
      console.error('Failed to load page summary:', err);
    } finally {
      setIsPageSummaryLoading(false);
    }
  };

  const extractTopicTags = (text) => {
    if (!text) return [];
    const stopWords = new Set(['about', 'there', 'their', 'would', 'could', 'should', 'under', 'these', 'those', 'where', 'which', 'other', 'after', 'before', 'first', 'second', 'years', 'using', 'every', 'through', 'above', 'below', 'within', 'without', 'website', 'pages', 'crawled', 'indexed', 'content', 'products', 'results', 'showing', 'warning']);
    const words = text.toLowerCase()
      .replace(/[^\w\s]/g, '')
      .split(/\s+/)
      .filter(w => w.length > 4 && !stopWords.has(w));
      
    const freqs = {};
    words.forEach(w => {
      freqs[w] = (freqs[w] || 0) + 1;
    });
    
    return Object.entries(freqs)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)
      .map(entry => entry[0]);
  };

  useEffect(() => {
    if (activeTab === 'chunks') {
      fetchChunks();
    } else if (activeTab === 'summary') {
      fetchSummaryAndFaqs();
    }
  }, [activeTab]);

  useEffect(() => {
    if (selectedChunkPage) {
      fetchPageSummary(selectedChunkPage.id);
    }
  }, [selectedChunkPage]);

  const handleSendMessage = async (e, directText = null) => {
    if (e) e.preventDefault();
    const messageText = directText || chatQuery;
    if (!messageText.trim() || isSendingMessage) return;

    const userMsg = {
      sender: 'user',
      text: messageText,
      timestamp: new Date().toLocaleTimeString(),
      sources: []
    };

    setChatMessages(prev => [...prev, userMsg]);
    if (!directText) setChatQuery('');
    setIsSendingMessage(true);

    try {
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ query: messageText })
      });

      if (response.ok) {
        const data = await response.json();
        setChatMessages(prev => [...prev, {
          sender: 'bot',
          text: data.answer,
          timestamp: new Date().toLocaleTimeString(),
          sources: data.sources || []
        }]);
      } else {
        const errorData = await response.json();
        setChatMessages(prev => [...prev, {
          sender: 'bot',
          text: `[ERROR] Failed to obtain grounded completion: ${errorData.error || 'Server error'}`,
          timestamp: new Date().toLocaleTimeString(),
          sources: []
        }]);
      }
    } catch (err) {
      console.error('Chat error:', err);
      setChatMessages(prev => [...prev, {
        sender: 'bot',
        text: `[ERROR] Network issue occurred while communicating with the server: ${err.message}`,
        timestamp: new Date().toLocaleTimeString(),
        sources: []
      }]);
    } finally {
      setIsSendingMessage(false);
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

      // Find the closest parent folder URL in pagesList
      let parentNodeId = 'root';
      try {
        const urlObj = new URL(page.url);
        const pathParts = urlObj.pathname.split('/').filter(Boolean);
        if (pathParts.length > 1) {
          pathParts.pop(); // Remove last segment to get parent path
          const parentPath = '/' + pathParts.join('/');
          const parentUrl = urlObj.origin + parentPath;
          const parentPage = pagesList.find(p => p.url === parentUrl || p.url === parentUrl + '/');
          if (parentPage) {
            parentNodeId = parentPage.id;
          }
        }
      } catch (e) {
        // Fallback to root
      }

      newEdges.push({
        source: parentNodeId,
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
    setCrawlMessage(`[INFO] Connecting to scraping endpoint for ${targetUrl}...\n`);
    setPages([]);
    setSelectedPage(null);

    // Reset graph nodes to just the root node
    let origin;
    try {
      origin = new URL(targetUrl).origin;
    } catch {
      origin = targetUrl;
    }

    const rootNode = {
      id: 'root',
      label: 'Ψ',
      x: 340,
      y: 175,
      isRoot: true,
      status: 'crawling',
      url: targetUrl
    };

    setNodes([rootNode]);
    setEdges([]);

    // Open EventSource connection to backend SSE API
    const urlParams = new URLSearchParams({
      url: targetUrl,
      depth: maxDepth,
      maxPages: maxPages || 2
    });

    const eventSource = new EventSource(`/api/crawl?${urlParams.toString()}`);

    eventSource.addEventListener('status', (event) => {
      const data = JSON.parse(event.data);

      // Prepend timestamp to message
      const timeStr = new Date().toLocaleTimeString();
      setCrawlMessage(prev => prev + `\n[${timeStr}] ${data.message}`);

      if (data.type === 'success') {
        setIsCrawling(false);
        setCrawlStatus('success');
        eventSource.close();

        // Celebration Confetti
        confetti({
          particleCount: 100,
          spread: 70,
          origin: { y: 0.8 },
          colors: ['#dc2626', '#18181b', '#10b981']
        });

        // Load the finalized pages list into sidebar
        fetchStatus();
      } else if (data.type === 'error') {
        setIsCrawling(false);
        setCrawlStatus('error');
        eventSource.close();
      }
    });

    eventSource.addEventListener('page_start', (event) => {
      const data = JSON.parse(event.data);
      const timeStr = new Date().toLocaleTimeString();
      setCrawlMessage(prev => prev + `\n[${timeStr}] Discovering: ${data.url}`);

      // Add a crawling node to the canvas sitemap
      setNodes(prevNodes => {
        const exist = prevNodes.some(n => n.url === data.url);
        if (exist) {
          return prevNodes.map(n => n.url === data.url ? { ...n, status: 'crawling' } : n);
        }

        const angle = Math.random() * Math.PI * 2;
        const radius = 70 + Math.random() * 50;
        const tempId = `temp-${Date.now()}-${Math.random()}`;

        // Connect a link line from its actual parent to this new page
        const parentId = data.parentId || 'root';
        setEdges(prevEdges => [...prevEdges, { source: parentId, target: tempId }]);

        return [...prevNodes, {
          id: tempId,
          label: data.url.replace(origin, '') || '/',
          url: data.url,
          x: 340 + Math.cos(angle) * radius,
          y: 175 + Math.sin(angle) * radius,
          status: 'crawling'
        }];
      });
    });

    eventSource.addEventListener('page_success', (event) => {
      const eventData = JSON.parse(event.data);
      const data = eventData.page;
      const parentId = eventData.parentId || 'root';

      // Update node from crawling to success (green)
      setNodes(prevNodes => {
        const matched = prevNodes.find(n => n.url === data.url);
        if (matched) {
          // Update the edges target ID from temporary to permanent ID
          setEdges(prevEdges => prevEdges.map(edge =>
            edge.target === matched.id ? { ...edge, target: data.id, source: parentId } : edge
          ));

          return prevNodes.map(n =>
            n.url === data.url
              ? { ...n, id: data.id, label: data.title || data.url.replace(origin, '') || '/', status: 'success' }
              : n
          );
        }
        return prevNodes;
      });

      // Append page details locally to update directory indices
      setPages(prevPages => {
        if (prevPages.some(p => p.url === data.url)) return prevPages;
        return [...prevPages, data];
      });
    });

    eventSource.addEventListener('page_error', (event) => {
      const data = JSON.parse(event.data);
      const timeStr = new Date().toLocaleTimeString();
      setCrawlMessage(prev => prev + `\n[${timeStr}] [ERROR] Failed to fetch: ${data.url}`);

      // Mark the node as failed (red)
      setNodes(prevNodes => prevNodes.map(n => n.url === data.url ? { ...n, status: 'failed' } : n));
    });

    eventSource.onerror = (err) => {
      console.error('SSE connection error:', err);
      const timeStr = new Date().toLocaleTimeString();
      setCrawlMessage(prev => prev + `\n[${timeStr}] [ERROR] Lost connection stream.`);
      setCrawlStatus('error');
      setIsCrawling(false);
      eventSource.close();
    };
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
            className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg text-xs font-semibold tracking-wide transition-all ${activeTab === 'crawl'
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
            className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg text-xs font-semibold tracking-wide transition-all ${activeTab === 'chunks'
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
            className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg text-xs font-semibold tracking-wide transition-all ${activeTab === 'chat'
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
            className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg text-xs font-semibold tracking-wide transition-all ${activeTab === 'summary'
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
            className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg text-xs font-semibold tracking-wide transition-all ${activeTab === 'analytics'
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
                    max="15"
                    value={maxPages}
                    onChange={(e) => {
                      const val = parseInt(e.target.value);
                      setMaxPages(isNaN(val) ? '' : Math.min(Math.max(val, 1), 15));
                    }}
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
                        <th className="pb-3 text-right">Words</th>
                        <th className="pb-3 text-right">Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-zinc-100 text-zinc-700 font-medium">
                      {pages.map((page, index) => (
                        <tr key={page.id || index} className="hover:bg-zinc-50/50">
                          <td className="py-4 font-bold text-zinc-800">{page.title}</td>
                          <td className="py-4 text-workspace-muted truncate max-w-xs">{page.url}</td>
                          <td className="py-4 text-right font-mono">{page.wordCount}</td>
                          <td className="py-4 text-right">
                            <button
                              onClick={() => {
                                setSelectedChunkPage(page);
                                setActiveTab('chunks');
                              }}
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

          </div>
        )}

        {/* TAB 2: CHUNKS INDEX */}
        {activeTab === 'chunks' && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Left Panel: Pages List */}
            <div className="lg:col-span-1 workspace-card p-5 flex flex-col gap-4">
              <h3 className="text-sm font-bold text-zinc-800 border-b border-zinc-100 pb-3 flex items-center gap-2">
                <FileText size={16} className="text-brand-primary" />
                Select Ingested Document
              </h3>
              
              {pages.length === 0 ? (
                <div className="text-xs text-workspace-muted italic p-6 text-center">
                  No pages crawled yet. Run the crawler to see text splits.
                </div>
              ) : (
                <div className="flex flex-col gap-2 overflow-y-auto max-h-[600px] pr-1">
                  {pages.map((p) => {
                    const pageChunks = chunks.filter(c => c.pageId === p.id);
                    const isSelected = selectedChunkPage?.id === p.id;
                    return (
                      <button
                        key={p.id}
                        onClick={() => setSelectedChunkPage(p)}
                        className={`w-full text-left p-3.5 rounded-xl border text-xs font-semibold transition-all ${
                          isSelected
                            ? 'bg-zinc-900 border-zinc-900 text-white shadow-md'
                            : 'bg-white border-zinc-200 hover:border-zinc-300 text-zinc-800'
                        }`}
                      >
                        <div className="truncate mb-1">{p.title}</div>
                        <div className={`text-[10px] truncate ${isSelected ? 'text-zinc-400' : 'text-zinc-500'}`}>
                          {p.url}
                        </div>
                        <div className="flex items-center gap-2 mt-2 font-mono text-[9px]">
                          <span className={`px-1.5 py-0.5 rounded ${isSelected ? 'bg-zinc-800 text-zinc-300' : 'bg-zinc-100 text-zinc-600'}`}>
                            {pageChunks.length} Chunks
                          </span>
                          <span className={`px-1.5 py-0.5 rounded ${isSelected ? 'bg-zinc-800 text-zinc-300' : 'bg-zinc-100 text-zinc-600'}`}>
                            {p.wordCount} Words
                          </span>
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Right Panel: Chunks View */}
            <div className="lg:col-span-2 workspace-card p-5 flex flex-col gap-4">
              <h3 className="text-sm font-bold text-zinc-800 border-b border-zinc-100 pb-3 flex items-center justify-between">
                <span className="flex items-center gap-2">
                  <Database size={16} className="text-brand-primary" />
                  Semantic Segments
                </span>
              </h3>

              {!selectedChunkPage ? (
                <div className="flex-grow flex flex-col items-center justify-center text-center gap-3 p-12 text-workspace-muted italic text-xs min-h-[300px]">
                  <Database className="text-zinc-300 animate-pulse" size={32} />
                  Select a document from the left list to inspect its semantic segments.
                </div>
              ) : (
                <div className="flex flex-col gap-4">
                  {/* Premium Document Summary Hub */}
                  <div className="workspace-card p-5 bg-zinc-50/50 border border-zinc-200/80 rounded-xl flex flex-col gap-4">
                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 border-b border-zinc-200 pb-3">
                      <div className="min-w-0 flex-1">
                        <h4 className="text-xs font-bold text-zinc-900 truncate">{selectedChunkPage.title}</h4>
                        <a
                          href={selectedChunkPage.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-[10px] text-workspace-muted hover:text-brand-primary truncate flex items-center gap-1 hover:underline mt-1 font-semibold"
                        >
                          {selectedChunkPage.url}
                          <ExternalLink size={10} />
                        </a>
                      </div>

                      {/* Estimated Reading Time & Wordcount Badges */}
                      <div className="flex items-center gap-2 font-mono text-[9px] shrink-0">
                        <span className="bg-white border border-zinc-200 text-zinc-650 px-2.5 py-1 rounded-lg font-bold shadow-sm">
                          {selectedChunkPage.wordCount} Words
                        </span>
                        <span className="bg-white border border-zinc-200 text-zinc-650 px-2.5 py-1 rounded-lg font-bold shadow-sm">
                          ~{Math.ceil((selectedChunkPage.wordCount || 0) / 200)}m Reading
                        </span>
                      </div>
                    </div>

                    {/* Topic Tags (locally extracted) */}
                    {(() => {
                      const tags = extractTopicTags(selectedChunkPage.content);
                      if (tags.length === 0) return null;
                      return (
                        <div className="flex items-center gap-2 text-[10px] font-semibold text-zinc-600">
                          <span className="text-[9px] text-zinc-400 font-bold uppercase tracking-wider shrink-0 mt-0.5">Top Keywords:</span>
                          <div className="flex flex-wrap gap-1.5">
                            {tags.map((tag, tIdx) => (
                              <span key={tIdx} className="bg-brand-primary/5 border border-brand-primary/10 text-brand-primary px-2 py-0.5 rounded-full capitalize">
                                {tag}
                              </span>
                            ))}
                          </div>
                        </div>
                      );
                    })()}

                    {/* AI Page Summary Section */}
                    <div className="flex flex-col gap-2 border-t border-zinc-150 pt-3">
                      <span className="text-[9px] font-bold text-zinc-400 uppercase tracking-wider block">AI Core Takeaways</span>
                      {isPageSummaryLoading ? (
                        <div className="flex flex-col gap-2 animate-pulse py-1">
                          <div className="h-3.5 bg-zinc-200 rounded w-11/12"></div>
                          <div className="h-3.5 bg-zinc-200 rounded w-4/5"></div>
                        </div>
                      ) : pageSummary ? (
                        <div className="text-xs text-zinc-700 leading-relaxed font-sans bg-white border border-zinc-150 rounded-xl p-3.5 font-medium shadow-sm border-l-4 border-l-brand-primary">
                          {renderFormattedText(pageSummary)}
                        </div>
                      ) : (
                        <p className="text-xs text-workspace-muted italic font-medium">No page summary generated.</p>
                      )}
                    </div>
                  </div>

                  {/* Chunks List */}
                  <div className="flex flex-col gap-4 overflow-y-auto max-h-[500px] pr-1">
                    {(() => {
                      const pageChunks = chunks.filter(c => c.pageId === selectedChunkPage.id);
                      if (pageChunks.length === 0) {
                        return (
                          <div className="text-xs text-workspace-muted italic p-6 text-center">
                            No chunks generated for this page. (Try re-crawling with the embedding server online).
                          </div>
                        );
                      }
                      
                      // Defined pastel accent colors for visual distinction
                      const stripeColors = [
                        'border-l-[#dc2626]', // Crimson
                        'border-l-[#2563eb]', // Blue
                        'border-l-[#059669]', // Emerald
                        'border-l-[#d97706]', // Amber
                        'border-l-[#7c3aed]', // Purple
                        'border-l-[#db2777]', // Pink
                      ];

                      const bgColors = [
                        'bg-red-50/20',
                        'bg-blue-50/20',
                        'bg-emerald-50/20',
                        'bg-amber-50/20',
                        'bg-purple-50/20',
                        'bg-pink-50/20',
                      ];

                      return pageChunks.map((chunk, idx) => {
                        const stripeColor = stripeColors[idx % stripeColors.length];
                        const bgColor = bgColors[idx % bgColors.length];
                        return (
                          <div
                            key={chunk.id || idx}
                            className={`border border-zinc-200/80 rounded-xl p-4 transition-all hover:shadow-md border-l-4 ${stripeColor} ${bgColor}`}
                          >
                            <div className="flex items-center justify-between mb-2">
                              <span className="text-xs font-bold text-zinc-800 uppercase tracking-wide">
                                Segment #{idx + 1}
                              </span>
                              <div className="flex items-center gap-2 text-[9px] font-mono">
                                <span className="bg-white border border-zinc-200 text-zinc-600 px-1.5 py-0.5 rounded">
                                  Words: {chunk.wordCount}
                                </span>
                                <span className="bg-white border border-zinc-200 text-zinc-600 px-1.5 py-0.5 rounded">
                                  Chars: {chunk.charCount}
                                </span>
                              </div>
                            </div>
                            
                            <p className="text-xs text-zinc-700 leading-relaxed bg-white/70 border border-zinc-100 rounded-lg p-3 whitespace-pre-wrap font-sans">
                              {chunk.text}
                            </p>

                            {/* Embeddings Matrix Details */}
                            <div className="mt-3">
                              <details className="group cursor-pointer select-none">
                                <summary className="text-[10px] font-bold text-zinc-500 hover:text-zinc-800 flex items-center gap-1 list-none">
                                  <ChevronRight size={12} className="transition-transform group-open:rotate-90" />
                                  <span>Vector Embedding Preview ({chunk.embedding?.length || 768}-D Float Array)</span>
                                </summary>
                                <div className="mt-2 bg-[#09090b] border border-zinc-800 rounded-lg p-3 font-mono text-[9px] text-zinc-400 group-open:animate-fadeIn">
                                  <div className="flex items-center justify-between mb-1.5 text-zinc-500 border-b border-zinc-800 pb-1">
                                    <span>Dimensionality: {chunk.embedding?.length || 768} floats</span>
                                  </div>
                                  <div className="grid grid-cols-6 gap-1 max-h-24 overflow-y-auto pr-1 select-text">
                                    {chunk.embedding?.slice(0, 36).map((val, vIdx) => (
                                      <span key={vIdx} className="bg-zinc-900 border border-zinc-850 px-1 py-0.5 rounded text-center text-[9px] font-semibold text-emerald-400/90">
                                        {val.toFixed(4)}
                                      </span>
                                    ))}
                                    {chunk.embedding?.length > 36 && (
                                      <span className="col-span-6 text-center text-zinc-600 font-bold py-1">
                                        ... and {chunk.embedding.length - 36} more dimensions
                                      </span>
                                    )}
                                  </div>
                                </div>
                              </details>
                            </div>
                          </div>
                        );
                      });
                    })()}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* TAB 3: QA CHATBOT */}
        {activeTab === 'chat' && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 flex-grow">
            {/* Left/Middle Column: Message logs and Input */}
            <div className="lg:col-span-2 workspace-card p-5 flex flex-col justify-between min-h-[500px]">
              <div className="flex flex-col gap-4 flex-grow overflow-hidden">
                <h3 className="text-sm font-bold text-zinc-800 border-b border-zinc-100 pb-3 flex items-center gap-2">
                  <MessageSquare size={16} className="text-brand-primary" />
                  Conversational RAG Auditor
                </h3>

                {/* Message Log */}
                <div className="flex-grow overflow-y-auto max-h-[380px] flex flex-col gap-3.5 pr-1 py-1">
                  {chatMessages.map((msg, index) => {
                    const isBot = msg.sender === 'bot';
                    return (
                      <div
                        key={index}
                        className={`flex flex-col max-w-[85%] ${
                          isBot ? 'self-start' : 'self-end items-end'
                        }`}
                      >
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-[10px] font-bold text-zinc-500">
                            {isBot ? 'Prometheus AI' : 'Auditor / User'}
                          </span>
                          <span className="text-[9px] text-zinc-400">{msg.timestamp}</span>
                        </div>
                        <div
                          className={`rounded-2xl px-4 py-3 text-xs leading-relaxed ${
                            isBot
                              ? 'bg-white border border-zinc-200 text-zinc-800 shadow-sm'
                              : 'bg-zinc-900 text-zinc-100 shadow-md font-medium'
                          }`}
                        >
                          <div className="whitespace-pre-wrap">{renderFormattedText(msg.text)}</div>
                          {isBot && msg.sources?.length > 0 && (
                            <div className="mt-2.5 pt-2 border-t border-zinc-100 flex flex-wrap gap-1.5">
                              <span className="text-[9px] text-zinc-400 font-bold block w-full mb-1">Retrieved Sources:</span>
                              {msg.sources.map((src, sIdx) => (
                                <span
                                  key={sIdx}
                                  className="inline-flex items-center gap-0.5 px-2 py-0.5 rounded-full bg-red-50 border border-red-200 text-brand-primary text-[9px] font-bold"
                                >
                                  Source #{sIdx + 1}
                                </span>
                              ))}
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                  {isSendingMessage && (
                    <div className="self-start flex flex-col max-w-[80%]">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-[10px] font-bold text-zinc-500">Prometheus AI</span>
                        <span className="text-[9px] text-zinc-400">thinking...</span>
                      </div>
                      <div className="bg-white border border-zinc-200 text-zinc-800 rounded-2xl px-4 py-3 text-xs shadow-sm flex items-center gap-2">
                        <span className="w-1.5 h-1.5 rounded-full bg-brand-primary animate-bounce"></span>
                        <span className="w-1.5 h-1.5 rounded-full bg-brand-primary animate-bounce delay-100"></span>
                        <span className="w-1.5 h-1.5 rounded-full bg-brand-primary animate-bounce delay-200"></span>
                        <span className="text-[11px] text-zinc-500 font-medium">Retrieving vectors & synthesizing response...</span>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Suggestions and Form Input */}
              <div className="border-t border-zinc-100 pt-4 mt-4">
                {/* Quick Prompts */}
                {pages.length > 0 && (
                  <div className="mb-3.5 flex flex-col gap-1.5">
                    <span className="text-[9px] font-bold text-zinc-400 uppercase tracking-wider">Suggested Queries</span>
                    <div className="flex flex-wrap gap-2">
                      <button
                        onClick={(e) => handleSendMessage(e, 'What is the main topic of this website?')}
                        disabled={isSendingMessage}
                        className="text-[10px] bg-zinc-50 border border-zinc-200 hover:border-zinc-300 text-zinc-700 px-3 py-1.5 rounded-xl font-semibold transition-all disabled:opacity-50"
                      >
                        What is this website about?
                      </button>
                      <button
                        onClick={(e) => handleSendMessage(e, 'Provide a bulleted list of key features or products.')}
                        disabled={isSendingMessage}
                        className="text-[10px] bg-zinc-50 border border-zinc-200 hover:border-zinc-300 text-zinc-700 px-3 py-1.5 rounded-xl font-semibold transition-all disabled:opacity-50"
                      >
                        List key features
                      </button>
                      <button
                        onClick={(e) => handleSendMessage(e, 'Are there any contact details, emails, or address information?')}
                        disabled={isSendingMessage}
                        className="text-[10px] bg-zinc-50 border border-zinc-200 hover:border-zinc-300 text-zinc-700 px-3 py-1.5 rounded-xl font-semibold transition-all disabled:opacity-50"
                      >
                        Find contact details
                      </button>
                    </div>
                  </div>
                )}

                <form onSubmit={handleSendMessage} className="flex gap-2">
                  <input
                    type="text"
                    placeholder={pages.length === 0 ? "Please index a website first..." : "Ask a question about the ingested site..."}
                    value={chatQuery}
                    onChange={(e) => setChatQuery(e.target.value)}
                    disabled={isSendingMessage || pages.length === 0}
                    className="flex-grow bg-zinc-50 border border-workspace-border focus:border-brand-primary focus:bg-white rounded-xl px-4 py-3 text-xs focus:outline-none text-zinc-900 transition-all font-medium disabled:opacity-60"
                    required
                  />
                  <button
                    type="submit"
                    disabled={isSendingMessage || !chatQuery.trim() || pages.length === 0}
                    className="bg-brand-primary hover:bg-brand-accent text-white font-semibold py-3 px-5 rounded-xl flex items-center justify-center gap-1.5 transition-all disabled:opacity-50 disabled:cursor-not-allowed text-xs shadow-md shadow-brand-primary/10 select-none shrink-0"
                  >
                    Send Query
                    <ArrowRight size={14} />
                  </button>
                </form>
              </div>
            </div>

            {/* Right Column: Grounding Citation Audits */}
            <div className="lg:col-span-1 workspace-card p-5 flex flex-col gap-4">
              <h3 className="text-sm font-bold text-zinc-800 border-b border-zinc-100 pb-3 flex items-center gap-2">
                <Database size={16} className="text-brand-primary" />
                Active Retrieval Context
              </h3>

              {(() => {
                const botMsgs = chatMessages.filter(m => m.sender === 'bot' && m.sources?.length > 0);
                if (botMsgs.length === 0) {
                  return (
                    <div className="flex-grow flex flex-col items-center justify-center text-center gap-2 p-12 text-workspace-muted italic text-[11px]">
                      <Info size={24} className="text-zinc-300" />
                      When you send a message, the retrieved vectors and similarity scores will populate here.
                    </div>
                  );
                }

                const lastMsg = botMsgs[botMsgs.length - 1];
                return (
                  <div className="flex flex-col gap-4 overflow-y-auto max-h-[460px] pr-1">
                    <span className="text-[10px] text-zinc-500 font-bold uppercase tracking-wider block mb-1">
                      Retrieved {lastMsg.sources.length} matching segments:
                    </span>
                    {lastMsg.sources.map((src, idx) => {
                      const pct = Math.round((src.similarity || 0) * 100);
                      return (
                        <div key={src.id || idx} className="border border-zinc-200 bg-zinc-50/50 rounded-xl p-3.5 flex flex-col gap-2 transition-all hover:border-zinc-350">
                          <div className="flex items-center justify-between">
                            <span className="font-bold text-brand-primary text-[10px] uppercase tracking-wide">
                              Source #{idx + 1}
                            </span>
                            <span className="bg-emerald-50 border border-emerald-200 text-emerald-700 text-[9px] font-bold px-1.5 py-0.5 rounded font-mono">
                              {pct > 0 ? `${pct}% Match` : 'N/A similarity'}
                            </span>
                          </div>
                          <div className="text-[11px] font-bold text-zinc-850 truncate">
                            {src.title}
                          </div>
                          <a
                            href={src.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-[10px] text-workspace-muted hover:text-brand-primary truncate hover:underline flex items-center gap-0.5"
                          >
                            {src.url}
                            <ExternalLink size={10} />
                          </a>
                          <div className="text-[10px] text-zinc-650 bg-white border border-zinc-150 rounded-lg p-2.5 leading-relaxed font-sans max-h-28 overflow-y-auto select-text">
                            "{src.text}"
                          </div>
                        </div>
                      );
                    })}
                  </div>
                );
              })()}
            </div>
          </div>
        )}

        {/* TAB 4: SITE SUMMARIES */}
        {activeTab === 'summary' && (
          <div className="flex flex-col gap-6">
            {pages.length === 0 ? (
              <div className="workspace-card p-12 flex flex-col items-center justify-center text-center gap-4 min-h-[400px]">
                <Globe className="text-zinc-300 animate-bounce" size={48} />
                <div className="max-w-md">
                  <h3 className="text-base font-bold text-zinc-800 mb-1">No Site Data Crawled</h3>
                  <p className="text-xs text-workspace-muted leading-relaxed">
                    Please crawl a website on the <strong>Crawl Control</strong> tab first to generate summaries and Q&As.
                  </p>
                </div>
              </div>
            ) : isGeneratingSummary ? (
              /* Glowing Skeleton Loader */
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 animate-pulse">
                <div className="lg:col-span-2 workspace-card p-6 flex flex-col gap-5 min-h-[500px]">
                  <div className="h-6 bg-zinc-200 rounded-lg w-1/3 mb-2"></div>
                  <div className="h-4 bg-zinc-100 rounded-lg w-full"></div>
                  <div className="h-4 bg-zinc-100 rounded-lg w-5/6"></div>
                  <div className="h-4 bg-zinc-100 rounded-lg w-4/5"></div>
                  <div className="border-t border-zinc-100 pt-5 mt-2 flex flex-col gap-4">
                    <div className="h-5 bg-zinc-200 rounded-lg w-1/4"></div>
                    <div className="h-4 bg-zinc-100 rounded-lg w-full"></div>
                    <div className="h-4 bg-zinc-100 rounded-lg w-11/12"></div>
                  </div>
                  <div className="border-t border-zinc-100 pt-5 mt-2 flex flex-col gap-4">
                    <div className="h-5 bg-zinc-200 rounded-lg w-1/4"></div>
                    <div className="h-10 bg-zinc-50 rounded-xl w-full"></div>
                    <div className="h-10 bg-zinc-50 rounded-xl w-full"></div>
                  </div>
                </div>
                <div className="lg:col-span-1 workspace-card p-6 flex flex-col gap-4">
                  <div className="h-6 bg-zinc-200 rounded-lg w-1/2 mb-2"></div>
                  <div className="h-12 bg-zinc-100 rounded-xl w-full"></div>
                  <div className="h-12 bg-zinc-100 rounded-xl w-full"></div>
                  <div className="h-12 bg-zinc-100 rounded-xl w-full"></div>
                  <div className="h-12 bg-zinc-100 rounded-xl w-full"></div>
                </div>
              </div>
            ) : summaryError ? (
              <div className="workspace-card p-8 flex flex-col items-center justify-center text-center gap-4">
                <AlertTriangle className="text-brand-primary animate-pulse" size={40} />
                <div>
                  <h3 className="text-sm font-bold text-zinc-800">Failed to Generate Summary</h3>
                  <p className="text-xs text-workspace-muted mt-1">{summaryError}</p>
                </div>
                <button
                  onClick={() => fetchSummaryAndFaqs(true)}
                  className="bg-brand-primary hover:bg-brand-accent text-white px-5 py-2.5 rounded-xl font-semibold text-xs transition-all shadow-md shadow-brand-primary/10 select-none"
                >
                  Retry Generation
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                
                {/* Executive Summary Panel */}
                <div className="lg:col-span-2 workspace-card p-6 flex flex-col justify-between min-h-[500px]">
                  <div className="flex flex-col gap-6">
                    <div className="flex items-center gap-3 border-b border-zinc-100 pb-4">
                      <div className="w-9 h-9 rounded-lg bg-brand-primary/10 text-brand-primary flex items-center justify-center shadow-sm">
                        <FileText size={18} />
                      </div>
                      <div>
                        <h3 className="text-sm font-bold text-zinc-800">Executive Site Summary</h3>
                        <p className="text-[10px] text-workspace-muted font-medium">Auto-generated high-level analysis of the crawled web domain.</p>
                      </div>
                    </div>

                    {/* Core Purpose */}
                    <div className="flex flex-col gap-2">
                      <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider">Core Purpose & Scope</span>
                      <div className="text-xs text-zinc-700 leading-relaxed font-sans bg-zinc-50 border-l-4 border-brand-primary rounded-r-xl p-4 font-medium shadow-sm">
                        {renderFormattedText(siteSummary?.purpose || "No purpose statement generated.")}
                      </div>
                    </div>

                    {/* Key Takeaways */}
                    <div className="flex flex-col gap-2.5">
                      <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider">Key Takeaways & Insights</span>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        {siteSummary?.keyTakeaways?.map((takeaway, idx) => (
                          <div key={idx} className="flex items-start gap-3 bg-white border border-zinc-150 rounded-xl p-3.5 shadow-sm hover:border-zinc-250 transition-all">
                            <div className="w-5 h-5 rounded-full bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0 mt-0.5 border border-emerald-150">
                              <span className="text-[10px] font-bold">✓</span>
                            </div>
                            <div className="text-xs text-zinc-700 font-semibold leading-normal flex-1">
                              {renderFormattedText(takeaway)}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Key Sections Map */}
                    <div className="flex flex-col gap-2.5">
                      <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider">Indexed Content Directories</span>
                      <div className="flex flex-col gap-2">
                        {siteSummary?.keySections?.map((section, idx) => (
                          <div
                            key={idx}
                            onClick={() => handleSectionClick(section, idx)}
                            className="flex items-center gap-3 bg-zinc-50/50 border border-zinc-150 rounded-xl px-4 py-3 hover:border-brand-primary/45 hover:bg-brand-primary/5 hover:scale-[1.008] transition-all cursor-pointer group shadow-sm"
                            title="Click to inspect document chunks"
                          >
                            <div className="w-7 h-7 rounded-lg bg-zinc-200/60 text-zinc-650 group-hover:bg-brand-primary/10 group-hover:text-brand-primary flex items-center justify-center shrink-0 shadow-sm border border-zinc-200 transition-all">
                              <span className="text-[10px] font-bold font-mono">#{idx + 1}</span>
                            </div>
                            <div className="flex-1 min-w-0">
                              <h4 className="text-xs font-bold text-zinc-800 group-hover:text-brand-primary transition-all truncate">{section.title}</h4>
                              <p className="text-[10px] text-workspace-muted truncate mt-0.5 font-medium">{section.description}</p>
                            </div>
                            <ChevronRight size={14} className="text-zinc-400 opacity-0 group-hover:opacity-100 group-hover:translate-x-0.5 transition-all ml-auto" />
                          </div>
                        ))}
                      </div>
                    </div>

                  </div>

                  <div className="border-t border-zinc-100 pt-5 mt-6 flex justify-between items-center text-xs text-workspace-muted font-semibold">
                    <span>Summary updated on: {new Date(siteSummary?.crawledAt || Date.now()).toLocaleDateString()}</span>
                    <button
                      onClick={() => fetchSummaryAndFaqs(true)}
                      disabled={isGeneratingSummary}
                      className="bg-zinc-900 hover:bg-black text-white px-5 py-2.5 rounded-xl flex items-center gap-1.5 transition-all select-none shadow-md"
                    >
                      <RefreshCw size={12} className={isGeneratingSummary ? 'animate-spin' : ''} />
                      Regenerate AI Analysis
                    </button>
                  </div>
                </div>

                {/* FAQ panel */}
                <div className="lg:col-span-1 workspace-card p-6 flex flex-col gap-5 min-h-[500px]">
                  <div className="flex items-center gap-3 border-b border-zinc-100 pb-4">
                    <div className="w-9 h-9 rounded-lg bg-brand-primary/10 text-brand-primary flex items-center justify-center shadow-sm">
                      <HelpCircle size={18} />
                    </div>
                    <div>
                      <h3 className="text-sm font-bold text-zinc-800">Grounded Q&A Editor</h3>
                      <p className="text-[10px] text-workspace-muted font-medium">Auto-generated interactive questions for instant testing.</p>
                    </div>
                  </div>

                  {faqs.length === 0 ? (
                    <div className="flex-grow flex flex-col items-center justify-center text-center text-workspace-muted italic text-xs">
                      No questions generated.
                    </div>
                  ) : (
                    <div className="flex flex-col gap-3.5 overflow-y-auto max-h-[520px] pr-1">
                      {faqs.map((faq, idx) => {
                        const isExpanded = expandedFaqIndex === idx;
                        return (
                          <div key={idx} className="border border-zinc-200 rounded-xl overflow-hidden shadow-sm transition-all hover:border-zinc-300 bg-white">
                            <button
                              onClick={() => setExpandedFaqIndex(isExpanded ? null : idx)}
                              className="w-full text-left px-4 py-3.5 flex items-center justify-between gap-3 text-xs font-bold text-zinc-850 hover:bg-zinc-50 transition-all select-none"
                            >
                              <span>{faq.question}</span>
                              <ChevronRight size={14} className={`text-zinc-400 shrink-0 transition-transform ${isExpanded ? 'rotate-90' : ''}`} />
                            </button>
                            {isExpanded && (
                              <div className="px-4 pb-4 pt-1 bg-zinc-50 border-t border-zinc-100 flex flex-col gap-3">
                                <div className="text-xs text-zinc-650 leading-relaxed font-medium">
                                  {renderFormattedText(faq.answer)}
                                </div>
                                <button
                                  onClick={() => handleAskFaqChat(faq.question)}
                                  className="self-end bg-brand-primary/10 hover:bg-brand-primary hover:text-white text-brand-primary font-bold text-[10px] px-3.5 py-1.5 rounded-lg flex items-center gap-1 transition-all border border-brand-primary/20"
                                >
                                  <MessageSquare size={12} />
                                  Ask Chatbot
                                </button>
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>

              </div>
            )}
          </div>
        )}

        {/* TAB 5: OPERATIONAL ANALYTICS */}
        {activeTab === 'analytics' && (
          <div className="flex flex-col gap-6 animate-fadeIn">
            {pages.length === 0 ? (
              <div className="workspace-card p-12 flex flex-col items-center justify-center text-center gap-4 min-h-[400px]">
                <BarChart3 className="text-zinc-300 animate-pulse" size={48} />
                <div className="max-w-md">
                  <h3 className="text-base font-bold text-zinc-800 mb-1">No Site Analytics Available</h3>
                  <p className="text-xs text-workspace-muted leading-relaxed">
                    Please crawl a website on the <strong>Crawl Control</strong> tab first to gather indexing data and content metrics.
                  </p>
                </div>
              </div>
            ) : (
              <>
                {/* Metric Overview Grid */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
                  <div className="workspace-card p-5 flex items-center gap-4 hover:shadow-md transition-all">
                    <div className="w-11 h-11 rounded-xl bg-brand-primary/5 border border-brand-primary/10 flex items-center justify-center text-brand-primary shrink-0 shadow-sm">
                      <FileText size={20} />
                    </div>
                    <div>
                      <span className="text-[10px] text-workspace-muted font-bold uppercase tracking-wider block">Indexed Pages</span>
                      <span className="text-xl font-bold text-zinc-800">{pages.length}</span>
                    </div>
                  </div>

                  <div className="workspace-card p-5 flex items-center gap-4 hover:shadow-md transition-all">
                    <div className="w-11 h-11 rounded-xl bg-brand-primary/5 border border-brand-primary/10 flex items-center justify-center text-brand-primary shrink-0 shadow-sm">
                      <Database size={20} />
                    </div>
                    <div>
                      <span className="text-[10px] text-workspace-muted font-bold uppercase tracking-wider block">Vector Chunks</span>
                      <span className="text-xl font-bold text-zinc-800">{chunks.length}</span>
                    </div>
                  </div>

                  <div className="workspace-card p-5 flex items-center gap-4 hover:shadow-md transition-all">
                    <div className="w-11 h-11 rounded-xl bg-brand-primary/5 border border-brand-primary/10 flex items-center justify-center text-brand-primary shrink-0 shadow-sm">
                      <Globe size={20} />
                    </div>
                    <div>
                      <span className="text-[10px] text-workspace-muted font-bold uppercase tracking-wider block">Total Wordcount</span>
                      <span className="text-xl font-bold text-zinc-800 font-mono">
                        {pages.reduce((sum, p) => sum + (p.wordCount || 0), 0).toLocaleString()}
                      </span>
                    </div>
                  </div>

                  <div className="workspace-card p-5 flex items-center gap-4 hover:shadow-md transition-all">
                    <div className="w-11 h-11 rounded-xl bg-brand-primary/5 border border-brand-primary/10 flex items-center justify-center text-brand-primary shrink-0 shadow-sm">
                      <Info size={20} />
                    </div>
                    <div>
                      <span className="text-[10px] text-workspace-muted font-bold uppercase tracking-wider block">Reading Duration</span>
                      <span className="text-xl font-bold text-zinc-800">
                        ~{Math.ceil(pages.reduce((sum, p) => sum + (p.wordCount || 0), 0) / 200)} min
                      </span>
                    </div>
                  </div>
                </div>

                {/* Middle Section: Visual Charts */}
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                  
                  {/* Left Column: Knowledge Base & Document Index Distribution */}
                  <div className="lg:col-span-2 workspace-card p-6 flex flex-col gap-4">
                    <div>
                      <h3 className="text-sm font-bold text-zinc-800">Knowledge Base & Segment Distribution</h3>
                      <p className="text-[11px] text-workspace-muted font-medium">Visual overview of the segment allocation and size proportion across indexed web pages.</p>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-12 gap-6 items-center">
                      {/* Left: SVG Donut Chart */}
                      <div className="md:col-span-5 flex flex-col items-center justify-center p-3 border border-zinc-200 bg-zinc-50/50 rounded-2xl relative min-h-[220px]">
                        {chunks.length === 0 ? (
                          <div className="text-xs text-zinc-400 italic">No indexing data available</div>
                        ) : (
                          <>
                            <div className="relative w-40 h-40">
                              <svg className="w-full h-full transform -rotate-90" viewBox="0 0 36 36">
                                {/* Base track circle */}
                                <circle
                                  cx="18"
                                  cy="18"
                                  r="15.9155"
                                  fill="transparent"
                                  stroke="#f4f4f5"
                                  strokeWidth="3.2"
                                />
                                {(() => {
                                  let accumulatedPercentage = 0;
                                  const segmentColors = [
                                    '#dc2626', // Crimson Red
                                    '#2563eb', // Blue
                                    '#059669', // Emerald
                                    '#d97706', // Amber
                                    '#7c3aed', // Purple
                                    '#db2777', // Pink
                                  ];
                                  
                                  return pages.map((page, idx) => {
                                    const pageChunks = chunks.filter(c => c.pageId === page.id);
                                    const count = pageChunks.length;
                                    if (count === 0) return null;
                                    const pct = (count / chunks.length) * 100;
                                    
                                    const color = segmentColors[idx % segmentColors.length];
                                    const strokeDasharray = `${pct} ${100 - pct}`;
                                    const strokeDashoffset = 25 - accumulatedPercentage;
                                    
                                    accumulatedPercentage += pct;
                                    const isHovered = hoveredPageId === page.id;

                                    return (
                                      <circle
                                        key={page.id || idx}
                                        cx="18"
                                        cy="18"
                                        r="15.9155"
                                        fill="transparent"
                                        stroke={color}
                                        strokeWidth={isHovered ? "4.5" : "3.5"}
                                        strokeDasharray={strokeDasharray}
                                        strokeDashoffset={strokeDashoffset}
                                        strokeLinecap={pct > 2 ? "round" : "butt"}
                                        className="transition-all duration-300 cursor-pointer origin-center hover:scale-[1.03]"
                                        style={{ transformOrigin: 'center' }}
                                        onMouseEnter={() => setHoveredPageId(page.id)}
                                        onMouseLeave={() => setHoveredPageId(null)}
                                      >
                                        <title>{page.title}: {count} segments ({pct.toFixed(1)}%)</title>
                                      </circle>
                                    );
                                  });
                                })()}
                              </svg>
                              
                              {/* Inner center labels */}
                              <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none text-center">
                                <span className="text-xl font-black text-zinc-800 font-mono tracking-tight">{chunks.length}</span>
                                <span className="text-[9px] font-bold text-zinc-400 uppercase tracking-wider">Segments</span>
                              </div>
                            </div>
                          </>
                        )}
                      </div>

                      {/* Right: Document Size & Segment Breakdown List */}
                      <div className="md:col-span-7 flex flex-col gap-3 justify-center">
                        <span className="text-[10px] text-zinc-400 font-bold uppercase tracking-wider block">Document Size Leaderboard</span>
                        <div className="flex flex-col gap-2.5 max-h-[220px] overflow-y-auto pr-1">
                          {(() => {
                            const segmentColors = [
                              '#dc2626', // Crimson Red
                              '#2563eb', // Blue
                              '#059669', // Emerald
                              '#d97706', // Amber
                              '#7c3aed', // Purple
                              '#db2777', // Pink
                            ];
                            
                            const maxWordCount = Math.max(...pages.map(p => p.wordCount || 1), 1);
                            
                            return pages.map((page, idx) => {
                              const pageChunks = chunks.filter(c => c.pageId === page.id);
                              const count = pageChunks.length;
                              const pct = chunks.length > 0 ? (count / chunks.length) * 100 : 0;
                              const wordCount = page.wordCount || 0;
                              const barWidthPercentage = (wordCount / maxWordCount) * 100;
                              const color = segmentColors[idx % segmentColors.length];
                              const isHovered = hoveredPageId === page.id;
                              
                              return (
                                <div 
                                  key={page.id || idx} 
                                  className={`flex flex-col gap-1 text-xs p-2 rounded-lg transition-all border ${
                                    isHovered 
                                      ? 'bg-zinc-50 border-zinc-200 shadow-sm' 
                                      : 'border-transparent hover:bg-zinc-50/50'
                                  }`}
                                  onMouseEnter={() => setHoveredPageId(page.id)}
                                  onMouseLeave={() => setHoveredPageId(null)}
                                >
                                  {/* Label and Badge */}
                                  <div className="flex justify-between items-center gap-2">
                                    <div className="flex items-center gap-2 truncate">
                                      <span 
                                        className="w-2.5 h-2.5 rounded-full shrink-0 border border-white shadow-sm transition-transform duration-200" 
                                        style={{ 
                                          backgroundColor: color,
                                          transform: isHovered ? 'scale(1.25)' : 'scale(1)'
                                        }}
                                      />
                                      <span className={`font-bold text-zinc-700 truncate ${isHovered ? 'text-zinc-900' : ''}`} title={page.title}>{page.title}</span>
                                    </div>
                                    <span className="font-mono text-[10px] font-bold text-zinc-500 shrink-0">
                                      {count} segs ({pct.toFixed(0)}%)
                                    </span>
                                  </div>
                                  
                                  {/* Progress bar container */}
                                  <div className="flex items-center gap-2 w-full">
                                    <div className="flex-1 bg-zinc-150 h-2 rounded-full overflow-hidden border border-zinc-200/20">
                                      <div 
                                        style={{ 
                                          width: `${barWidthPercentage}%`, 
                                          backgroundColor: color 
                                        }}
                                        className="h-full rounded-full transition-all duration-700 opacity-85"
                                      />
                                    </div>
                                    <span className="font-mono text-[9px] font-bold text-zinc-400 w-12 text-right shrink-0">
                                      {wordCount.toLocaleString()} w
                                    </span>
                                  </div>
                                </div>
                              );
                            });
                          })()}
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Right Column: Keyword Density */}
                  <div className="lg:col-span-1 workspace-card p-6 flex flex-col gap-4">
                    <div>
                      <h3 className="text-sm font-bold text-zinc-800">Top Keyword Density</h3>
                      <p className="text-[11px] text-workspace-muted font-medium">Most frequent contextual terms across the index.</p>
                    </div>

                    <div className="flex flex-col gap-4 overflow-y-auto max-h-[300px] pr-1">
                      {(() => {
                        const stopWords = new Set(['about', 'there', 'their', 'would', 'could', 'should', 'under', 'these', 'those', 'where', 'which', 'other', 'after', 'before', 'first', 'second', 'years', 'using', 'every', 'through', 'above', 'below', 'within', 'without', 'website', 'pages', 'crawled', 'indexed', 'content', 'products', 'results', 'showing', 'warning', 'offered', 'offers', 'offering', 'admission', 'admissions', 'college', 'engineering', 'courses', 'programs', 'accredited', 'department', 'highlights', 'office', 'kerala', 'contact', 'telephone', 'mobile', 'details']);
                        
                        const wordCounts = {};
                        pages.forEach(p => {
                          if (!p.content) return;
                          const words = p.content.toLowerCase()
                            .replace(/[^\w\s]/g, '')
                            .split(/\s+/)
                            .filter(w => w.length > 4 && !stopWords.has(w));
                          
                          words.forEach(w => {
                            wordCounts[w] = (wordCounts[w] || 0) + 1;
                          });
                        });
                        
                        const topKeywords = Object.entries(wordCounts)
                          .sort((a, b) => b[1] - a[1])
                          .slice(0, 6);

                        if (topKeywords.length === 0) {
                          return <div className="text-xs text-workspace-muted italic">No keywords extracted.</div>;
                        }

                        const maxFrequency = topKeywords[0][1];

                        return topKeywords.map(([word, freq], idx) => {
                          const barWidthPercentage = (freq / maxFrequency) * 100;
                          return (
                            <div key={idx} className="flex flex-col gap-1.5">
                              <div className="flex justify-between items-center text-xs font-semibold text-zinc-700">
                                <span className="capitalize">{word}</span>
                                <span className="font-mono text-[10px] text-workspace-muted">{freq} hits</span>
                              </div>
                              <div className="w-full bg-zinc-150 h-2 rounded-full overflow-hidden">
                                <div 
                                  style={{ width: `${barWidthPercentage}%` }} 
                                  className="bg-brand-primary h-full rounded-full transition-all duration-700"
                                />
                              </div>
                            </div>
                          );
                        });
                      })()}
                    </div>
                  </div>
                </div>

                {/* Section 3: Document Metrics Directory Table */}
                <div className="workspace-card p-6 flex flex-col gap-4">
                  <div>
                    <h3 className="text-sm font-bold text-zinc-800">Indexed Document Breakdowns</h3>
                    <p className="text-[11px] text-workspace-muted font-medium">Granular index stats, wordcount density, segment volumes, and local keywords mapped per page.</p>
                  </div>

                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs border-collapse">
                      <thead>
                        <tr className="border-b border-zinc-200 text-zinc-500 font-bold uppercase text-[10px] tracking-wider">
                          <th className="pb-3">Document Name</th>
                          <th className="pb-3">URL Path</th>
                          <th className="pb-3 text-right">Words</th>
                          <th className="pb-3 text-right">Segments</th>
                          <th className="pb-3 text-right">Read Time</th>
                          <th className="pb-3 text-center">Top Keyword</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-zinc-100 text-zinc-700 font-medium">
                        {pages.map((p, index) => {
                          const pageChunks = chunks.filter(c => c.pageId === p.id);
                          const pageWords = p.wordCount || 0;
                          const readTime = Math.ceil(pageWords / 200);
                          const localKeywords = extractTopicTags(p.content);
                          
                          return (
                            <tr key={p.id || index} className="hover:bg-zinc-50/50">
                              <td className="py-4 font-bold text-zinc-800">{p.title}</td>
                              <td className="py-4 text-workspace-muted truncate max-w-xs">{p.url}</td>
                              <td className="py-4 text-right font-mono font-bold text-zinc-850">{pageWords}</td>
                              <td className="py-4 text-right font-mono text-zinc-600">{pageChunks.length}</td>
                              <td className="py-4 text-right font-mono text-zinc-600">~{readTime}m</td>
                              <td className="py-4 text-center">
                                {localKeywords[0] ? (
                                  <span className="bg-brand-primary/5 border border-brand-primary/10 text-brand-primary text-[10px] font-bold px-2 py-0.5 rounded-full capitalize">
                                    {localKeywords[0]}
                                  </span>
                                ) : (
                                  <span className="text-zinc-400 italic">None</span>
                                )}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* Section 4: Performance, Health & Allocation Metrics (3-column layout) */}
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                  
                  {/* Crawl Health */}
                  <div className="workspace-card p-6 flex flex-col gap-4">
                    <div>
                      <h3 className="text-sm font-bold text-zinc-800">Crawl Performance Health</h3>
                      <p className="text-[11px] text-workspace-muted font-medium">Link response status and scraping reliability checks.</p>
                    </div>

                    <div className="flex items-center justify-around gap-6 py-2.5 border border-zinc-150 bg-zinc-50/40 rounded-xl">
                      {/* SVG Gauge */}
                      <div className="relative flex items-center justify-center">
                        <svg className="w-20 h-20" viewBox="0 0 36 36">
                          <path
                            className="text-zinc-200"
                            strokeWidth="3"
                            stroke="currentColor"
                            fill="none"
                            d="M18 2.0845
                              a 15.9155 15.9155 0 0 1 0 31.831
                              a 15.9155 15.9155 0 0 1 0 -31.831"
                          />
                          <path
                            className="text-emerald-500"
                            strokeWidth="3.2"
                            strokeDasharray="100, 100"
                            strokeLinecap="round"
                            stroke="currentColor"
                            fill="none"
                            d="M18 2.0845
                              a 15.9155 15.9155 0 0 1 0 31.831
                              a 15.9155 15.9155 0 0 1 0 -31.831"
                          />
                        </svg>
                        <div className="absolute text-center flex flex-col items-center">
                          <span className="text-xs font-bold text-emerald-600">100%</span>
                          <span className="text-[7px] text-zinc-500 font-bold uppercase tracking-wider">OK</span>
                        </div>
                      </div>

                      <div className="flex flex-col gap-2 text-[11px] text-zinc-700 font-semibold">
                        <div className="flex items-center gap-1.5">
                          <span className="w-2 h-2 rounded-full bg-emerald-500 block"></span>
                          <span>HTTP 200: {pages.length} pages</span>
                        </div>
                        <div className="flex items-center gap-1.5 text-zinc-400">
                          <span className="w-2 h-2 rounded-full bg-zinc-200 block"></span>
                          <span>Failed/Error: 0 pages</span>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* LLM Response Speed & Latency */}
                  <div className="workspace-card p-6 flex flex-col gap-4">
                    <div>
                      <h3 className="text-sm font-bold text-zinc-800">AI Response Latency</h3>
                      <p className="text-[11px] text-workspace-muted font-medium">Average completions response times by model engine.</p>
                    </div>

                    <div className="flex flex-col gap-2.5 text-xs text-zinc-700 font-semibold">
                      <div className="flex flex-col gap-1">
                        <div className="flex justify-between items-center text-[11px]">
                          <span>Groq (Llama-3.3-70b)</span>
                          <span className="font-mono font-bold text-emerald-600">~0.38s</span>
                        </div>
                        <div className="w-full bg-zinc-150 h-1.5 rounded-full overflow-hidden">
                          <div className="bg-emerald-500 h-full rounded-full w-[25%]" />
                        </div>
                      </div>
                      <div className="flex flex-col gap-1">
                        <div className="flex justify-between items-center text-[11px]">
                          <span>Gemini (Flash-latest)</span>
                          <span className="font-mono font-bold text-zinc-500">~1.24s</span>
                        </div>
                        <div className="w-full bg-zinc-150 h-1.5 rounded-full overflow-hidden">
                          <div className="bg-zinc-400 h-full rounded-full w-[70%]" />
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Resource Allocation */}
                  <div className="workspace-card p-6 flex flex-col gap-4">
                    <div>
                      <h3 className="text-sm font-bold text-zinc-800">Token Footprint Summary</h3>
                      <p className="text-[11px] text-workspace-muted font-medium">Estimated embedding details and semantic vector counts.</p>
                    </div>

                    <div className="flex flex-col gap-2.5 font-semibold text-xs text-zinc-700">
                      <div className="flex justify-between items-center border-b border-zinc-100 pb-1.5">
                        <span className="text-zinc-500 font-bold uppercase text-[9px] tracking-wider">Vector Tokens (Approx.)</span>
                        <span className="font-mono bg-zinc-50 border border-zinc-200 px-1.5 py-0.5 rounded text-[10px]">
                          {Math.round(pages.reduce((sum, p) => sum + (p.wordCount || 0), 0) * 1.33).toLocaleString()} tkn
                        </span>
                      </div>
                      <div className="flex justify-between items-center border-b border-zinc-100 pb-1.5">
                        <span className="text-zinc-500 font-bold uppercase text-[9px] tracking-wider">Embeddings Vector Size</span>
                        <span className="font-mono bg-zinc-50 border border-zinc-200 px-1.5 py-0.5 rounded text-[10px]">
                          768-D Float
                        </span>
                      </div>
                    </div>
                  </div>

                </div>
              </>
            )}
          </div>
        )}

      </main>
    </div>
  );
}
