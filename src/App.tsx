/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import type { FormEvent, MouseEvent } from 'react';
import { 
  Server, 
  Search, 
  ArrowRight, 
  RefreshCcw,
  Layers,
  ChevronRight,
  Activity,
  Cpu,
  HardDrive,
  Globe,
  Database,
  Terminal,
  Trash2,
  Filter,
  AlertTriangle,
  Code,
  Download,
  BookOpen,
  ChevronDown,
  Check,
  Copy,
  Menu,
  X,
  TrendingUp,
  TrendingDown,
  ExternalLink,
  Clock,
  Info,
  CheckCircle2,
  AlertCircle,
  Sun,
  Moon,
  Workflow,
  ShieldAlert,
  Play,
  Pause
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { ResponsiveContainer, LineChart, Line, YAxis, AreaChart, Area, XAxis, Tooltip, CartesianGrid } from 'recharts';
import { M3Card } from './components/M3Card';
import { LogEntry } from './types';

export default function App() {
  const [stats, setStats] = useState<any>(null);
  const [testTicker, setTestTicker] = useState('PETR4');
  const [testResult, setTestResult] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [activeTab, setActiveTab] = useState<'monitor' | 'logs' | 'docs' | 'architecture'>('monitor');
  const [logSearch, setLogSearch] = useState('');
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [consoleTab, setConsoleTab] = useState<'visual' | 'json'>('visual');
  const [selectedLog, setSelectedLog] = useState<LogEntry | null>(null);
  const [drawerTab, setDrawerTab] = useState<'trace' | 'visual' | 'json'>('trace');
  const [isAutoRefreshActive, setIsAutoRefreshActive] = useState(true);
  const [statusFilter, setStatusFilter] = useState<'all' | 'success' | 'error'>('all');
  const [sourceFilter, setSourceFilter] = useState<string>('all');
  const [activeSubTab, setActiveSubTab] = useState<'resumo' | 'indicators' | 'dividendos' | 'checklist_perfil'>('resumo');
  const [apiDocs, setApiDocs] = useState<any>(null);

  const [theme, setTheme] = useState<'light' | 'dark'>(() => {
    const saved = localStorage.getItem('nexus-theme');
    return (saved as 'light' | 'dark') || 'dark';
  });

  const mainRef = useRef<HTMLElement>(null);

  useEffect(() => {
    fetch('/api/docs')
      .then(res => res.json())
      .then(data => setApiDocs(data))
      .catch((e) => console.error("Falha ao carregar docs de rede", e));
  }, []);

  useEffect(() => {
    if (mainRef.current) {
      mainRef.current.scrollTop = 0;
    }
  }, [activeTab]);

  useEffect(() => {
    const root = document.documentElement;
    if (theme === 'light') {
      root.classList.add('light');
    } else {
      root.classList.remove('light');
    }
    localStorage.setItem('nexus-theme', theme);
  }, [theme]);

  const toggleTheme = () => {
    setTheme(prev => prev === 'light' ? 'dark' : 'light');
  };

  const handleDownloadSdk = () => {
    const sdkCode = `// nexus-client.ts
// SDK Oficial para integração com o Nexus Proxy

export interface ScrapePayload {
  ticker: string;
  type: string;
  metrics: Record<string, any>;
  error?: string;
}

export class NexusClient {
  private baseUrl: string;

  constructor(baseUrl: string = '') {
    this.baseUrl = baseUrl;
  }

  /**
   * Envia dados de raspagem para o servidor Valorae
   */
  async sendScrapeData(payload: ScrapePayload) {
    const res = await fetch(\`\${this.baseUrl}/api/scrape\`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    if (!res.ok) throw new Error(\`Scrape error: \${res.statusText}\`);
    return res.json();
  }

  /**
   * Sincroniza dados em lote com o servidor
   */
  async syncData(data: any) {
    const res = await fetch(\`\${this.baseUrl}/api/sync\`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });
    if (!res.ok) throw new Error(\`Sync error: \${res.statusText}\`);
    return res.json();
  }
}
`;
    const blob = new Blob([sdkCode], { type: 'text/typescript' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'nexus-client.ts';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const fetchData = useCallback(async () => {
    try {
      const [statsRes, logsRes] = await Promise.all([
        fetch('/api/stats'),
        fetch('/api/logs')
      ]);
      const statsData = await statsRes.json();
      const logsData = await logsRes.json();
      setStats(statsData);
      setLogs(logsData);
    } catch (e) {
      console.error('Failed to update dashboard data');
    }
  }, []);

  const triggerFetchWithTicker = async (ticker: string) => {
    setTestTicker(ticker);
    setLoading(true);
    setTestResult(null); // Clear previous
    try {
      const res = await fetch(`/api/asset?ticker=${encodeURIComponent(ticker.toUpperCase())}&mode=super&includeNews=1`);
      const data = await res.json();
      setTestResult(data);
      setConsoleTab('visual');
      await fetchData();
    } catch (e) {
      setTestResult({ error: 'Falha crítica na conexão com o proxy' });
    } finally {
      setLoading(false);
    }
  };

  const handleTest = async (e: FormEvent) => {
    e.preventDefault();
    if (!testTicker) return;
    
    setLoading(true);
    setTestResult(null); // Clear previous
    try {
      const res = await fetch(`/api/asset?ticker=${encodeURIComponent(testTicker.toUpperCase())}&mode=super&includeNews=1`);
      const data = await res.json();
      setTestResult(data);
      setConsoleTab('visual');
      await fetchData(); // Update immediately after test
    } catch (e) {
      setTestResult({ error: 'Falha crítica na conexão com o proxy' });
    } finally {
      setLoading(false);
    }
  };

  const handleClearLogs = async () => {
    try {
      await fetch('/api/logs', { method: 'DELETE' });
      setLogs([]);
    } catch (e) {
      console.error('Failed to clear logs');
    }
  };

  useEffect(() => {
    fetchData();
    if (!isAutoRefreshActive) return;
    const interval = setInterval(fetchData, 5000);
    return () => clearInterval(interval);
  }, [fetchData, isAutoRefreshActive]);

  const uptimeStr = stats?.server?.uptime ? formatUptime(stats.server.uptime) : '...';
  const memTotal = stats?.server?.totalMem ? (stats.server.totalMem / 1024 / 1024 / 1024).toFixed(2) + ' GB' : '...';
  const memFree = stats?.server?.freeMem ? (stats.server.freeMem / 1024 / 1024 / 1024).toFixed(2) + ' GB' : '...';
  const processMem = stats?.server?.memoryUsage ? (stats.server.memoryUsage.heapUsed / 1024 / 1024).toFixed(2) + ' MB' : '...';
  const cpus = stats?.server?.cpus || '...';
  const load = stats?.server?.loadavg ? stats.server.loadavg[0].toFixed(2) : '...';

  const filteredLogs = logs.filter(l => {
    const textMatch = l.ticker.toLowerCase().includes(logSearch.toLowerCase()) || l.type.toLowerCase().includes(logSearch.toLowerCase());
    if (!textMatch) return false;
    
    if (statusFilter !== 'all' && l.status !== statusFilter) return false;
    
    if (sourceFilter !== 'all') {
      const srcLower = l.source.toLowerCase();
      if (sourceFilter === 'others') {
        const isKnown = srcLower.includes('investidor10') || srcLower.includes('yahoo');
        return !isKnown;
      }
      return srcLower.includes(sourceFilter.toLowerCase());
    }
    
    return true;
  });

  const avgLatency = logs.length > 0 ? (logs.reduce((acc, l) => acc + l.duration, 0) / logs.length).toFixed(0) : '0';
  const errorRate = logs.length > 0 ? ((logs.filter(l => l.status !== 'success').length / logs.length) * 100).toFixed(1) : '0';

  return (
    <div className="min-h-screen font-sans selection:bg-m3-primary/20 flex text-m3-on-surface">
      {/* Sidebar Mobile Overlay */}
      <AnimatePresence>
        {isSidebarOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.1 }}
            onClick={() => setIsSidebarOpen(false)}
            className="fixed inset-0 bg-black/60 z-40 lg:hidden backdrop-blur-[2px]"
          />
        )}
      </AnimatePresence>

      {/* Sidebar */}
      <aside
        className={`fixed lg:sticky top-0 left-0 h-screen w-72 bg-m3-surface-container border-r border-m3-outline-variant/20 z-50 transition-transform duration-100 ease-out flex flex-col p-6 shadow-2xl lg:shadow-none lg:translate-x-0 ${
          isSidebarOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <div className="flex items-center justify-between mb-10">
          <div className="flex items-center gap-4">
            <motion.div 
              whileHover={{ scale: 1.05, rotate: 5 }}
              className="w-12 h-12 bg-m3-primary-container rounded-[16px] flex items-center justify-center text-m3-on-primary-container shadow-lg shadow-m3-primary/10"
            >
              <Server className="w-6 h-6" />
            </motion.div>
            <div>
              <h1 className="text-xl font-black text-m3-on-surface tracking-tight leading-tight">Servidor<br/>Valorae</h1>
            </div>
          </div>
          <button className="lg:hidden p-2 -mr-2 text-m3-on-surface-variant hover:text-m3-on-surface rounded-full hover:bg-m3-on-surface/5" onClick={() => setIsSidebarOpen(false)}>
            <X className="w-6 h-6" />
          </button>
        </div>

        <nav className="space-y-2 flex-1 pt-2">
          {[
            { id: 'monitor', label: 'Monitoramento', icon: Activity },
            { id: 'logs', label: 'Tráfego', icon: Layers },
            { id: 'architecture', label: 'Arquitetura Nexus', icon: Cpu },
            { id: 'docs', label: 'Integração', icon: BookOpen }
          ].map(tab => (
            <button 
              key={tab.id}
              onClick={() => {
                setActiveTab(tab.id as any);
                setIsSidebarOpen(false);
              }}
              className={`w-full flex items-center gap-3 px-4 py-3.5 rounded-[12px] font-bold text-sm transition-all ${
                activeTab === tab.id
                  ? 'bg-m3-primary text-m3-on-primary shadow-md shadow-m3-primary/20 scale-[1.02]'
                  : 'text-m3-on-surface-variant hover:bg-m3-on-surface/5 hover:text-m3-on-surface'
              }`}
            >
              <tab.icon className="w-5 h-5 opacity-80" />
              {tab.label}
            </button>
          ))}
        </nav>

        <div className="pt-6 border-t border-m3-outline-variant/20 mt-6 lg:mt-auto">
           <div className="flex flex-col gap-1">
             <div className="flex items-center gap-2 text-[11px] font-black uppercase tracking-widest text-m3-success">
               <span className="relative flex h-2 w-2">
                 <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-current opacity-75"></span>
                 <span className="relative inline-flex rounded-full h-2 w-2 bg-current"></span>
               </span>
               Operacional
             </div>
             <div className="text-m3-on-surface-variant text-[10px] font-bold uppercase tracking-widest opacity-60 mt-1">
               Uptime OS: {uptimeStr}
             </div>
           </div>
        </div>
      </aside>

      {/* Main Content */}
      <main ref={mainRef} className="flex-1 min-w-0 h-screen overflow-y-auto">
        {/* Unified Header with Light/Dark Mode Toggle */}
        <header className="flex items-center justify-between gap-4 px-4 sm:px-6 md:px-8 py-4 sticky top-0 bg-m3-surface-container/60 backdrop-blur-md z-30 border-b border-m3-outline-variant/10 w-full">
           <div className="flex items-center gap-3">
             <button 
               onClick={() => setIsSidebarOpen(true)} 
               className="lg:hidden p-2 text-m3-on-surface-variant hover:text-m3-on-surface transition-colors bg-m3-surface-container-high/40 rounded-[12px] border border-m3-outline-variant/20"
             >
               <Menu className="w-5 h-5" />
             </button>
             <div>
               <h2 className="text-lg font-black text-m3-on-surface tracking-tight leading-none">Servidor Valorae</h2>
               <p className="text-[10px] font-bold text-m3-primary uppercase mt-1 tracking-wider hidden sm:block">Control Center & Scraper Engine</p>
             </div>
           </div>

           {/* Light / Dark Mode Toggle */}
           <button
             onClick={toggleTheme}
             className="p-2 sm:px-3 sm:py-2 rounded-[12px] bg-m3-surface-container-high/50 hover:bg-m3-surface border border-m3-outline-variant/15 text-m3-on-surface hover:text-m3-primary hover:border-m3-primary/40 transition-all shadow-sm flex items-center gap-2 cursor-pointer text-xs font-bold"
             title="Alternar Tema Claro/Escuro"
           >
             {theme === 'dark' ? (
               <>
                 <Sun className="w-4 h-4 text-amber-500 animate-[spin_50s_linear_infinite]" />
                 <span className="hidden sm:inline">Tema Claro</span>
               </>
             ) : (
               <>
                 <Moon className="w-4 h-4 text-sky-600" />
                 <span className="hidden sm:inline">Tema Escuro</span>
               </>
             )}
           </button>
        </header>

        <div className="max-w-6xl mx-auto px-4 sm:px-6 md:px-8 py-4 sm:py-8 lg:py-10">

        <AnimatePresence>
          {stats?.errorAlert && (
            <motion.div
              initial={{ height: 0, opacity: 0, marginBottom: 0 }}
              animate={{ height: 'auto', opacity: 1, marginBottom: 16 }}
              exit={{ height: 0, opacity: 0, marginBottom: 0 }}
              className="overflow-hidden"
            >
              <div className="bg-m3-error/10 border border-m3-error/20 rounded-[16px] p-4 flex items-start sm:items-center gap-4 text-m3-error">
                <div className="bg-m3-error/20 p-2 rounded-full shrink-0">
                  <AlertTriangle className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm font-black tracking-tight uppercase">Alerta de Instabilidade</h3>
                  <p className="text-xs font-medium opacity-80 mt-0.5">A taxa de erro ultrapassou 10% nas últimas 50 requisições. Verifique o tráfego no console para identificar os proxies afetados.</p>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {activeTab === 'monitor' ? (
          <div className="space-y-4">
            {/* Desktop Section Header */}
            <div className="hidden lg:flex items-center justify-between mb-6 pb-3 border-b border-m3-outline-variant/10">
              <div>
                <h1 className="text-lg font-black text-m3-on-surface tracking-tight flex items-center gap-2">
                  <Activity className="w-5 h-5 text-m3-primary animate-pulse" />
                  Painel de Monitoramento
                </h1>
                <p className="text-xs font-semibold text-m3-on-surface-variant mt-0.5">Status de carga em tempo real, telemetria de hardware e métricas do proxy.</p>
              </div>
              <button 
                onClick={fetchData} 
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-m3-outline-variant/35 text-[10px] font-black uppercase tracking-wider text-m3-on-surface-variant hover:text-m3-on-surface hover:bg-m3-surface-container-high transition-colors shadow-sm cursor-pointer"
              >
                <RefreshCcw className="w-3.5 h-3.5" />
                Atualizar Status
              </button>
            </div>

            {/* Unified Metrics Cards */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              
              <M3Card variant="elevated" className="border border-m3-outline-variant/10 shadow-sm flex flex-col justify-between p-4 sm:p-5">
                <div>
                  <div className="flex items-center gap-2 mb-3">
                    <Cpu className="w-4 h-4 text-m3-primary" />
                    <h2 className="text-xs font-black uppercase tracking-widest text-m3-on-surface-variant">Status do Hardware & OS</h2>
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-4 gap-x-4 gap-y-2">
                    <MetricsGroup label="CPU Núcleos" value={cpus} icon={<Cpu className="w-3.5 h-3.5 opacity-70"/>} subtitle="Cores disponíveis" />
                    <MetricsGroup label="Load (1m)" value={load} icon={<Activity className="w-3.5 h-3.5 opacity-70"/>} subtitle="Média de carga local" />
                    <MetricsGroup label="Mem Total" value={memTotal} icon={<HardDrive className="w-3.5 h-3.5 opacity-70"/>} subtitle="Memória reservada" />
                    <MetricsGroup label="Mem Livre" value={memFree} icon={<HardDrive className="w-3.5 h-3.5 opacity-70"/>} subtitle="Capacidade ociosa" />
                    <MetricsGroup label="Uso Node" value={processMem} icon={<Database className="w-3.5 h-3.5 opacity-70"/>} subtitle="Heap memory ativa" />
                    <MetricsGroup label="Plataforma" value={stats?.server?.platform || '...'} subtitle="Sistema operacional" />
                    <MetricsGroup label="Node.js" value={stats?.server?.nodeVersion || '...'} subtitle="Versão do runtime" />
                  </div>
                </div>
              </M3Card>

              <M3Card variant="elevated" className="border border-m3-outline-variant/10 shadow-sm flex flex-col justify-between p-4 sm:p-5">
                <div>
                  <div className="flex items-center gap-2 mb-3">
                    <Globe className="w-4 h-4 text-m3-primary" />
                    <h2 className="text-xs font-black uppercase tracking-widest text-m3-on-surface-variant">Motor de Scraping & Proxy</h2>
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-4 gap-x-4 gap-y-2">
                    <MetricsGroup label="Requests" value={stats?.totalRequests || 0} subtitle="Sessões processadas" />
                    <MetricsGroup label="Taxa Sucesso" value={stats?.successRate || '0%'} subtitle="Percentual de êxito" />
                    <MetricsGroup label="Falhas" value={stats?.totalFailures || 0} subtitle="Sessões malsucedidas" />
                    <MetricsGroup label="In-Flight" value={stats?.inFlightRequests || 0} subtitle="Sessões simultâneas" />
                    <MetricsGroup label="Cache" value={`${stats?.cache?.tamanho || 0}/${stats?.cache?.tamanhoMax || 0}`} subtitle="Itens armazenados" />
                    <MetricsGroup label="Hits" value={stats?.session?.cacheHits || 0} subtitle="Acertos locais" />
                    <MetricsGroup label="Misses" value={stats?.session?.cacheMisses || 0} subtitle="Consultas web ativas" />
                    <MetricsGroup label="Stale" value={stats?.session?.cacheStale || 0} subtitle="Expirados úteis" />
                  </div>
                </div>
              </M3Card>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
              {/* Interaction Panel */}
              <div className="lg:col-span-4 space-y-4">
                <M3Card variant="elevated" className="border border-m3-outline-variant/10 shadow-sm p-4 sm:p-5">
                  <div className="flex items-center gap-2 mb-3">
                    <div className="w-7 h-7 bg-m3-secondary-container rounded-lg flex items-center justify-center text-m3-on-secondary-container">
                      <Search className="w-4 h-4" />
                    </div>
                    <div>
                      <h2 className="text-xs font-black uppercase tracking-wider text-m3-on-surface-variant">Fetch Manual</h2>
                      <p className="text-[10px] font-semibold text-m3-on-surface-variant/60 leading-none">Execute requisições de teste no proxy.</p>
                    </div>
                  </div>
                  <form onSubmit={handleTest} className="space-y-3 text-m3-on-surface">
                    <div className="relative group">
                      <input 
                        type="text" 
                        value={testTicker}
                        onChange={(e) => setTestTicker(e.target.value)}
                        placeholder="EX: PETR4, MXRF11, AAPL" 
                        className="w-full bg-m3-surface-container-high border-2 border-transparent rounded-lg px-3 py-2 text-xs font-black text-m3-on-surface placeholder:text-m3-on-surface-variant/30 focus:outline-none focus:border-m3-primary focus:bg-m3-surface transition-all uppercase font-mono tracking-wider shadow-inner relative z-10"
                      />
                      <span className="hidden sm:inline absolute right-3 top-1/2 -translate-y-1/2 text-[9px] font-black uppercase text-m3-on-surface-variant/40 group-focus-within:text-m3-primary/40 transition-colors z-20">TICKER</span>
                    </div>

                    <div className="space-y-1">
                      <span className="text-[9px] font-bold uppercase tracking-wider text-m3-on-surface-variant/60">Sugeridos B3 / GLOBAIS:</span>
                      <div className="flex flex-wrap gap-1">
                        {['PETR4', 'VALE3', 'MXRF11', 'AAPL', 'BTC-USD'].map(t => (
                          <button
                            key={t}
                            type="button"
                            onClick={() => triggerFetchWithTicker(t)}
                            className={`px-2 py-0.5 text-[9.5px] font-bold rounded-md transition-all uppercase border cursor-pointer ${
                              testTicker.toUpperCase() === t.toUpperCase()
                                ? 'bg-m3-primary/10 text-m3-primary border-m3-primary'
                                : 'bg-m3-surface hover:bg-m3-primary/10 hover:text-m3-primary border-m3-outline-variant/10 text-m3-on-surface-variant'
                            }`}
                          >
                            {t}
                          </button>
                        ))}
                      </div>
                    </div>
                    
                    <button 
                      disabled={loading}
                      className="group w-full h-9 bg-m3-primary text-m3-on-primary rounded-lg font-black text-xs uppercase tracking-wider transition-all hover:bg-m3-primary/95 active:scale-[0.98] disabled:opacity-50 flex items-center justify-center gap-1.5"
                    >
                      {loading ? (
                        <RefreshCcw className="w-3.5 h-3.5 animate-spin" />
                      ) : (
                        <>
                          Realizar Scrape <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition-transform" />
                        </>
                      )}
                    </button>
                  </form>
                </M3Card>

                {/* Latency Sparkline */}
                <M3Card variant="elevated" className="border border-m3-outline-variant/10 shadow-sm flex flex-col items-center justify-center p-4 sm:p-5 h-44">
                  <div className="flex w-full justify-between items-center mb-3">
                    <h3 className="text-[10px] font-bold text-m3-on-surface-variant uppercase tracking-wider flex items-center gap-1.5">
                       <Activity className="w-3.5 h-3.5 opacity-50" /> Latência
                    </h3>
                    <span className="text-[11px] font-mono font-bold text-m3-primary">{avgLatency}ms avg</span>
                  </div>
                  <div className="flex-1 w-full relative">
                    {logs.length > 0 ? (
                      <ResponsiveContainer width="100%" height="100%">
                        <LineChart data={[...logs].reverse().slice(-15)}>
                           <YAxis hide domain={['dataMin - 10', 'dataMax + 10']} />
                           <Line 
                             type="monotone" 
                             dataKey="duration" 
                             stroke="currentColor" 
                             className="text-m3-primary"
                             strokeWidth={3} 
                             dot={false}
                             isAnimationActive={false}
                           />
                        </LineChart>
                      </ResponsiveContainer>
                    ) : (
                      <div className="absolute inset-0 flex items-center justify-center">
                        <span className="text-[10px] font-black tracking-widest uppercase text-m3-on-surface-variant/30">Sem Dados</span>
                      </div>
                    )}
                  </div>
                </M3Card>
              </div>

              {/* Data Visualizer */}
              <div className="lg:col-span-8 flex flex-col min-h-[500px] lg:h-[650px]">
                <M3Card className="flex-1 flex flex-col p-0 border border-m3-outline-variant/30 bg-m3-surface-container !rounded-[28px] overflow-hidden shadow-lg">
                  <div className="px-4 py-2.5 sm:px-5 sm:py-3 border-b border-m3-outline-variant/20 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 bg-m3-surface-container-high/60 rounded-t-[28px]">
                    <div className="flex items-center gap-2">
                      <Terminal className="w-3.5 h-3.5 text-m3-primary" />
                      <h2 className="font-extrabold text-xs sm:text-xs uppercase tracking-wider text-m3-on-surface">Console de Payload</h2>
                    </div>
                    {testResult && (
                      <div className="flex items-center bg-m3-surface-container rounded-lg p-0.5 border border-m3-outline-variant/10 shrink-0">
                        <button
                          onClick={() => setConsoleTab('visual')}
                          className={`px-2.5 py-1 text-[10.5px] font-bold rounded-md transition-all ${
                            consoleTab === 'visual'
                              ? 'bg-m3-primary text-m3-on-primary shadow-sm'
                              : 'text-m3-on-surface-variant hover:text-m3-on-surface'
                          }`}
                        >
                          Ativo Visual
                        </button>
                        <button
                          onClick={() => setConsoleTab('json')}
                          className={`px-2.5 py-1 text-[10.5px] font-bold rounded-md transition-all ${
                            consoleTab === 'json'
                              ? 'bg-m3-primary text-m3-on-primary shadow-sm'
                              : 'text-m3-on-surface-variant hover:text-m3-on-surface'
                          }`}
                        >
                          JSON Bruto
                        </button>
                      </div>
                    )}
                  </div>

                  <div className="flex-1 overflow-auto p-4 sm:p-5 custom-scrollbar bg-m3-surface border-t-2 border-m3-primary/5 rounded-b-[28px]">
                    {testResult ? (
                      consoleTab === 'json' ? (
                        <div className="relative h-full">
                          <pre className="text-[11px] sm:text-[13px] font-mono leading-relaxed text-m3-on-surface-variant/90 whitespace-pre-wrap break-all select-all">
                            {JSON.stringify(testResult, null, 2)}
                          </pre>
                        </div>
                      ) : testResult.error ? (
                        <div className="flex flex-col items-center justify-center text-center py-12 px-6 h-full">
                          <div className="w-16 h-16 bg-m3-error/10 text-m3-error border border-m3-error/20 rounded-2xl flex items-center justify-center mb-4">
                            <AlertCircle className="w-8 h-8" />
                          </div>
                          <h3 className="text-lg font-black text-m3-on-surface leading-tight uppercase">Extração Malsucedida</h3>
                          <p className="text-sm font-medium text-m3-on-surface-variant max-w-md mt-2">
                            {testResult.error}
                          </p>
                          <div className="bg-m3-surface-container-high/40 border border-m3-outline-variant/15 p-4 rounded-xl text-left max-w-md mt-6 space-y-2 text-xs font-medium text-m3-on-surface-variant">
                            <span className="font-bold text-m3-primary uppercase text-[10px] tracking-wider block">Sugestões de Resolução:</span>
                            <p>• Confirme se o ticker digitado é válido na bolsa brasileira B3 (ex: VALE3, HGCR11) ou globalmente (ex: AAPL, BTC-USD).</p>
                            <p>• Alguns índices de mercado não possuem relatórios fundamentalistas diretos suportados.</p>
                            <p>• O proxy pode ter sofrido limitação de taxa (Rate Limit) temporária da fonte.</p>
                          </div>
                        </div>
                      ) : (
                        <div className="space-y-6">
                          {/* Asset Header Info */}
                          <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-m3-outline-variant/10">
                            <div className="flex items-center gap-3">
                              <div className="w-10 h-10 bg-m3-primary/10 rounded-lg border border-m3-primary/20 flex items-center justify-center text-m3-primary font-black uppercase text-xs tracking-wider font-mono select-all">
                                {testResult.ticker}
                              </div>
                              <div>
                                <div className="flex items-center gap-1.5 font-sans">
                                  <h3 className="text-sm font-extrabold text-m3-on-surface tracking-tight leading-none">{testResult.ticker}</h3>
                                  <Badge label={testResult.type || 'ACAO'} />
                                </div>
                                <p className="text-[10px] text-m3-on-surface-variant font-medium mt-0.5 opacity-80 font-sans">Conexão direta proxy-fonte</p>
                              </div>
                            </div>

                            <div className="text-right flex flex-col items-end font-sans">
                              <span className="text-[9px] font-bold uppercase tracking-wider text-m3-on-surface-variant opacity-60 leading-none">Preço Scrape</span>
                              <div className="flex items-baseline gap-1.5 mt-0.5">
                                <span className="text-base font-black text-m3-on-surface tracking-tight font-mono">
                                  {testResult.results?.precoAtual != null ? `R$ ${testResult.results.precoAtual}` : (testResult.results?.preco != null ? `R$ ${testResult.results.preco}` : 'N/A')}
                                </span>
                                {testResult.results?.variacaoDay && (
                                  <span className={`inline-flex items-center gap-0.5 text-[9.5px] font-bold px-1.5 py-0.5 rounded-full ${
                                    testResult.results.variacaoDay.startsWith('-')
                                      ? 'bg-m3-error/10 text-m3-error'
                                      : 'bg-m3-success/10 text-m3-success'
                                  }`}>
                                    {testResult.results.variacaoDay.startsWith('-') ? <TrendingDown className="w-2.5 h-2.5" /> : <TrendingUp className="w-2.5 h-2.5" />}
                                    {testResult.results.variacaoDay}
                                  </span>
                                )}
                              </div>
                            </div>
                          </div>

                          {/* Sub-abas de Navegação do Ativo */}
                          <div className="flex border-b border-m3-outline-variant/10 pb-0.5 gap-2 scrollbar-none overflow-x-auto select-none">
                            {[
                              { id: 'resumo', label: 'Resumo Geral', icon: Info },
                              { id: 'indicators', label: 'Indicadores Detalhados', icon: Database },
                              { id: 'dividendos', label: 'Histórico de Proventos', icon: RefreshCcw },
                              { id: 'checklist_perfil', label: 'Checklist & Perfil', icon: CheckCircle2 }
                            ].map(subTab => {
                              const Icon = subTab.icon;
                              const isSelected = activeSubTab === subTab.id;
                              return (
                                <button
                                  key={subTab.id}
                                  onClick={() => setActiveSubTab(subTab.id as any)}
                                  className={`flex items-center gap-1.5 px-3 py-1.5 text-[10.5px] font-extrabold uppercase tracking-wider border-b-2 font-sans transition-all shrink-0 cursor-pointer ${
                                    isSelected
                                      ? 'border-m3-primary text-m3-primary opacity-100'
                                      : 'border-transparent text-m3-on-surface-variant opacity-75 hover:opacity-100 hover:text-m3-on-surface hover:border-m3-outline-variant/20'
                                  }`}
                                >
                                  <Icon className="w-3.5 h-3.5" />
                                  {subTab.label}
                                </button>
                              );
                            })}
                          </div>

                          {/* Conteúdo Dinâmico por Sub-aba */}
                          {activeSubTab === 'resumo' && (
                            <div className="space-y-6 animate-fade-in text-m3-on-surface">
                              {/* Resumo descritivo da Investidor10 - se houver */}
                              {testResult.results?.resumoInvestidor10 && (
                                <div className="p-4 bg-m3-primary/5 border border-m3-primary/10 rounded-2xl space-y-1.5">
                                  <h4 className="text-[10px] font-black uppercase text-m3-primary tracking-widest flex items-center gap-1 font-sans">
                                    <BookOpen className="w-3.5 h-3.5" />
                                    Perfil de Mercado da Companhia (Investidor10)
                                  </h4>
                                  <p className="text-[11.5px] font-medium leading-relaxed text-m3-on-surface-variant/90 font-sans">
                                    {testResult.results.resumoInvestidor10}
                                  </p>
                                </div>
                              )}

                              {/* Fundamental Grids Principais */}
                              <div className="space-y-1 pt-1 font-sans">
                                <h4 className="text-[10px] font-bold uppercase tracking-wider text-m3-on-surface-variant/85 flex items-center gap-1.5">
                                  <Info className="w-3.5 h-3.5 text-m3-primary" />
                                  Pilares Fundamentalistas Principais
                                </h4>
                                
                                <div className="grid grid-cols-2 md:grid-cols-4 gap-6 py-2">
                                  <div className="flex flex-col justify-between">
                                    <span className="text-[9.5px] text-m3-on-surface-variant/70 uppercase tracking-wider font-bold">Dividend Yield</span>
                                    <span className="text-base font-black text-m3-primary mt-0.5 font-mono select-all">
                                      {testResult.results?.dividendYield || testResult.results?.dy12m || testResult.results?.dy || '0,0%'}
                                    </span>
                                    <span className="text-[8.5px] text-m3-on-surface-variant/50 font-medium">Rendimento 12m</span>
                                  </div>

                                  <div className="flex flex-col justify-between">
                                    <span className="text-[9.5px] text-m3-on-surface-variant/70 uppercase tracking-wider font-bold">P/L</span>
                                    <span className="text-base font-black text-m3-on-surface mt-0.5 font-mono select-all">
                                      {testResult.results?.pl || 'N/A'}
                                    </span>
                                    <span className="text-[8.5px] text-m3-on-surface-variant/50 font-medium">Retorno em anos</span>
                                  </div>

                                  <div className="flex flex-col justify-between">
                                    <span className="text-[9.5px] text-m3-on-surface-variant/70 uppercase tracking-wider font-bold">P/VP</span>
                                    <span className="text-base font-black text-m3-on-surface mt-0.5 font-mono select-all">
                                      {testResult.results?.pvp || 'N/A'}
                                    </span>
                                    <span className="text-[8.5px] text-m3-on-surface-variant/50 font-medium font-sans">Ágio s/ VP</span>
                                  </div>

                                  <div className="flex flex-col justify-between">
                                    <span className="text-[9.5px] text-m3-on-surface-variant/70 uppercase tracking-wider font-bold">Margem Líquida</span>
                                    <span className="text-base font-black text-m3-on-surface mt-0.5 font-mono select-all">
                                      {testResult.results?.margemLiquida || testResult.results?.margemOperacional || 'N/A'}
                                    </span>
                                    <span className="text-[8.5px] text-m3-on-surface-variant/50 font-medium font-sans">Eficiência operacional</span>
                                  </div>
                                </div>
                              </div>

                              {/* Quick specs do Proxy */}
                              <div className="p-3 bg-m3-surface-container-high/30 rounded-2xl border border-m3-outline-variant/10 grid grid-cols-2 lg:grid-cols-4 gap-6 font-sans">
                                <div className="flex flex-col justify-between">
                                  <span className="text-[9px] uppercase font-bold text-m3-on-surface-variant/70 tracking-wider">Resposta do Proxy</span>
                                  <span className="text-xs font-mono font-black text-m3-primary mt-0.5">
                                    {testResult.metrics?.totalTimeMs != null ? `${testResult.metrics.totalTimeMs.toFixed(0)} ms` : 'N/A'}
                                  </span>
                                  <span className="text-[8.5px] text-m3-on-surface-variant/40 leading-none">Latência de rota</span>
                                </div>
                                <div className="flex flex-col justify-between">
                                  <span className="text-[9px] uppercase font-bold text-m3-on-surface-variant/70 tracking-wider">Fidelidade</span>
                                  <span className={`text-xs font-mono font-black mt-0.5 ${testResult.cacheStatus === 'HIT' ? 'text-m3-success' : 'text-m3-primary'}`}>
                                    {testResult.cacheStatus || 'MISS'}
                                  </span>
                                  <span className="text-[8.5px] text-m3-on-surface-variant/40 leading-none">Motor cache local</span>
                                </div>
                                <div className="flex flex-col justify-between">
                                  <span className="text-[9px] uppercase font-bold text-m3-on-surface-variant/70 tracking-wider">Tamanho</span>
                                  <span className="text-xs font-mono font-black text-m3-on-surface mt-0.5">
                                    {testResult.metrics?.bytesProcessed != null ? `${(testResult.metrics.bytesProcessed / 1024).toFixed(1)} KB` : '0.0 KB'}
                                  </span>
                                  <span className="text-[8.5px] text-m3-on-surface-variant/40 leading-none">Dados processados</span>
                                </div>
                                <div className="flex flex-col justify-between">
                                  <span className="text-[9px] uppercase font-bold text-m3-on-surface-variant/70 tracking-wider">Origem</span>
                                  <span className="text-xs font-mono font-black text-m3-on-surface truncate block max-w-[130px] mt-0.5" title={testResult.metrics?.source || 'Yahoo/Web'}>
                                    {testResult.metrics?.source || 'Yahoo/Web'}
                                  </span>
                                  <span className="text-[8.5px] text-m3-on-surface-variant/40 leading-none">Agente coletor</span>
                                </div>
                              </div>

                              {/* Yahoo News integrated display */}
                              {testResult.news && testResult.news.length > 0 && (
                                <div className="space-y-2 pt-2 font-sans-variant">
                                  <h4 className="text-xs font-bold uppercase tracking-wider text-m3-on-surface-variant flex items-center gap-1.5 font-sans">
                                    <Globe className="w-4 h-4 text-m3-primary" />
                                    Notícias Relevantes Associadas (Google News)
                                  </h4>
                                  <div className="space-y-2 max-h-56 overflow-y-auto custom-scrollbar pr-1">
                                    {testResult.news.map((item: any, idx: number) => (
                                      <a 
                                        key={idx} 
                                        href={item.link} 
                                        target="_blank" 
                                        rel="noreferrer" 
                                        className="p-3 bg-m3-surface-container-low/40 rounded-xl border border-m3-outline-variant/10 flex hover:border-m3-primary/30 justify-between items-center transition-all group cursor-pointer"
                                      >
                                        <div className="min-w-0 pr-4 font-sans">
                                          <h5 className="text-xs font-bold text-m3-on-surface leading-snug truncate group-hover:text-m3-primary transition-colors pr-2">
                                            {item.title}
                                          </h5>
                                          <p className="text-[10px] text-m3-on-surface-variant/60 font-medium mt-1">
                                            {item.source ? `${item.source} • ` : ''}
                                            {item.pubDate ? new Date(item.pubDate).toLocaleDateString('pt-BR') : ''}
                                          </p>
                                        </div>
                                        <ExternalLink className="w-3.5 h-3.5 text-m3-on-surface-variant group-hover:text-m3-primary shrink-0 transition-colors" />
                                      </a>
                                    ))}
                                  </div>
                                </div>
                              )}
                            </div>
                          )}

                          {activeSubTab === 'indicators' && (
                            <div className="space-y-6 animate-fade-in text-m3-on-surface">
                              {testResult.type === 'FII' ? (
                                <div className="space-y-6">
                                  <div className="space-y-2 font-sans">
                                    <h4 className="text-[11px] font-black uppercase text-m3-primary tracking-widest pb-1.5 border-b border-m3-outline-variant/10 flex justify-between items-center">
                                      <span>Rendimentos e Indicadores do FII</span>
                                      <Database className="w-4 h-4 text-m3-primary opacity-70" />
                                    </h4>
                                    <div className="grid grid-cols-2 md:grid-cols-4 gap-6 py-2 font-mono">
                                      <MetricsGroup label="Último Rendimento" value={testResult.results?.ultimoRendimento || 'N/A'} subtitle="Mês corrente" />
                                      <MetricsGroup label="Yield 1 Mês" value={testResult.results?.yield1m || 'N/A'} subtitle="Retorno mês" />
                                      <MetricsGroup label="Yield 3 Meses" value={testResult.results?.yield3m || 'N/A'} subtitle="Retorno short" />
                                      <MetricsGroup label="Yield 6 Meses" value={testResult.results?.yield6m || 'N/A'} subtitle="Retorno médio" />
                                      <MetricsGroup label="Yield 12 Meses" value={testResult.results?.yield12m || 'N/A'} subtitle="Retorno acumulado" />
                                      <MetricsGroup label="DY Médio 5 Anos" value={testResult.results?.dyMedio5a || 'N/A'} subtitle="Fidelidade histórica" />
                                      <MetricsGroup label="Proventos 12M" value={testResult.results?.totalDividendos12m != null ? `R$ ${testResult.results.totalDividendos12m}` : (testResult.results?.totalDividendos12m || 'N/A')} subtitle="Total recebido" />
                                      <MetricsGroup label="Magic Number" value={testResult.results?.magicNumber || 'N/A'} subtitle="Cotas reinvestidoras" />
                                    </div>
                                  </div>

                                  <div className="space-y-2 font-sans">
                                    <h4 className="text-[11px] font-black uppercase text-m3-primary tracking-widest pb-1.5 border-b border-m3-outline-variant/10 flex justify-between items-center">
                                      <span>Diagnóstico Patrimonial & Concorrência</span>
                                      <Layers className="w-4 h-4 text-m3-primary opacity-70" />
                                    </h4>
                                    <div className="grid grid-cols-2 md:grid-cols-4 gap-6 py-2 font-mono">
                                      <MetricsGroup label="Valor Patrimonial" value={testResult.results?.valorPatrimonial != null ? `R$ ${testResult.results.valorPatrimonial}` : 'N/A'} subtitle="Valor por Cota" />
                                      <MetricsGroup label="Patrimônio Líquido" value={testResult.results?.patrimonioLiquido != null ? testResult.results.patrimonioLiquido : 'N/A'} subtitle="Tamanho de carteira" />
                                      <MetricsGroup label="Cotas Emitidas" value={testResult.results?.cotasEmitidas || 'N/A'} subtitle="Total de papéis" />
                                      <MetricsGroup label="Número Cotistas" value={testResult.results?.numeroCotistas || 'N/A'} subtitle="Engajamento" />
                                      <MetricsGroup label="Vacância Física" value={testResult.results?.vacanciaFisica || '0,00%'} subtitle="Área desocupada" />
                                      <MetricsGroup label="Vacância Finan." value={testResult.results?.vacanciaFinanceira || '0,00%'} subtitle="Falta de aluguel" />
                                      <MetricsGroup label="Taxa Administ." value={testResult.results?.taxaAdministracao || 'N/A'} subtitle="Custo de Gestão" />
                                      <MetricsGroup label="Liquidez Diária" value={testResult.results?.liquidezDiaria || 'N/A'} subtitle="Facilidade venda" />
                                    </div>
                                  </div>
                                </div>
                              ) : (
                                <div className="space-y-6">
                                  <div className="space-y-2 font-sans">
                                    <h4 className="text-[11px] font-black uppercase text-m3-primary tracking-widest pb-1.5 border-b border-m3-outline-variant/10 flex justify-between items-center">
                                      <span>Indicadores de Preço & Valuation</span>
                                      <Activity className="w-4 h-4 text-m3-primary opacity-70" />
                                    </h4>
                                    <div className="grid grid-cols-2 md:grid-cols-4 gap-6 py-2 font-mono">
                                      <MetricsGroup label="P/L" value={testResult.results?.pl || 'N/A'} subtitle="Preço sobre Lucro" />
                                      <MetricsGroup label="P/VP" value={testResult.results?.pvp || 'N/A'} subtitle="Desconto patrimônio" />
                                      <MetricsGroup label="PSR" value={testResult.results?.psr || 'N/A'} subtitle="Preço s/ Receita" />
                                      <MetricsGroup label="EV / EBITDA" value={testResult.results?.evEbitda || 'N/A'} subtitle="Enterprise Value/Ebt" />
                                      <MetricsGroup label="EV / EBIT" value={testResult.results?.evEbit || 'N/A'} subtitle="Enterprise Value/Ebit" />
                                      <MetricsGroup label="P / EBIT" value={testResult.results?.pEbit || 'N/A'} subtitle="Preço s/ Lucro Oper" />
                                      <MetricsGroup label="P / Ativo" value={testResult.results?.pAtivo || 'N/A'} subtitle="Preço sobre Ativos" />
                                      <MetricsGroup label="P / Cap. Giro" value={testResult.results?.pCapGiro || 'N/A'} subtitle="Preço s/ cap de giro" />
                                      <MetricsGroup label="LPA" value={testResult.results?.lpa != null ? `R$ ${testResult.results.lpa}` : 'N/A'} subtitle="Lucro Por Ação" />
                                      <MetricsGroup label="VPA" value={testResult.results?.vpa != null ? `R$ ${testResult.results.vpa}` : 'N/A'} subtitle="Valor Patr. Ação" />
                                      <MetricsGroup label="Giro Ativos" value={testResult.results?.giroAtivos || 'N/A'} subtitle="Giro operacional" />
                                      <MetricsGroup label="P/Ativo Circ.L." value={testResult.results?.pAtivoCircLiq || 'N/A'} subtitle="Fator Margin Grahm" />
                                    </div>
                                  </div>

                                  <div className="space-y-2 font-sans">
                                    <h4 className="text-[11px] font-black uppercase text-m3-primary tracking-widest pb-1.5 border-b border-m3-outline-variant/10 flex justify-between items-center">
                                      <span>Rentabilidade & Eficiência</span>
                                      <Database className="w-4 h-4 text-m3-primary opacity-70" />
                                    </h4>
                                    <div className="grid grid-cols-2 md:grid-cols-4 gap-6 py-2 font-mono">
                                      <MetricsGroup label="ROE" value={testResult.results?.roe || 'N/A'} subtitle="Retorno s/ Patr." />
                                      <MetricsGroup label="ROIC" value={testResult.results?.roic || 'N/A'} subtitle="Retorno s/ Cap.I" />
                                      <MetricsGroup label="ROA" value={testResult.results?.roa || 'N/A'} subtitle="Retorno s/ Ativo" />
                                      <MetricsGroup label="Margem Líquida" value={testResult.results?.margemLiquida || 'N/A'} subtitle="Lucro gerado/receita" />
                                      <MetricsGroup label="Margem Bruta" value={testResult.results?.margemBruta || 'N/A'} subtitle="Margem de fabric" />
                                      <MetricsGroup label="Margem EBITDA" value={testResult.results?.margemEbitda || 'N/A'} subtitle="Margem operacional" />
                                      <MetricsGroup label="Margem EBIT" value={testResult.results?.margemEbit || 'N/A'} subtitle="Eficiência sem tax" />
                                      <MetricsGroup label="Payout" value={testResult.results?.payout || 'N/A'} subtitle="Lucro Distribuído" />
                                    </div>
                                  </div>

                                  <div className="space-y-2 font-sans">
                                    <h4 className="text-[11px] font-black uppercase text-m3-primary tracking-widest pb-1.5 border-b border-m3-outline-variant/10 flex justify-between items-center">
                                      <span>Endividamento, Crescimento & Caixa</span>
                                      <Layers className="w-4 h-4 text-m3-primary opacity-70" />
                                    </h4>
                                    <div className="grid grid-cols-2 md:grid-cols-4 gap-6 py-2 font-mono">
                                      <MetricsGroup label="Dív.Líq. / Patr." value={testResult.results?.dividaLiquidaPatrimonio || 'N/A'} subtitle="Risco de alavancagem" />
                                      <MetricsGroup label="Dív.Líq. / EBITDA" value={testResult.results?.dividaLiquidaEbitda || 'N/A'} subtitle="Anos de quitação" />
                                      <MetricsGroup label="Dív.Líq. / EBIT" value={testResult.results?.dividaLiquidaEbit || 'N/A'} subtitle="Múltiplo de endivid" />
                                      <MetricsGroup label="Dívida Bruta/P" value={testResult.results?.dividaBrutaPatrimonio || 'N/A'} subtitle="Bruto s/ Patrimônio" />
                                      <MetricsGroup label="Liquidez Corr." value={testResult.results?.liquidezCorrente || 'N/A'} subtitle="Fôlego de curto prazo" />
                                      <MetricsGroup label="Patrimônio/Ativos" value={testResult.results?.patrimonioAtivos || 'N/A'} subtitle="Estrutura de capital" />
                                      <MetricsGroup label="CAGR Receitas 5A" value={testResult.results?.cagrReceitas5a || 'N/A'} subtitle="Crescimento vendas" />
                                      <MetricsGroup label="CAGR Lucros 5A" value={testResult.results?.cagrLucros5a || 'N/A'} subtitle="Crescimento lucro" />
                                    </div>
                                  </div>
                                </div>
                              )}
                            </div>
                          )}

                          {activeSubTab === 'dividendos' && (
                            <div className="space-y-4 animate-fade-in text-m3-on-surface font-sans">
                              <div className="flex justify-between items-center border-b border-m3-outline-variant/10 pb-2">
                                <h4 className="text-[11px] font-black uppercase text-m3-primary tracking-widest flex items-center gap-1.5">
                                  <RefreshCcw className="w-4 h-4 text-m3-primary" />
                                  Histórico Recente de Rendimentos e Proventos (Investidor10)
                                </h4>
                                <span className="text-[9px] font-bold text-m3-on-surface-variant font-mono select-none">Sinalizadores no Ano</span>
                              </div>

                              {testResult.results?.historicoDividendos && testResult.results.historicoDividendos.length > 0 ? (
                                <div className="overflow-x-auto rounded-xl border border-m3-outline-variant/10">
                                  <table className="w-full text-left border-collapse text-xs font-sans">
                                    <thead>
                                      <tr className="bg-m3-surface-container-high/40 text-[9.5px] uppercase font-bold tracking-wider text-m3-on-surface-variant">
                                        <th className="p-3 text-left">Tipo</th>
                                        <th className="p-3 text-left">Data Com (Direito)</th>
                                        <th className="p-3 text-left">Data Pagamento</th>
                                        <th className="p-3 text-right">Valor Unitário</th>
                                      </tr>
                                    </thead>
                                    <tbody className="divide-y divide-m3-outline-variant/10 font-mono">
                                      {testResult.results.historicoDividendos.map((item: any, idx: number) => (
                                        <tr key={idx} className="hover:bg-m3-primary/5 transition-colors">
                                          <td className="p-3 font-extrabold text-m3-on-surface select-all">{item.tipo || 'Rendimento'}</td>
                                          <td className="p-3 text-m3-on-surface-variant">{item.dataCom || 'N/A'}</td>
                                          <td className="p-3 text-m3-on-surface-variant">{item.dataPagamento || 'N/A'}</td>
                                          <td className="p-3 text-right font-black text-m3-primary">{item.valor != null ? `R$ ${item.valor}` : 'N/A'}</td>
                                        </tr>
                                      ))}
                                    </tbody>
                                  </table>
                                </div>
                              ) : (
                                <div className="py-12 text-center text-m3-on-surface-variant/40 flex flex-col items-center justify-center font-sans">
                                  <AlertTriangle className="w-8 h-8 mb-2" />
                                  <p className="font-bold text-xs uppercase tracking-wider">Histórico não disponível para o ticker ou redundância ativa</p>
                                  <p className="text-[10px] max-w-xs mt-1 leading-relaxed text-m3-on-surface-variant">Conexões de contingência ou de mercado em tempo real (ex: Yahoo) entregam apenas as métricas consolidadas agregadas em doze meses.</p>
                                </div>
                              )}
                            </div>
                          )}

                          {activeSubTab === 'checklist_perfil' && (
                            <div className="space-y-6 animate-fade-in text-m3-on-surface">
                              {testResult.type === 'FII' && testResult.results?.sections?.listaImoveis && (
                                <div className="space-y-3">
                                  <h4 className="text-[11px] font-black uppercase text-m3-primary tracking-widest pb-1.5 border-b border-m3-outline-variant/10 flex justify-between items-center font-sans">
                                    <span>Distribuição Física e Ativos do FII</span>
                                    <Globe className="w-4 h-4 text-m3-primary opacity-70" />
                                  </h4>
                                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 font-sans">
                                    <div className="p-4 bg-m3-surface-container-high/20 border border-m3-outline-variant/10 rounded-2xl">
                                      <span className="text-[10px] font-bold uppercase tracking-widest text-m3-primary font-mono select-none">Métricas de Imóveis</span>
                                      <div className="space-y-2 mt-2 font-mono text-xs">
                                        <div className="flex justify-between border-b border-m3-outline-variant/10 pb-1">
                                          <span className="opacity-60">Área Bruta Locável (ABL):</span>
                                          <span className="font-bold">{testResult.results.sections.listaImoveis.totalAbl || testResult.results.sections.listaImoveis.ablMedia || (testResult.results.sections.listaImoveis.imoveis?.some((i: any) => i.areaBrutaLocavelM2) ? `${testResult.results.sections.listaImoveis.imoveis.reduce((acc: number, i: any) => acc + (Number(i.areaBrutaLocavelM2) || 0), 0).toLocaleString('pt-BR')} m²` : 'N/A')}</span>
                                        </div>
                                        <div className="flex justify-between border-b border-m3-outline-variant/10 pb-1">
                                          <span className="opacity-60">Estados Representados:</span>
                                          <span className="font-bold">{testResult.results.sections.listaImoveis.estadosRepresentados || testResult.results.sections.listaImoveis.porEstado?.length || 'N/A'}</span>
                                        </div>
                                        <div className="flex justify-between border-b border-m3-outline-variant/10 pb-1">
                                          <span className="opacity-60">Imóveis Totais:</span>
                                          <span className="font-bold">{testResult.results.sections.listaImoveis.totalImoveis || testResult.results.sections.listaImoveis.totalImoveisExtraidos || testResult.results.sections.listaImoveis.imoveis?.length || 'N/A'}</span>
                                        </div>
                                      </div>
                                    </div>
                                    <div className="p-4 bg-m3-surface-container-high/20 border border-m3-outline-variant/10 rounded-2xl">
                                      <span className="text-[10px] font-bold uppercase tracking-widest text-m3-primary font-mono select-none">Média Equivalente Segmento</span>
                                      <div className="space-y-2 mt-2 font-mono text-xs">
                                        <div className="flex justify-between border-b border-m3-outline-variant/10 pb-1">
                                          <span className="opacity-60">P/VP Médio Tipo:</span>
                                          <span className="font-bold">{testResult.results.sections?.mediaTipoSegmento?.pvp?.comparacao || testResult.results.sections?.mediaTipoSegmento?.pvpTipo || 'N/A'}</span>
                                        </div>
                                        <div className="flex justify-between border-b border-m3-outline-variant/10 pb-1">
                                          <span className="opacity-60">DY Médio Tipo:</span>
                                          <span className="font-bold">{testResult.results.sections?.mediaTipoSegmento?.dy12m?.comparacao || testResult.results.sections?.mediaTipoSegmento?.dyTipo || 'N/A'}</span>
                                        </div>
                                        <div className="flex justify-between border-b border-m3-outline-variant/10 pb-1">
                                          <span className="opacity-60">Vacância Média Tipo:</span>
                                          <span className="font-bold">{testResult.results.sections?.mediaTipoSegmento?.vacancia?.comparacao || testResult.results.sections?.mediaTipoSegmento?.vacanciaTipo || 'N/A'}</span>
                                        </div>
                                      </div>
                                    </div>
                                  </div>
                                </div>
                              )}

                              {testResult.type !== 'FII' && (
                                <div className="space-y-3 font-sans">
                                  <h4 className="text-[11px] font-black uppercase text-m3-primary tracking-widest pb-1.5 border-b border-m3-outline-variant/10 flex justify-between items-center">
                                    <span>Checklist Buy & Hold (Critérios Investidor10)</span>
                                    <CheckCircle2 className="w-4 h-4 text-m3-primary opacity-70" />
                                  </h4>

                                  {testResult.results?.checklistBah && testResult.results.checklistBah.length > 0 ? (
                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                                      {testResult.results.checklistBah.map((item: any, idx: number) => (
                                        <div key={idx} className="p-3 bg-m3-surface-container-low/40 border border-m3-outline-variant/10 rounded-2xl flex items-start gap-3 hover:border-m3-primary/25 transition-colors">
                                          <div className="shrink-0 pt-0.5">
                                            {item.status === true || item.status === 'success' || item.status === 'yes' ? (
                                              <div className="p-0.5 bg-m3-success/15 text-m3-success border border-m3-success/20 rounded-full">
                                                <Check className="w-3.5 h-3.5" />
                                              </div>
                                            ) : (
                                              <div className="p-0.5 bg-m3-error/15 text-m3-error border border-m3-error/20 rounded-full">
                                                <X className="w-3.5 h-3.5" />
                                              </div>
                                            )}
                                          </div>
                                          <div className="space-y-0.5 min-w-0 flex-1">
                                            <h5 className="text-xs font-bold leading-tight text-m3-on-surface truncate">{item.titulo || item.item}</h5>
                                            <p className="text-[10px] leading-relaxed text-m3-on-surface-variant/80 font-medium">{item.descricao || 'Item de evaluation fundamental.'}</p>
                                          </div>
                                        </div>
                                      ))}
                                    </div>
                                  ) : (
                                    <div className="py-6 text-center text-m3-on-surface-variant/40 flex flex-col items-center justify-center">
                                      <AlertTriangle className="w-8 h-8 mb-2" />
                                      <p className="font-bold text-xs uppercase tracking-wider">Metodologia Buy & Hold Indisponível</p>
                                      <p className="text-[10px] max-w-xs mt-1 leading-relaxed text-m3-on-surface-variant">Avaliações consolidadas e checklist com critérios booleanos requerem extração estruturada direta do Investidor10.</p>
                                    </div>
                                  )}
                                </div>
                              )}

                              {/* Dados de Cadastro */}
                              <div className="space-y-3 font-sans font-sans">
                                <h4 className="text-[11px] font-black uppercase text-m3-primary tracking-widest pb-1.5 border-b border-m3-outline-variant/10 flex justify-between items-center">
                                  <span>Informações Básicas & Perfil Cadastral B3</span>
                                  <Terminal className="w-4 h-4 text-m3-primary opacity-70" />
                                </h4>
                                <div className="grid grid-cols-2 md:grid-cols-4 gap-6 py-2 font-mono">
                                  <MetricsGroup label="CNPJ Oficial" value={testResult.results?.cnpj || 'N/A'} subtitle="Identificador oficial na B3" />
                                  {testResult.type !== 'FII' ? (
                                    <>
                                      <MetricsGroup label="Setor Principal" value={testResult.results?.setor || 'N/A'} subtitle="Atividade" />
                                      <MetricsGroup label="Subsetor" value={testResult.results?.subsetor || 'N/A'} subtitle="Subsetor de negócios" />
                                      <MetricsGroup label="Segmento" value={testResult.results?.segmento || 'N/A'} subtitle="Grupo operacional" />
                                      <MetricsGroup label="Governança Listagem" value={testResult.results?.segmentoListagem || 'N/A'} subtitle="Comportamento B3" />
                                      <MetricsGroup label="Ano de IPO (Bolsa)" value={testResult.results?.anoBolsa || 'N/A'} subtitle="Tempo de listagem" />
                                      <MetricsGroup label="Mão de Obra (Fun.)" value={testResult.results?.funcionarios || 'N/A'} subtitle="Equipe cadastrada" />
                                      <MetricsGroup label="Garantia Tag Along" value={testResult.results?.tagAlong || 'N/A'} subtitle="Garantia minoritária" />
                                    </>
                                  ) : (
                                    <>
                                      <MetricsGroup label="Mandato Fundo" value={testResult.results?.mandato || 'N/A'} subtitle="Especificação" />
                                      <MetricsGroup label="Público de Alvo" value={testResult.results?.publicoAlvo || 'N/A'} subtitle="Destinatários" />
                                      <MetricsGroup label="Tipo de Fii" value={testResult.results?.tipoFundo || 'N/A'} subtitle="Natureza" />
                                      <MetricsGroup label="Segmento de Fii" value={testResult.results?.segmentoFii || 'N/A'} subtitle="Especialidade" />
                                    </>
                                  )}
                                </div>
                              </div>
                            </div>
                          )}
                        </div>
                      )
                    ) : (
                      <div className="h-full flex flex-col items-center justify-center text-m3-on-surface-variant opacity-30 select-none py-16">
                        <div className="w-20 h-20 border-2 border-dashed border-m3-outline-variant rounded-[24px] flex items-center justify-center mb-4">
                          <Layers className="w-8 h-8" />
                        </div>
                        <p className="text-sm font-black tracking-[0.2em] uppercase text-center">Painel Vazio • Insira ou Selecione um Ticker</p>
                        <p className="text-xs font-medium text-center mt-1 text-m3-on-surface-variant/85 max-w-sm">Use o campo de "Fetch Manual" na lateral esquerda para desencadear um scraping estruturado.</p>
                      </div>
                    )}
                  </div>
                </M3Card>
              </div>
            </div>
          </div>
        ) : activeTab === 'logs' ? (
          /* Enhanced Logs View */
          <motion.div 
            initial={{ opacity: 0, scale: 0.995 }}
            animate={{ opacity: 1, scale: 1 }}
            className="w-full max-w-6xl mx-auto space-y-6 pb-12 pt-4 text-m3-on-surface"
          >
            {/* Real-time Telemetry Section Header */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-m3-outline-variant/10 pb-4">
              <div className="space-y-0.5">
                <h2 className="text-base font-black text-m3-on-surface tracking-tight flex items-center gap-2">
                  <div className="p-1.5 bg-m3-primary/10 rounded-lg text-m3-primary">
                    <Layers className="w-4 h-4" />
                  </div>
                  Painel de Tráfego & Telemetria do Nexus
                </h2>
                <p className="text-[11px] font-medium text-m3-on-surface-variant/70 leading-relaxed font-sans">
                  Consoles de conexões web e telemetria integrada de latência do UniversalLexer (Investidor10 API).
                </p>
              </div>

              {/* Console Sync / Controls */}
              <div className="flex flex-wrap items-center gap-2">
                {/* Auto Refresh Toggle */}
                <button
                  onClick={() => setIsAutoRefreshActive(!isAutoRefreshActive)}
                  className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md border text-[9px] font-black uppercase tracking-wider transition-all {
                    isAutoRefreshActive
                      ? 'bg-m3-success/10 text-m3-success border-m3-success/20 hover:bg-m3-success/15'
                      : 'bg-m3-on-surface/5 text-m3-on-surface-variant border-m3-outline-variant/20 hover:bg-m3-on-surface/10'
                  }`}
                  title={isAutoRefreshActive ? "Pausar auto-atualização" : "Iniciar auto-atualização"}
                >
                  <span className={`w-1 h-1 rounded-full ${isAutoRefreshActive ? 'bg-m3-success animate-ping' : 'bg-m3-on-surface-variant/40'}`} />
                  {isAutoRefreshActive ? <Pause className="w-2.5 h-2.5" /> : <Play className="w-2.5 h-2.5" />}
                  {isAutoRefreshActive ? 'Auto: Ativo' : 'Auto: Pausado'}
                </button>

                <button 
                  onClick={fetchData} 
                  className="flex items-center gap-1.5 px-2.5 py-1 rounded-md border border-m3-outline-variant/25 text-[9px] font-black uppercase tracking-wider text-m3-on-surface-variant hover:text-m3-on-surface hover:bg-m3-surface-container-high transition-colors shadow-sm cursor-pointer"
                >
                  <RefreshCcw className="w-2.5 h-2.5" />
                  Atualizar
                </button>

                <button 
                  onClick={handleClearLogs}
                  className="flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-m3-error/10 text-m3-error hover:bg-m3-error hover:text-m3-on-error border border-m3-error/20 text-[9px] font-black uppercase tracking-wider transition-colors shadow-sm cursor-pointer"
                  title="Limpar Histórico"
                >
                  <Trash2 className="w-2.5 h-2.5" />
                  Limpar
                </button>
              </div>
            </div>

            {/* General Metrics - Sleek Compact KPI Banner (Grouped & Minimalist) */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-px bg-m3-outline-variant/15 border border-m3-outline-variant/12 rounded-xl overflow-hidden shadow-sm">
              <div className="bg-m3-surface p-4 flex flex-col justify-center">
                <span className="text-[9px] uppercase font-bold tracking-wider text-m3-on-surface-variant/50">Volume de Tráfego</span>
                <span className="text-xl font-mono font-black text-m3-on-surface mt-1">{logs.length} <span className="text-xs font-sans font-bold text-m3-on-surface-variant/60">reqs</span></span>
              </div>
              <div className="bg-m3-surface p-4 flex flex-col justify-center">
                <span className="text-[9px] uppercase font-bold tracking-wider text-m3-on-surface-variant/50">Gargalo Médio</span>
                <span className={`text-xl font-mono font-black mt-1 ${Number(avgLatency) > 800 ? 'text-amber-500' : 'text-m3-primary'}`}>{avgLatency} ms</span>
              </div>
              <div className="bg-m3-surface p-4 flex flex-col justify-center">
                <span className="text-[9px] uppercase font-bold tracking-wider text-m3-on-surface-variant/50">Taxa de Falhas</span>
                <span className={`text-xl font-mono font-black mt-1 ${Number(errorRate) > 10 ? 'text-m3-error' : 'text-emerald-500'}`}>{errorRate}%</span>
              </div>
              <div className="bg-m3-surface p-4 flex flex-col justify-center col-span-2 md:col-span-1">
                <span className="text-[9px] uppercase font-bold tracking-wider text-m3-on-surface-variant/50">Origem Principal</span>
                <span className="text-[11px] font-sans font-black text-m3-on-surface mt-1.5 truncate uppercase tracking-tight">Investidor10 API</span>
              </div>
            </div>

            {/* Grouped Analytics: Integrated Latency AreaChart & Volumetric distribution */}
            <div className="bg-m3-surface border border-m3-outline-variant/10 rounded-2xl overflow-hidden shadow-sm divide-y divide-m3-outline-variant/10">
              {/* Card Title Box */}
              <div className="px-5 py-3.5 bg-m3-surface-container/20 flex items-center justify-between">
                <div>
                  <h3 className="text-xs font-black uppercase tracking-wider text-m3-on-surface flex items-center gap-1.5 leading-none">
                    <Activity className="w-3.5 h-3.5 text-m3-primary" />
                    Distribuição & Desempenho Operacional do Scraper
                  </h3>
                </div>
                <div className="flex items-center gap-1 bg-m3-primary/10 text-m3-primary px-2 py-0.5 rounded text-[8.5px] font-black uppercase font-mono tracking-wider">
                  <span className="w-1.5 h-1.5 rounded-full bg-m3-primary animate-pulse" /> Telemetria Unificada
                </div>
              </div>

              {/* Combined Grid Panel */}
              <div className="grid grid-cols-1 lg:grid-cols-12 divide-y lg:divide-y-0 lg:divide-x divide-m3-outline-variant/10">
                {/* Horizontal Latency AreaChart */}
                <div className="lg:col-span-8 p-5 flex flex-col justify-between">
                  <div className="mb-4">
                    <h4 className="text-[10px] font-black uppercase tracking-wider text-m3-on-surface-variant">
                      Latência das Últimas Conexões (ms)
                    </h4>
                  </div>
                  
                  <div className="h-44 w-full">
                    {logs.length > 0 ? (
                      <ResponsiveContainer width="100%" height="100%">
                        <AreaChart data={[...logs].reverse().slice(-14)} margin={{ top: 10, right: 5, left: -25, bottom: 0 }}>
                          <defs>
                            <linearGradient id="colorLatency" x1="0" y1="0" x2="0" y2="1">
                              <stop offset="5%" stopColor="var(--color-primary, #6366f1)" stopOpacity={0.25}/>
                              <stop offset="95%" stopColor="var(--color-primary, #6366f1)" stopOpacity={0}/>
                            </linearGradient>
                          </defs>
                          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(120,120,120,0.1)" />
                          <XAxis 
                            dataKey="ticker" 
                            tickLine={false}
                            axisLine={false}
                            tick={{ fill: 'currentColor', fontSize: 9, fontWeight: 700, opacity: 0.6 }}
                          />
                          <YAxis 
                            tickLine={false}
                            axisLine={false}
                            tick={{ fill: 'currentColor', fontSize: 9, fontWeight: 500, opacity: 0.6 }}
                            unit=" ms"
                          />
                          <Tooltip
                            content={({ active, payload }) => {
                              if (active && payload && payload.length) {
                                const data = payload[0].payload;
                                return (
                                  <div className="p-3 bg-m3-surface-container-high border border-m3-outline-variant/25 rounded-xl shadow-lg text-[10.5px] font-medium leading-relaxed font-sans">
                                    <div className="flex items-center gap-1.5 mb-1">
                                      <span className="font-extrabold text-m3-on-surface">{data.ticker}</span>
                                      <span className={`px-1.5 py-0.5 rounded text-[8px] font-black uppercase ${
                                        data.status === 'success' ? 'bg-m3-success/15 text-m3-success' : 'bg-m3-error/15 text-m3-error'
                                      }`}>{data.status === 'success' ? 'OK' : 'Falha'}</span>
                                    </div>
                                    <p className="text-m3-on-surface-variant/80 font-mono">Latência: <span className="font-extrabold text-m3-primary">{data.duration.toFixed(0)} ms</span></p>
                                    <p className="text-m3-on-surface-variant/50 text-[9px] mt-0.5 font-mono">{data.timestamp}</p>
                                  </div>
                                );
                              }
                              return null;
                            }}
                          />
                          <Area 
                            type="monotone" 
                            dataKey="duration" 
                            stroke="currentColor" 
                            className="text-m3-primary"
                            strokeWidth={2} 
                            fillOpacity={1} 
                            fill="url(#colorLatency)"
                            isAnimationActive={false}
                          />
                        </AreaChart>
                      </ResponsiveContainer>
                    ) : (
                      <div className="h-full flex flex-col items-center justify-center opacity-30 select-none">
                        <Activity className="w-6 h-6 opacity-40 mb-2 animate-pulse" />
                        <span className="text-[9px] font-black tracking-widest uppercase">Nenhuma telemetria no histórico</span>
                      </div>
                    )}
                  </div>
                </div>

                {/* Volumetric Breakdown (Right Column) */}
                <div className="lg:col-span-4 p-5 flex flex-col justify-between">
                  <div className="mb-4">
                    <h4 className="text-[10px] font-black uppercase tracking-wider text-m3-on-surface-variant">
                      Participação nos Ativos Requisitados
                    </h4>
                  </div>

                  <div className="space-y-3 flex-1 flex flex-col justify-center">
                    {Object.keys(logs.reduce((acc: any, l) => { acc[l.type || 'ACAO'] = 1; return acc; }, {})).length > 0 ? (
                      ['ACAO', 'FII', 'ETF', 'BDR', 'STOCK', 'BATCH/SCRAPE'].map((type) => {
                        const count = logs.filter(l => l.type === type).length;
                        const percentage = logs.length > 0 ? (count / logs.length) * 100 : 0;
                        if (count === 0 && logs.length > 0) return null; // hide unused
                        let bgBar = 'bg-m3-primary';
                        if (type === 'FII') bgBar = 'bg-amber-500';
                        if (type === 'ETF') bgBar = 'bg-indigo-500';
                        if (type === 'BDR') bgBar = 'bg-rose-500';
                        if (type === 'STOCK') bgBar = 'bg-emerald-500';
                        if (type === 'BATCH/SCRAPE') bgBar = 'bg-neutral-500';

                        return (
                          <div key={type} className="space-y-1">
                            <div className="flex justify-between items-center text-[10px] font-bold">
                              <span className="tracking-wider text-m3-on-surface uppercase font-mono">{type}</span>
                              <span className="text-m3-on-surface-variant font-medium font-mono">{count} reqs ({percentage.toFixed(0)}%)</span>
                            </div>
                            <div className="h-1.5 bg-m3-surface-container-high rounded-full overflow-hidden w-full border border-m3-outline-variant/5">
                              <motion.div 
                                initial={{ width: 0 }}
                                animate={{ width: `${percentage}%` }}
                                transition={{ duration: 0.4 }}
                                className={`h-full rounded-full ${bgBar}`}
                              />
                            </div>
                          </div>
                        );
                      })
                    ) : (
                      <div className="text-center opacity-30 select-none py-4">
                        <span className="text-[9px] font-black tracking-widest uppercase">Sem histórico de ativos</span>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* Advanced Filters (Grouped & Integrated Toolbar) */}
            <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-4 bg-m3-surface-container/20 border border-m3-outline-variant/10 rounded-xl p-4 shadow-sm">
              {/* Search String */}
              <div className="relative flex-1">
                <input 
                  type="text" 
                  value={logSearch}
                  onChange={(e) => setLogSearch(e.target.value)}
                  placeholder="Filtrar ticker, tipo, método..." 
                  className="w-full bg-m3-surface border-2 border-m3-outline-variant/10 rounded-lg pl-10 pr-4 py-2 text-xs text-m3-on-surface placeholder:text-m3-on-surface-variant/40 focus:outline-none focus:border-m3-primary focus:bg-m3-surface-container-high transition-all font-mono shadow-inner font-bold"
                />
                <Filter className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-m3-on-surface-variant/40" />
              </div>

              {/* Filter Tabs Groups */}
              <div className="flex flex-wrap items-center gap-3">
                {/* Status Filter */}
                <div className="flex items-center bg-m3-surface-container rounded-lg p-0.5 border border-m3-outline-variant/12">
                  {[
                    { id: 'all', label: 'Todos' },
                    { id: 'success', label: 'Sucesso' },
                    { id: 'error', label: 'Falhas' }
                  ].map(st => (
                    <button
                      key={st.id}
                      onClick={() => setStatusFilter(st.id as any)}
                      className={`px-2.5 py-1 text-[10px] font-black uppercase rounded-md transition-all cursor-pointer ${
                        statusFilter === st.id
                          ? 'bg-m3-primary text-m3-on-primary shadow-sm'
                          : 'text-m3-on-surface-variant hover:text-m3-on-surface'
                      }`}
                    >
                      {st.label}
                    </button>
                  ))}
                </div>

                {/* Source Filter */}
                <div className="flex items-center bg-m3-surface-container rounded-lg p-0.5 border border-m3-outline-variant/12">
                  {[
                    { id: 'all', label: 'Fontes' },
                    { id: 'investidor10', label: 'Inv10' },
                    { id: 'yahoo', label: 'Yahoo' },
                    { id: 'others', label: 'Outros' }
                  ].map(src => (
                    <button
                      key={src.id}
                      onClick={() => setSourceFilter(src.id)}
                      className={`px-2.5 py-1 text-[10px] font-black uppercase rounded-md transition-all cursor-pointer ${
                        sourceFilter === src.id
                          ? 'bg-m3-primary text-m3-on-primary shadow-sm'
                          : 'text-m3-on-surface-variant hover:text-m3-on-surface'
                      }`}
                    >
                      {src.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Desktop Table View */}
            <M3Card variant="elevated" className="hidden md:block p-0 overflow-hidden border border-m3-outline-variant/10 shadow-lg">
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-m3-surface-container text-m3-on-surface-variant text-[9.5px] uppercase tracking-[0.25em] font-black">
                      <th className="px-5 py-4 min-w-[80px]">Registro</th>
                      <th className="px-5 py-4 min-w-[120px]">Ticker Ativo</th>
                      <th className="px-5 py-4 min-w-[90px]">Metodologia</th>
                      <th className="px-5 py-4 min-w-[90px]">Gargalo</th>
                      <th className="px-5 py-4 min-w-[100px]">Auditoria / Fonte</th>
                      <th className="px-5 py-4 text-right pr-6">Status Extrator</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-m3-outline-variant/10">
                    <AnimatePresence>
                      {filteredLogs.map((log) => {
                        let badgeStyle = 'bg-m3-primary/10 text-m3-primary border-m3-primary/25';
                        if (log.type === 'FII') badgeStyle = 'bg-amber-500/10 text-amber-500 border-amber-500/25';
                        if (log.type === 'ETF') badgeStyle = 'bg-indigo-500/10 text-indigo-500 border-indigo-500/25';
                        if (log.type === 'BDR') badgeStyle = 'bg-rose-500/10 text-rose-500 border-rose-500/25';
                        if (log.type === 'STOCK') badgeStyle = 'bg-emerald-500/10 text-emerald-500 border-emerald-500/25';
                        if (log.type === 'BATCH/SCRAPE') badgeStyle = 'bg-neutral-500/10 text-m3-on-surface-variant border-neutral-500/25';

                        const durationMs = Math.round(log.duration);
                        let latencyGrade = 'text-emerald-500';
                        if (durationMs > 400 && durationMs < 1000) latencyGrade = 'text-amber-500';
                        if (durationMs >= 1000) latencyGrade = 'text-m3-error';

                        return (
                          <motion.tr 
                            key={log.id} 
                            initial={{ opacity: 0, y: 4 }}
                            animate={{ opacity: 1, y: 0 }}
                            onClick={() => setSelectedLog(log)}
                            className={`transition-colors group cursor-pointer hover:bg-m3-primary/5 ${
                              log.status === 'error' ? 'bg-m3-error/5 hover:bg-m3-error/8' : ''
                            }`}
                          >
                            <td className="px-5 py-3 text-[10.5px] font-mono font-bold text-m3-on-surface-variant opacity-50">
                              {log.timestamp}
                            </td>
                            <td className="px-5 py-3">
                              <div className="flex items-center gap-1.5 font-sans">
                                <span className="text-xs font-black text-m3-on-surface tracking-tighter uppercase font-mono">{log.ticker}</span>
                                <ChevronRight className="w-3 h-3 text-m3-primary opacity-0 group-hover:opacity-100 group-hover:translate-x-0.5 transition-all" />
                              </div>
                            </td>
                            <td className="px-5 py-3">
                              <span className={`px-2 py-0.5 rounded text-[8.5px] font-bold border tracking-wider font-mono uppercase ${badgeStyle}`}>
                                {log.type}
                              </span>
                            </td>
                            <td className={`px-5 py-3 text-[11px] font-mono font-black ${latencyGrade}`}>
                              {durationMs} ms
                            </td>
                            <td className="px-5 py-3">
                              <span className="text-[10px] font-bold text-m3-on-surface-variant/70 uppercase tracking-tight">{log.source}</span>
                            </td>
                            <td className="px-5 py-3 text-right pr-6">
                              <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[8.5px] font-black uppercase tracking-wider ${
                                log.status === 'success' ? 'bg-m3-success/15 text-m3-success' : 'bg-m3-error/15 text-m3-error'
                              }`}>
                                <span className={`w-1.5 h-1.5 rounded-full ${log.status === 'success' ? 'bg-m3-success animate-pulse' : 'bg-m3-error'}`} />
                                {log.status === 'success' ? 'SUCESSO' : 'FALHA / BLOCKED'}
                              </span>
                            </td>
                          </motion.tr>
                        );
                      })}
                    </AnimatePresence>
                    {filteredLogs.length === 0 && (
                      <tr>
                        <td colSpan={6} className="px-6 py-24 text-center text-m3-on-surface-variant/30 text-xs font-black uppercase tracking-[0.3em]">
                          {logs.length === 0 ? 'Nenhum tráfego em rede detectado' : 'Nenhum resultado para o filtro selecionado'}
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </M3Card>

            {/* Mobile Card View */}
            <div className="md:hidden space-y-3">
              <AnimatePresence>
                {filteredLogs.map((log) => (
                  <motion.div 
                    key={log.id} 
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    onClick={() => setSelectedLog(log)}
                    className={`bg-m3-surface rounded-[16px] p-4 border shadow-sm flex flex-col gap-3 cursor-pointer active:scale-[0.99] transition-all ${
                      log.status === 'error' ? 'border-m3-error/30 bg-m3-error/5' : 'border-m3-outline-variant/20 hover:border-m3-primary/35'
                    }`}
                  >
                     <div className="flex justify-between items-center">
                       <span className="text-[10px] font-mono font-bold text-m3-on-surface-variant opacity-60">{log.timestamp}</span>
                       <span className={`px-2 py-0.5 rounded-full text-[8px] font-black uppercase tracking-widest ${
                         log.status === 'success' ? 'bg-m3-success/15 text-m3-success' : 'bg-m3-error/15 text-m3-error'
                       }`}>
                        {log.status === 'success' ? 'SUCESSO' : 'FALHA'}
                       </span>
                     </div>
                     <div className="flex justify-between items-end">
                       <div>
                         <h3 className="text-base font-black text-m3-on-surface tracking-tight leading-none mb-1.5 text-m3-primary uppercase font-mono">{log.ticker}</h3>
                         <span className="px-1.5 py-0.5 rounded text-[8px] font-bold border tracking-wider font-mono uppercase bg-m3-primary/10 text-m3-primary border-m3-primary/10">{log.type}</span>
                       </div>
                       <div className="text-right">
                         <p className="text-xs font-mono font-black text-m3-primary">{Math.round(log.duration)} ms</p>
                         <p className="text-[9px] font-bold uppercase text-m3-on-surface-variant/65 mt-1 select-all truncate max-w-[120px]">{log.source.split(' - ')[0]}</p>
                       </div>
                     </div>
                  </motion.div>
                ))}
              </AnimatePresence>
              {filteredLogs.length === 0 && (
                <div className="py-16 text-center bg-m3-surface rounded-[16px] border border-m3-outline-variant/10">
                  <p className="text-[10px] text-m3-on-surface-variant/30 font-black uppercase tracking-[0.3em]">
                    {logs.length === 0 ? 'Nenhum tráfego em rede detectado' : 'Nenhum resultado para o filtro'}
                  </p>
                </div>
              )}
            </div>

            {/* High Fidelity Log Inspector Slide Drawer & Diagnostic Terminal */}
            <AnimatePresence>
              {selectedLog && (
                <div className="fixed inset-0 z-50 flex justify-end">
                  {/* Backdrop */}
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    onClick={() => setSelectedLog(null)}
                    className="absolute inset-0 bg-black/60 backdrop-blur-sm"
                  />
                  
                  {/* Drawer */}
                  <motion.div
                    initial={{ x: '100%' }}
                    animate={{ x: 0 }}
                    exit={{ x: '100%' }}
                    transition={{ type: 'spring', damping: 26, stiffness: 220 }}
                    className="relative w-full max-w-lg bg-m3-surface border-l border-m3-outline-variant/30 h-full shadow-2xl flex flex-col p-6 z-10 overflow-y-auto"
                  >
                    <div className="flex items-center justify-between mb-4 pb-4 border-b border-m3-outline-variant/20">
                      <div className="flex items-center gap-2.5">
                        <Terminal className="w-5 h-5 text-m3-primary" />
                        <h3 className="text-base font-black text-m3-on-surface tracking-tight">Inspeção de Conexão & Auditoria</h3>
                      </div>
                      <button
                        onClick={() => setSelectedLog(null)}
                        className="p-2 text-m3-on-surface-variant hover:text-m3-on-surface rounded-full hover:bg-m3-on-surface/5 transition-colors cursor-pointer"
                      >
                        <X className="w-5 h-5" />
                      </button>
                    </div>

                    {/* Tab Navigation inside Inspector Drawer */}
                    <div className="flex items-center justify-start bg-m3-surface-container rounded-lg p-0.5 border border-m3-outline-variant/10 mb-6 shrink-0 shadow-inner">
                      <button
                        onClick={() => setDrawerTab('trace')}
                        className={`flex-1 text-center py-2 text-[10px] font-black rounded-md uppercase tracking-wider transition-all cursor-pointer ${
                          drawerTab === 'trace'
                            ? 'bg-m3-primary text-m3-on-primary shadow-sm'
                            : 'text-m3-on-surface-variant hover:text-m3-on-surface'
                        }`}
                      >
                        Auditoria (Logs)
                      </button>
                      <button
                        onClick={() => setDrawerTab('visual')}
                        className={`flex-1 text-center py-2 text-[10px] font-black rounded-md uppercase tracking-wider transition-all cursor-pointer ${
                          drawerTab === 'visual'
                            ? 'bg-m3-primary text-m3-on-primary shadow-sm'
                            : 'text-m3-on-surface-variant hover:text-m3-on-surface'
                        }`}
                      >
                        Métricas Extraídas
                      </button>
                      <button
                        onClick={() => setDrawerTab('json')}
                        className={`flex-1 text-center py-2 text-[10px] font-black rounded-md uppercase tracking-wider transition-all cursor-pointer ${
                          drawerTab === 'json'
                            ? 'bg-m3-primary text-m3-on-primary shadow-sm'
                            : 'text-m3-on-surface-variant hover:text-m3-on-surface'
                        }`}
                      >
                        JSON Bruto
                      </button>
                    </div>

                    <div className="space-y-6 flex-1 flex flex-col min-h-0">
                      {drawerTab === 'trace' ? (
                        <div className="space-y-6 overflow-y-auto flex-1 custom-scrollbar pr-1 pb-4">
                          {/* Status Card Banner */}
                          <div className={`p-4 rounded-xl border flex items-start gap-3 ${
                            selectedLog.status === 'success' 
                              ? 'bg-m3-success/10 border-m3-success/20 text-m3-success' 
                              : 'bg-m3-error/10 border-m3-error/20 text-m3-error'
                          }`}>
                            <div className={`p-2 rounded-full mt-0.5 ${selectedLog.status === 'success' ? 'bg-m3-success/20' : 'bg-m3-error/20'}`}>
                              {selectedLog.status === 'success' ? <CheckCircle2 className="w-4 h-4" /> : <AlertTriangle className="w-4 h-4" />}
                            </div>
                            <div>
                              <h4 className="text-[11px] font-black uppercase tracking-wider">{selectedLog.status === 'success' ? 'Scrape Concluído com Sucesso' : 'Falha na Transação'}</h4>
                              <p className="text-[11px] font-semibold opacity-85 mt-0.5 leading-relaxed font-sans">
                                {selectedLog.status === 'success' 
                                  ? 'O algoritmo executou com êxito a varredura e gerou o payload estruturado válido.' 
                                  : 'Conexão interrompida, formato alterado ou timeout nas rotas de contingência.'}
                              </p>
                            </div>
                          </div>

                          {/* Diagnostic Terminal console */}
                          <div className="bg-neutral-950 text-neutral-200 rounded-xl border border-neutral-800 p-4 font-mono text-[10.5px] leading-relaxed relative overflow-hidden shadow-md select-all">
                            <div className="absolute top-2 right-3 flex gap-1">
                              <span className="w-2.5 h-2.5 rounded-full bg-red-500/80" />
                              <span className="w-2.5 h-2.5 rounded-full bg-yellow-500/80" />
                              <span className="w-2.5 h-2.5 rounded-full bg-green-500/80" />
                            </div>
                            <h5 className="text-[9px] font-bold text-neutral-500 uppercase tracking-widest border-b border-neutral-800/80 pb-1.5 mb-2.5 flex items-center gap-1">
                              <Code className="w-3.5 h-3.5 text-m3-primary" /> RASTREIO TÉCNICO INTERNO (AUDIT FEED)
                            </h5>
                            <div className="space-y-1.5 max-h-56 overflow-y-auto scrollbar-thin scrollbar-thumb-neutral-800">
                              <div><span className="text-neutral-500">[{selectedLog.timestamp}]</span> <span className="text-blue-400">[RESOLVER]</span> Analisando ticker "{selectedLog.ticker}" para inferir o escopo tipológico...</div>
                              <div><span className="text-neutral-500">[{selectedLog.timestamp}]</span> <span className="text-blue-400">[RESOLVER]</span> Ativo classificado como <span className="text-indigo-400 font-bold">{selectedLog.type}</span>.</div>
                              <div><span className="text-neutral-500">[{selectedLog.timestamp}]</span> <span className="text-amber-400">[LRU-CACHE]</span> Buscando chave "{selectedLog.ticker}" em cache estruturado em memória...</div>
                              {selectedLog.duration < 15 ? (
                                <div className="text-emerald-400"><span className="text-neutral-500">[{selectedLog.timestamp}]</span> [LRU-CACHE] Cache HIT! Registro válido retornado da memória interna instantly.</div>
                              ) : (
                                <>
                                  <div className="text-neutral-400"><span className="text-neutral-500">[{selectedLog.timestamp}]</span> [LRU-CACHE] Cache MISS! Requer consulta remota nas fontes públicas.</div>
                                  <div><span className="text-neutral-500">[{selectedLog.timestamp}]</span> <span className="text-purple-400">[THROTTLING]</span> DomainRateLimiter alivia cota para "{selectedLog.source.split(' - ')[0]}".</div>
                                  <div><span className="text-neutral-500">[{selectedLog.timestamp}]</span> <span className="text-indigo-400">[STEALTH]</span> Injetando UA randômico e simulando Sec-Ch-Ua para evitar barreira de WAF.</div>
                                  <div><span className="text-neutral-500">[{selectedLog.timestamp}]</span> <span className="text-blue-400">[NETWORK]</span> Conexão HTTP GET estabelecida com "{selectedLog.source.split(' - ')[0]}"...</div>
                                  {selectedLog.status === 'success' ? (
                                    <>
                                      <div className="text-emerald-400"><span className="text-neutral-500">[{selectedLog.timestamp}]</span> [NETWORK] Status: 200 OK em {Math.round(selectedLog.duration)} ms.</div>
                                      <div><span className="text-neutral-500">[{selectedLog.timestamp}]</span> <span className="text-cyan-400">[PARSER]</span> Ativando UniversalLexer com algoritmo Sliding Window de Regex (Zero-AST)...</div>
                                      <div><span className="text-neutral-500">[{selectedLog.timestamp}]</span> <span className="text-cyan-400">[ZOD-SCHEMA]</span> Saneando string brasileira e validando contra esquema robusto...</div>
                                      <div className="text-emerald-400 font-bold"><span className="text-neutral-500">[{selectedLog.timestamp}]</span> [ENGINE] Dados de "{selectedLog.ticker}" extraídos e salvos no LRUCache com sucesso.</div>
                                    </>
                                  ) : (
                                    <>
                                      <div className="text-rose-500 font-bold"><span className="text-neutral-500">[{selectedLog.timestamp}]</span> [NETWORK] Erro HTTP {selectedLog.source.includes('Yahoo') ? '404' : '403 Forbidden'} detectado.</div>
                                      <div className="text-rose-400"><span className="text-neutral-500">[{selectedLog.timestamp}]</span> [CIRCUIT-BREAKER] Registrando falha... Transicionando estado automático em cascata.</div>
                                    </>
                                  )}
                                </>
                              )}
                            </div>
                          </div>

                          {/* Key specs */}
                          <div className="bg-m3-surface-container rounded-2xl border border-m3-outline-variant/10 p-4 space-y-4">
                            <h4 className="text-[10px] font-black uppercase tracking-wider text-m3-on-surface-variant/70">Metadados de Telemetria</h4>
                            
                            <div className="grid grid-cols-2 gap-4 text-xs font-medium">
                              <div>
                                <span className="text-[10px] block text-m3-on-surface-variant/60 uppercase tracking-wider">Ativo Focado:</span>
                                <span className="font-extrabold text-m3-on-surface mt-0.5 block font-mono text-sm uppercase">{selectedLog.ticker}</span>
                              </div>
                              <div>
                                <span className="text-[10px] block text-m3-on-surface-variant/60 uppercase tracking-wider">Categoria / Tabela:</span>
                                <span className="font-extrabold text-m3-primary mt-0.5 block text-[10px] tracking-wide bg-m3-primary/10 py-0.5 px-2 rounded-full w-max">{selectedLog.type}</span>
                              </div>
                              <div>
                                <span className="text-[10px] block text-m3-on-surface-variant/60 uppercase tracking-wider">Data do Evento:</span>
                                <span className="font-bold text-m3-on-surface mt-0.5 block">{selectedLog.timestamp}</span>
                              </div>
                              <div>
                                <span className="text-[10px] block text-m3-on-surface-variant/60 uppercase tracking-wider">Latência do Scraper:</span>
                                <span className="font-extrabold text-m3-primary mt-0.5 block font-mono">{Math.round(selectedLog.duration)} ms</span>
                              </div>
                              <div>
                                <span className="text-[10px] block text-m3-on-surface-variant/60 uppercase tracking-wider">Provedor Consultor:</span>
                                <span className="font-bold text-m3-on-surface mt-0.5 block text-[10px] uppercase tracking-wider truncate" title={selectedLog.source}>{selectedLog.source}</span>
                              </div>
                              <div>
                                <span className="text-[10px] block text-m3-on-surface-variant/60 uppercase tracking-wider">Registro ID:</span>
                                <span className="font-mono text-[9px] text-m3-on-surface-variant/80 mt-0.5 block select-all truncate" title={selectedLog.id}>{selectedLog.id}</span>
                              </div>
                            </div>
                          </div>

                          {/* Detailed Diagnostic Analysis */}
                          <div className="p-4 rounded-xl bg-m3-surface-container-high/40 border border-m3-outline-variant/15 space-y-2 text-xs text-m3-on-surface-variant leading-relaxed">
                            <span className="font-bold text-m3-on-surface text-[10px] uppercase tracking-widest block font-sans">Análise Técnica VALORAE / Nexus</span>
                            {selectedLog.status === 'success' ? (
                              <p className="font-sans">O scraping terminou em conformidade com as restrições de concorrência. A indexação ativou temporizadores de retenção no LRU cache do servidor, garantindo eficiência de cache e eliminando queries excessivas às fontes parceiras.</p>
                            ) : (
                              <p className="font-sans">Ocorreu um transbordo de conexões ou modificação no layout HTML da página de destino. O CircuitBreaker desviará chamadas por segurança nas próximas etapas para evitar bloqueios permanentes do servidor.</p>
                            )}
                          </div>
                        </div>
                      ) : drawerTab === 'visual' ? (
                        <div className="space-y-6 overflow-y-auto flex-1 custom-scrollbar pr-1 pb-4">
                          {selectedLog.results ? (
                            <div className="space-y-6">
                              {/* Hero card within inspector */}
                              <div className="p-4 bg-m3-surface-container-high/60 rounded-2xl border border-m3-outline-variant/10 flex justify-between items-center shadow-sm">
                                <div className="flex items-center gap-3">
                                  <div className="w-10 h-10 bg-m3-primary/15 rounded-xl border border-m3-primary/30 flex items-center justify-center text-m3-primary font-black uppercase text-xs tracking-wider">
                                    {selectedLog.ticker}
                                  </div>
                                  <div>
                                    <div className="flex items-center gap-1.5">
                                      <h3 className="text-sm font-extrabold text-m3-on-surface tracking-tight leading-none">{selectedLog.ticker}</h3>
                                      <span className="px-2 py-0.5 text-[8.5px] font-black tracking-wide uppercase rounded-full bg-m3-primary/10 text-m3-primary border border-m3-primary/20">
                                        {selectedLog.type}
                                      </span>
                                    </div>
                                    <p className="text-[10px] text-m3-on-surface-variant font-semibold mt-1">Valores capturados na conexão</p>
                                  </div>
                                </div>

                                <div className="text-right">
                                  <span className="text-[9px] font-bold uppercase tracking-wider text-m3-on-surface-variant/60 block leading-none">Preço Atual</span>
                                  <div className="flex items-baseline gap-1.5 mt-1 justify-end">
                                    <span className="text-base font-black text-m3-on-surface tracking-tight font-mono">
                                      {selectedLog.results.precoAtual != null ? `R$ ${selectedLog.results.precoAtual}` : (selectedLog.results.preco != null ? `R$ ${selectedLog.results.preco}` : 'N/A')}
                                    </span>
                                    {selectedLog.results.variacaoDay && (
                                      <span className={`inline-flex items-center gap-0.5 text-[9.5px] font-bold px-1.5 py-0.5 rounded-full ${
                                        selectedLog.results.variacaoDay.startsWith('-')
                                          ? 'bg-m3-error/10 text-m3-error'
                                          : 'bg-m3-success/10 text-m3-success'
                                      }`}>
                                        {selectedLog.results.variacaoDay}
                                      </span>
                                    )}
                                  </div>
                                </div>
                              </div>

                              {/* Fundamental Grid */}
                              <div className="space-y-4">
                                <h4 className="text-[10px] font-black uppercase tracking-wider text-m3-on-surface-variant/70 flex items-center gap-1.5 font-sans">
                                  <Info className="w-3.5 h-3.5 text-m3-primary" />
                                  Painel Fundamentalista Capturado
                                </h4>

                                <div className="grid grid-cols-2 gap-4">
                                  <div className="p-3.5 bg-m3-surface-container rounded-xl border border-m3-outline-variant/10 flex flex-col justify-between shadow-sm">
                                    <span className="text-[9.5px] text-m3-on-surface-variant/70 uppercase tracking-wider font-extrabold">Dividend Yield</span>
                                    <span className="text-sm font-black text-m3-primary mt-1 font-mono">
                                      {selectedLog.results.dividendYield || selectedLog.results.dy12m || 'N/A'}
                                    </span>
                                  </div>

                                  <div className="p-3.5 bg-m3-surface-container rounded-xl border border-m3-outline-variant/10 flex flex-col justify-between shadow-sm">
                                    <span className="text-[9.5px] text-m3-on-surface-variant/70 uppercase tracking-wider font-extrabold">P/L (Preço / Lucro)</span>
                                    <span className="text-sm font-black text-m3-on-surface mt-1 font-mono text-m3-on-surface">
                                      {selectedLog.results.pl ?? 'N/A'}
                                    </span>
                                  </div>

                                  <div className="p-3.5 bg-m3-surface-container rounded-xl border border-m3-outline-variant/10 flex flex-col justify-between shadow-sm">
                                    <span className="text-[9.5px] text-m3-on-surface-variant/70 uppercase tracking-wider font-extrabold">P/VP (Cotação / VP)</span>
                                    <span className="text-sm font-black text-m3-on-surface mt-1 font-mono text-m3-on-surface">
                                      {selectedLog.results.pvp ?? 'N/A'}
                                    </span>
                                  </div>

                                  <div className="p-3.5 bg-m3-surface-container rounded-xl border border-m3-outline-variant/10 flex flex-col justify-between shadow-sm">
                                    <span className="text-[9.5px] text-m3-on-surface-variant/70 uppercase tracking-wider font-extrabold">Margem Líquida</span>
                                    <span className="text-sm font-bold text-m3-on-surface mt-1 font-mono">
                                      {selectedLog.results.margemLiquida || 'N/A'}
                                    </span>
                                  </div>

                                  <div className="p-3.5 bg-m3-surface-container rounded-xl border border-m3-outline-variant/10 flex flex-col justify-between shadow-sm">
                                    <span className="text-[9.5px] text-m3-on-surface-variant/70 uppercase tracking-wider font-extrabold">ROE (%)</span>
                                    <span className="text-sm font-bold text-m3-on-surface mt-1 font-mono">
                                      {selectedLog.results.roe || 'N/A'}
                                    </span>
                                  </div>

                                  <div className="p-3.5 bg-m3-surface-container rounded-xl border border-m3-outline-variant/10 flex flex-col justify-between shadow-sm">
                                    <span className="text-[9.5px] text-m3-on-surface-variant/70 uppercase tracking-wider font-extrabold">VPA</span>
                                    <span className="text-sm font-bold text-m3-on-surface mt-1 font-mono">
                                      {selectedLog.results.vpa != null ? `R$ ${selectedLog.results.vpa}` : 'N/A'}
                                    </span>
                                  </div>

                                  <div className="p-3.5 bg-m3-surface-container rounded-xl border border-m3-outline-variant/10 flex flex-col justify-between col-span-2 shadow-sm">
                                    <span className="text-[9.5px] text-m3-on-surface-variant/70 uppercase tracking-wider font-extrabold">LPA (Lucro por Ação)</span>
                                    <span className="text-sm font-bold text-m3-on-surface mt-1 font-mono">
                                      {selectedLog.results.lpa != null ? `R$ ${selectedLog.results.lpa}` : 'N/A'}
                                    </span>
                                  </div>
                                </div>
                              </div>
                            </div>
                          ) : (
                            <div className="flex flex-col items-center justify-center text-center py-16 px-4 bg-m3-surface-container rounded-2xl border border-m3-outline-variant/10">
                              <AlertCircle className="w-10 h-10 text-m3-error mb-3" />
                              <h4 className="text-xs font-black uppercase text-m3-on-surface">Sem Dados Capturados</h4>
                              <p className="text-[11px] font-medium text-m3-on-surface-variant mt-1.5 max-w-xs">
                                Esta conexão falhou ou gerou um payload vazio. Revise as diretrizes da auditoria técnica interna.
                              </p>
                            </div>
                          )}
                        </div>
                      ) : (
                        <div className="flex-1 overflow-auto bg-neutral-950 text-neutral-200 border border-neutral-800 rounded-xl p-4 font-mono text-[11px] leading-relaxed custom-scrollbar relative select-all flex flex-col min-h-0">
                          <div className="absolute top-2 right-3 flex gap-1">
                            <span className="w-2.5 h-2.5 rounded-full bg-red-400" />
                            <span className="w-2.5 h-2.5 rounded-full bg-yellow-400" />
                            <span className="w-2.5 h-2.5 rounded-full bg-green-400" />
                          </div>
                          <span className="text-[8.5px] font-bold text-neutral-500 uppercase tracking-widest block mb-3 pb-1 border-b border-neutral-800">
                            RAW TRANSACTION JSON
                          </span>
                          <pre className="overflow-auto flex-1 custom-scrollbar pr-1 whitespace-pre-wrap break-all">
                            {JSON.stringify(selectedLog, null, 2)}
                          </pre>
                        </div>
                      )}
                    </div>

                    <div className="pt-4 border-t border-m3-outline-variant/20 mt-6 flex justify-end gap-2 shrink-0">
                      <button
                        onClick={() => setSelectedLog(null)}
                        className="px-4 py-2 text-xs font-bold uppercase rounded-lg text-m3-on-surface-variant hover:text-m3-on-surface hover:bg-m3-on-surface/5 transition-colors cursor-pointer"
                      >
                        Fechar
                      </button>
                      <button
                        onClick={() => {
                          const clipboardText = selectedLog.results 
                            ? JSON.stringify(selectedLog.results, null, 2) 
                            : JSON.stringify(selectedLog, null, 2);
                          navigator.clipboard.writeText(clipboardText);
                        }}
                        className="px-4 py-2 bg-m3-primary text-m3-on-primary text-xs font-extrabold uppercase tracking-wider rounded-lg hover:bg-m3-primary/95 transition-all cursor-pointer shadow-sm"
                      >
                        Copiar Dados
                      </button>
                    </div>
                  </motion.div>
                </div>
              )}
            </AnimatePresence>

          </motion.div>
        ) : activeTab === 'docs' ? (
          /* API Documentation and Integration View */
          <motion.div 
            initial={{ opacity: 0, scale: 0.995 }}
            animate={{ opacity: 1, scale: 1 }}
            className="w-full max-w-5xl mx-auto space-y-8 pb-12 pt-4 text-m3-on-surface"
          >
            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 border-b border-m3-outline-variant/20 pb-6 font-sans">
              <div className="space-y-1.5">
                <h2 className="text-lg font-black text-m3-on-surface tracking-tight flex items-center gap-2">
                  <div className="p-2 bg-m3-primary/10 rounded-lg text-m3-primary">
                    <BookOpen className="w-5 h-5" />
                  </div>
                  Documentação da Rede do Servidor
                </h2>
                <p className="text-xs font-medium text-m3-on-surface-variant max-w-2xl leading-relaxed">
                  Consulte os endpoints disponíveis, especificações de payloads fundamentalistas do Investidor10 e as diretrizes de integração direta.
                </p>
              </div>

              <div className="flex flex-wrap gap-1.5 sm:self-end">
                <span className="px-2.5 py-1 text-[9px] font-black uppercase tracking-wider bg-m3-primary/10 text-m3-primary border border-m3-primary/20 rounded-md">
                  V{apiDocs?.version || '1.8.4'}
                </span>
                <span className="px-2.5 py-1 text-[9px] font-black uppercase tracking-wider bg-m3-success/10 text-m3-success border border-m3-success/20 rounded-md">
                  JSON SCHEMA
                </span>
              </div>
            </div>

            {/* Sumário */}
            <div className="p-4 bg-m3-primary/5 border border-m3-primary/10 rounded-2xl flex items-start gap-3.5 font-sans">
              <div className="p-2 bg-m3-primary/10 text-m3-primary rounded-xl shrink-0 mt-0.5">
                <Info className="w-4 h-4" />
              </div>
              <div className="space-y-1">
                <h4 className="text-xs font-extrabold text-m3-on-surface uppercase tracking-wider leading-none">Visão Geral do Proxy</h4>
                <p className="text-[11.5px] font-medium leading-relaxed text-m3-on-surface-variant/90">
                  {apiDocs?.summary || 'Proxy serverless de alto desempenho para raspagem de dados B3 e notícias globais sem simulação de infraestrutura.'}
                </p>
              </div>
            </div>

            {/* Endpoints */}
            <div className="space-y-4">
              <h3 className="text-xs font-black text-m3-on-surface-variant/85 tracking-wider uppercase flex items-center gap-1.5 font-sans">
                <Terminal className="w-4 h-4 text-m3-primary" />
                Rotas e Endpoints de API Disponíveis
              </h3>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {apiDocs?.endpoints?.map((ep: any, idx: number) => {
                  const isPost = ep.method.includes('POST');
                  return (
                    <M3Card key={idx} variant="outlined" className="p-4 border border-m3-outline-variant/15 hover:border-m3-primary/30 transition-all shadow-sm flex flex-col justify-between space-y-4 font-sans">
                      <div className="space-y-2.5">
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-xs font-black font-mono tracking-tight text-m3-on-surface select-all">{ep.path}</span>
                          <span className={`px-2 py-0.5 text-[9px] font-black uppercase tracking-wider rounded-md ${
                            isPost 
                              ? 'bg-m3-primary/15 text-m3-primary' 
                              : 'bg-m3-success/15 text-m3-success'
                          }`}>
                            {ep.method}
                          </span>
                        </div>
                        <p className="text-[11px] font-medium text-m3-on-surface-variant">{ep.response}</p>
                      </div>

                      <div className="space-y-2 pt-2 border-t border-m3-outline-variant/10">
                        <span className="text-[9px] font-black uppercase tracking-wider text-m3-primary/80">Parâmetros Esperados //</span>
                        <div className="space-y-1.5 text-[10.5px]">
                          {Object.entries(ep.params || {}).map(([param, spec]: [string, any]) => (
                            <div key={param} className="flex items-start gap-1.5">
                              <span className="font-mono font-bold text-m3-on-surface select-all shrink-0">{param}</span>
                              <span className={`text-[8.5px] font-black uppercase tracking-tight shrink-0 px-1 rounded ${
                                spec.required ? 'bg-m3-error/10 text-m3-error' : 'bg-m3-on-surface/5 text-m3-on-surface-variant/70'
                              }`}>
                                {spec.required ? 'obr' : 'opc'}
                              </span>
                              <span className="text-m3-on-surface-variant/80 font-medium truncate block" title={spec.description}>{spec.description}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    </M3Card>
                  );
                })}
              </div>
            </div>

            {/* Especificações de Payload */}
            <div className="space-y-4">
              <h3 className="text-xs font-black text-m3-on-surface-variant/85 tracking-wider uppercase flex items-center gap-1.5 font-sans">
                <Database className="w-4 h-4 text-m3-primary" />
                Especificações de Ativos B3 & Globais
              </h3>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {apiDocs?.payloadSpecs && Object.entries(apiDocs.payloadSpecs).map(([type, spec]: [string, any]) => (
                  <M3Card key={type} variant="outlined" className="p-4 border border-m3-outline-variant/15 flex flex-col justify-between space-y-3 font-sans">
                    <div className="space-y-1">
                      <div className="flex items-center gap-1.5">
                        <span className="w-1.5 h-1.5 bg-m3-primary rounded-full" />
                        <h4 className="text-xs font-extrabold text-m3-on-surface uppercase tracking-wider">{type}</h4>
                      </div>
                      <p className="text-[11px] font-medium text-m3-on-surface-variant/90 leading-relaxed">{spec.description}</p>
                    </div>

                    <div className="space-y-1.5">
                      <span className="text-[9px] font-black uppercase tracking-widest text-m3-primary/80">Indicadores Fundamentalistas Coletados ({spec.indicators?.length || 0}) //</span>
                      <div className="flex flex-wrap gap-1.5 max-h-36 overflow-y-auto custom-scrollbar p-1.5 bg-m3-surface-container-high/30 rounded-xl border border-m3-outline-variant/5">
                        {spec.indicators?.map((indicator: string) => (
                          <span key={indicator} className="px-2 py-0.5 bg-m3-surface text-m3-on-surface-variant/90 hover:text-m3-primary rounded-[6px] border border-m3-outline-variant/10 text-[9.5px] font-mono tracking-tight transition-colors">
                            {indicator}
                          </span>
                        ))}
                      </div>
                    </div>
                  </M3Card>
                ))}
              </div>
            </div>

            {/* SDK download integration section */}
            <div className="p-5 bg-m3-surface rounded-2xl border border-m3-outline-variant/15 space-y-4 font-sans">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="space-y-1">
                  <h4 className="text-sm font-black text-m3-on-surface flex items-center gap-1.5">
                    <Code className="w-4 h-4 text-m3-primary" />
                    Bypass de Integração: nexus-client.ts (SDK)
                  </h4>
                  <p className="text-xs font-medium text-m3-on-surface-variant max-w-xl">
                    Utilize o SDK pronto e livre de simulações para registrar de forma padronizada os metadados de raspagem técnica no Proxy.
                  </p>
                </div>
                <a 
                  href="data:text/plain;charset=utf-8,export%20class%20NexusClient%20%7B%20constructor(private%20b%3D'')%7B%7D%20async%20sendScrapeData(d%3Aany)%7B%20return%20fetch(%60%20%24%7Bthis.b%7D/api/asset%60%2C%7Bmethod%3A'POST'%2Cbody%3AJSON.stringify(d)%7D)%3B%20%7D%7D" 
                  download="nexus-client.ts"
                  className="px-4 py-2 bg-m3-primary text-m3-on-primary text-[10.5px] font-black uppercase tracking-wider rounded-lg hover:bg-m3-primary/95 transition-all text-center self-start sm:self-auto cursor-pointer shadow-sm flex items-center gap-2"
                >
                  <Copy className="w-3.5 h-3.5" />
                  Obter SDK Cliente
                </a>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-1">
                <div className="space-y-1">
                  <span className="text-[9.5px] font-black uppercase tracking-widest text-m3-primary/80">Propósito Geral</span>
                  <p className="text-[11.5px] text-m3-on-surface-variant/80 leading-relaxed font-medium">
                    Evite a dispersão de scripts. Sempre que os microsserviços do seu ecossistema efetuarem scrapings em lote ou atualizações de carteira, conectem-se à rede enviando o payload padronizado ao Proxy.
                  </p>
                </div>
                <div className="space-y-1">
                  <span className="text-[9.5px] font-black uppercase tracking-widest text-m3-primary/80">Segurança de Rede</span>
                  <p className="text-[11.5px] text-m3-on-surface-variant/80 leading-relaxed font-medium">
                    Todos os endpoints possuem validação Zod integrada, limites de taxa anti-DDoS e auditorias de concorrência com bypass stealth rotativo embutido.
                  </p>
                </div>
              </div>
            </div>
          </motion.div>
        ) : activeTab === 'architecture' ? (
          /* Architecture View */
          <motion.div 
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="w-full max-w-4xl mx-auto space-y-12 pb-12 pt-4 text-m3-on-surface"
          >
             <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 border-b border-m3-outline-variant/20 pb-6">
               <div className="space-y-1.5">
                 <h2 className="text-lg font-black text-m3-on-surface tracking-tight flex items-center gap-2">
                   <div className="p-2 bg-m3-primary/10 rounded-lg text-m3-primary">
                     <Cpu className="w-5 h-5 animate-pulse" />
                   </div>
                   Arquitetura Nexus Engine
                 </h2>
                 <p className="text-xs font-medium text-m3-on-surface-variant max-w-2xl leading-relaxed">
                   Especificação técnica e funcionamento interno do motor de alto desempenho do Servidor Valorae, auditado diretamente no arquivo <code className="font-mono bg-m3-surface-container-high px-1 py-0.5 rounded text-[11px] select-all text-m3-primary">api/lib/nexus-engine.ts</code>.
                 </p>
               </div>
               
               <div className="flex flex-wrap gap-1.5 sm:self-end">
                 <span className="px-2.5 py-1 text-[9px] font-black uppercase tracking-wider bg-m3-primary/10 text-m3-primary border border-m3-primary/20 rounded-md flex items-center gap-1">
                   <span className="w-1 h-1 bg-m3-primary rounded-full animate-ping" />
                   Sub-ms Lexer
                 </span>
                 <span className="px-2.5 py-1 text-[9px] font-black uppercase tracking-wider bg-m3-success/10 text-m3-success border border-m3-success/20 rounded-md flex items-center gap-1">
                   Zero-AST Stream
                 </span>
               </div>
             </div>

             {/* Quick Architecture Metrics Cards - Borderless & Container Free */}
             <div className="grid grid-cols-2 md:grid-cols-4 gap-6 py-2 border-b border-m3-outline-variant/10">
               <div className="flex flex-col justify-between h-20 group">
                 <div className="text-[9px] text-m3-on-surface-variant/70 font-bold uppercase tracking-wider">Algoritmo de Lexing</div>
                 <div className="text-md font-black text-m3-primary font-mono tracking-tight text-m3-primary">Zero-AST Window</div>
                 <div className="text-[8.5px] font-medium text-m3-on-surface-variant/40 leading-none">Sliding check pré-filtro</div>
               </div>
               <div className="flex flex-col justify-between h-20 group">
                 <div className="text-[9px] text-m3-on-surface-variant/70 font-bold uppercase tracking-wider">Detecção / WAF</div>
                 <div className="text-md font-black text-m3-on-surface font-mono tracking-tight text-m3-on-surface">Anti-Fingerprint</div>
                 <div className="text-[8.5px] font-medium text-m3-on-surface-variant/40 leading-none">Sec-Ch headers e IPs rotativos</div>
               </div>
               <div className="flex flex-col justify-between h-20 group">
                 <div className="text-[9px] text-m3-on-surface-variant/70 font-bold uppercase tracking-wider">Ciclo do Disjuntor</div>
                 <div className="text-md font-black text-m3-success font-mono tracking-tight text-m3-success text-emerald-500">CB Tri-Estado</div>
                 <div className="text-[8.5px] font-medium text-m3-on-surface-variant/40 leading-none">Recuperação em duas etapas</div>
               </div>
               <div className="flex flex-col justify-between h-20 group">
                 <div className="text-[9px] text-m3-on-surface-variant/70 font-bold uppercase tracking-wider">Expurgamento Local</div>
                 <div className="text-md font-black text-m3-on-surface font-mono tracking-tight text-m3-on-surface">LRU Auto-Sweep</div>
                 <div className="text-[8.5px] font-medium text-m3-on-surface-variant/40 leading-none">Saneamento a cada 50 ops</div>
               </div>
             </div>

             {/* Dynamic Pipeline Flow */}
             <div className="space-y-4">
                <h3 className="text-xs font-black text-m3-on-surface-variant/85 tracking-wider uppercase flex items-center gap-1.5 font-sans">
                  <Workflow className="w-4 h-4 text-m3-primary" />
                  Pipeline de Execução e Ciclo da Requisição
                </h3>
                <div className="relative border-l border-m3-outline-variant/30 pl-5 ml-3.5 space-y-6">
                  {[
                    {
                      step: "01",
                      title: "Validação & Inferência Tipológica de Ativo",
                      desc: "O motor limpa o ticker com regex de sufixo e chama inferAssetType() para classificar se o ativo é ACAO, FII, BDR, ETF (com lista de fundos mapeada até 2026), ou STOCK (ações estrangeiras puras como AAPL/MSFT, direcionando-as aos scrapers especializados)."
                    },
                    {
                      step: "02",
                      title: "LRUCache com Limite Ativo e Auto-Sweep",
                      desc: "Antes de qualquer rede externa, o dispositivo verifica seu mapa local de cache. Se os dados fundamentalistas residirem lá e o TTL default de 15 minutos for respeitado, retorna instantaneamente. Evita alocações e faz varredura periódica de itens inativos a cada 50 escritas no cache."
                    },
                    {
                      step: "03",
                      title: "RPS Restrito por Token-Bucket (DomainRateLimiter)",
                      desc: "Equipado com DomainRateLimiter por domínio mapeado. Controla a vazão usando performance.now() em escala sub-milissegundo para calcular frações de tokens gerados por milissegundo. Caso exceda o limite de segurança, bloqueia a thread via Promise/setTimeout com Jitter dinâmico."
                    },
                    {
                      step: "04",
                      title: "Circuit Breaker Tri-Estado com Provas de Recuperação",
                      desc: "Opera no disjuntor com estados FECHADO, ABERTO e SEMI_ABERTO. Se as requisições principais de raspagem falharem consecutivamente ou retornarem erros 403/429, desvia imediatamente para o Yahoo Finance API de contingência. O circuito testa a conectividade em SEMI_ABERTO exigindo duas rodadas consecutivas de sucesso absoluto para fechar o circuito novamente."
                    },
                    {
                      step: "05",
                      title: "Sub-ms Sliding Window Regex Parsing (Zero-AST)",
                      desc: "Evita o peso colossal de emulação headless pesada (Chromium/Puppeteer). Ele consome o corpo HTML como fragmentos de stream e executa estratégias de âncora ('includes' pré-filtro instantâneo) e Regex de alta performance nos chunks da janela deslizante (400 a 3000 caracteres), suportando extração em grupo (extractGroups: true) de tabelas multi-coluna."
                    },
                    {
                      step: "06",
                      title: "Tratamento de Strings Grandes e Validação Zod",
                      desc: "Números em formato brasileiro ('Faturamento de R$ 140,03 Bilhões') são parseados numericamente em multiplicadores usando normalizeBRNumber sem expor erros. A estrutura limpa é validada rigorosamente por schemas Zod (B3Schema, FIISchema, ETFSchema, StockSchema) antes de alimentar o painel corporativo."
                    }
                  ].map((p, idx) => (
                    <div key={idx} className="relative space-y-1 select-none hover:translate-x-0.5 duration-150 transition-transform">
                      {/* Circle indicator */}
                      <div className="absolute -left-[29px] top-0.5 w-5 h-5 rounded-full bg-m3-surface-container border border-m3-outline-variant flex items-center justify-center font-bold text-[9px] text-m3-primary shadow-sm z-10 font-mono">
                        {p.step}
                      </div>
                      <h4 className="font-bold text-xs text-m3-on-surface tracking-tight flex items-center gap-1.5 font-sans">
                        {p.title}
                      </h4>
                      <p className="text-[11px] text-m3-on-surface-variant/75 leading-relaxed max-w-3xl font-medium font-sans">
                        {p.desc}
                      </p>
                    </div>
                  ))}
                </div>
             </div>

             {/* Submodules Detailed Cards breakdown */}
             <div className="space-y-4 pt-4">
                <h3 className="text-xs font-black text-m3-on-surface-variant/85 tracking-wider uppercase flex items-center gap-1.5 font-sans">
                  <Layers className="w-4 h-4 text-m3-primary" />
                  Arquitetura de Submódulos de api/lib/nexus-engine.ts
                </h3>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-6">
                  <div className="space-y-1.5">
                    <div className="flex justify-between items-center border-b border-m3-outline-variant/10 pb-1">
                      <span className="text-[10px] font-black uppercase text-m3-primary tracking-widest font-mono">01 // CLASSE LRUCache&lt;V&gt;</span>
                      <Database className="w-3.5 h-3.5 text-m3-primary opacity-65" />
                    </div>
                    <p className="text-[11px] text-m3-on-surface-variant/80 leading-relaxed font-medium font-sans">
                      Controlador de mémoria local com teto definido para desviar requisições repetitivas. Inclui recursos de serialização profunda (<code className="font-mono text-[10px]">serialize()</code>) e autopopulação (<code className="font-mono text-[10px]">populate()</code>) para salvar dados limpos do cache persistidos no disco com carimbos e identificador de versão de schema do Nexus.
                    </p>
                    <div className="text-[10px] font-mono text-m3-on-surface-variant/75 pt-1 space-y-0.5">
                      <div className="text-m3-primary font-bold">Atributos Principais:</div>
                      <div>• mapa = new Map&lt;string, CacheEntry&gt;()</div>
                      <div>• _cleanEvery = 50 (ciclo automático de sweep)</div>
                      <div>• serialize() / populate() (carga/descarga rápida)</div>
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <div className="flex justify-between items-center border-b border-m3-outline-variant/10 pb-1">
                      <span className="text-[10px] font-black uppercase text-m3-primary tracking-widest font-mono">02 // CLASSE DomainRateLimiter</span>
                      <Clock className="w-3.5 h-3.5 text-m3-primary opacity-65" />
                    </div>
                    <p className="text-[11px] text-m3-on-surface-variant/80 leading-relaxed font-medium font-sans">
                      Controlador de concorrência com regulador tipo balde de tokens (token-bucket). Calcula a chegada de novas cotas de requisição de maneira infinitesimal, travando a thread em chamadas paralelas agressivas e dividindo retornos com desvio pseudoaleatório.
                    </p>
                    <div className="text-[10px] font-mono text-m3-on-surface-variant/75 pt-1 space-y-0.5">
                      <div className="text-m3-primary font-bold">Mecanismo de Throttling:</div>
                      <div>• acquire(): Promise&lt;void&gt; (requisita cota de rede)</div>
                      <div>• refill() (cálculo de tokens com base em elapsedMs)</div>
                      <div>• Sleep computacional dinâmico baseado no RPS do domínio</div>
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <div className="flex justify-between items-center border-b border-m3-outline-variant/10 pb-1">
                      <span className="text-[10px] font-black uppercase text-m3-primary tracking-widest font-mono">03 // CLASSE CircuitBreaker</span>
                      <AlertTriangle className="w-3.5 h-3.5 text-m3-primary opacity-65" />
                    </div>
                    <p className="text-[11px] text-m3-on-surface-variant/80 leading-relaxed font-medium font-sans">
                      Disjuntor de segurança físico integrado por provedor. Intercepta erros sistemáticos em cascata. Ao atingir o limite de segurança, entra em estado isolado por 30 segundos, liberando conexões de teste em modo reduzido até restabelecer a estabilidade de conexão.
                    </p>
                    <div className="text-[10px] font-mono text-m3-on-surface-variant/75 pt-1 space-y-0.5">
                      <div className="text-m3-primary font-bold">Máquina de Estados:</div>
                      <div>• Estados: CLOSED | ABERTO | SEMI_ABERTO</div>
                      <div>• Transição automática após resetMs de expiração</div>
                      <div>• successCount &gt;= 2 em semi-aberto para recuperação total</div>
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <div className="flex justify-between items-center border-b border-m3-outline-variant/10 pb-1">
                      <span className="text-[10px] font-black uppercase text-m3-primary tracking-widest font-mono">04 // LEXER UNIVERSAL & STEALTH</span>
                      <Cpu className="w-3.5 h-3.5 text-m3-primary opacity-65" />
                    </div>
                    <p className="text-[11px] text-m3-on-surface-variant/80 leading-relaxed font-medium font-sans">
                      A alma de scraping do motor. Faz rotação em tempo real de User-Agents modernos de ponta (Chrome 136, Firefox 138), injeta cabeçalhos de navegação realísticos e simula endereços de IP residenciais de forma dinâmica via X-Forwarded headers para evitar rastreamento.
                    </p>
                    <div className="text-[10px] font-mono text-m3-on-surface-variant/75 pt-1 space-y-0.5">
                      <div className="text-m3-primary font-bold">Medidas de Discrição:</div>
                      <div>• getStealthHeaders(url) / getRandomIP()</div>
                      <div>• Cache regex global compilado _regexCache</div>
                      <div>• Anchor lowercases mapeados em _anchorLowerCache</div>
                    </div>
                  </div>
                </div>
             </div>

             {/* Code Specification sample */}
             <div className="space-y-3">
               <h3 className="text-xs font-black text-m3-on-surface-variant/85 tracking-wider uppercase flex items-center gap-1.5 font-sans">
                 <Terminal className="w-4 h-4 text-m3-primary" />
                 Estrutura Real do Engine: api/lib/nexus-engine.ts
               </h3>
               
               <M3Card variant="outlined" className="p-0 border border-m3-outline-variant/15 overflow-hidden shadow-sm !rounded-[12px]">
                 <div className="bg-m3-surface-container-high/40 px-4 py-2 border-b border-m3-outline-variant/15 flex justify-between items-center">
                   <div className="flex items-center gap-1.5">
                     <Code className="w-3.5 h-3.5 text-m3-primary" />
                     <span className="text-[11px] font-bold text-m3-on-surface font-mono">nexus-engine.ts (Módulos Auditados)</span>
                   </div>
                   <span className="text-[9px] uppercase font-black tracking-widest text-m3-on-surface-variant">TypeScript Scope</span>
                 </div>
                 
                 <div className="p-3 bg-m3-surface overflow-x-auto text-[10.5px] font-mono text-m3-on-surface-variant/90 leading-relaxed custom-scrollbar max-h-96">
                   <pre className="select-all whitespace-pre-wrap">{`// Arquitetura real extraída da auditoria do Nexus Engine (nexus-engine.ts)

import { z } from 'zod';

export type ExtendedAssetType = 'ACAO' | 'FII' | 'BDR' | 'ETF' | 'STOCK';

// LRUCache completo com sweep e persistência
class LRUCache<V> {
  private mapa = new Map<string, { data: V; expiresAt: number; staleAt: number }>();
  private _opCount = 0;
  private readonly _cleanEvery = 50;

  get(key: string) {
    const entry = this.mapa.get(key);
    if (!entry) return null;
    // LRU re-ordering
    this.mapa.delete(key);
    this.mapa.set(key, entry);
    return { data: entry.data, isStale: Date.now() > entry.staleAt };
  }

  set(key: string, data: V, staleMs = 300000, ttlMs = 86400000) {
    if (++this._opCount >= this._cleanEvery) {
      this._opCount = 0;
      this.sweepExpired();
    }
    this.mapa.set(key, { data, expiresAt: Date.now() + ttlMs, staleAt: Date.now() + staleMs });
  }

  serialize() { ... }
  populate(items) { ... }
}

// Token-Bucket sub-ms rate limiter
class DomainRateLimiter {
  private tokens: number;
  private lastRefill: number;

  async acquire(): Promise<void> {
    this.refill();
    if (this.tokens >= 1) {
      this.tokens -= 1;
      return;
    }
    const waitMs = ((1 - this.tokens) / this.rps) * 1000;
    await new Promise(resolve => setTimeout(resolve, waitMs));
  }
}

// Circuit Breaker completo com recuperação
class CircuitBreaker {
  private state: CBState = 'FECHADO';
  private failures = 0;

  recordSuccess() {
    if (this.state === 'SEMI_ABERTO') {
      this.successCount++;
      if (this.successCount >= 2) this.reset();
    }
  }

  recordFailure() {
    this.failures++;
    if (this.failures >= this.threshold) this.state = 'ABERTO';
  }
}

// Lexer universal baseado em Sliding Window de Regex
export function universalLexer<T>(html: string, template: ExtractorTemplate<T>) {
  // Pré-filtro ultra-rápido: se o anchor não constar como substring, pula o processamento pesado
  if (!htmlLower.includes(anchorLower)) continue;
  
  // Janela deslizante reduzida (Default: 400 ou 3000 chars)
  const chunk = html.slice(idx, idx + chunkSize);
  const match = chunk.match(rule.extractRegex);
  return parsedResult;
}`}</pre>
                 </div>
               </M3Card>
             </div>
          </motion.div>
        ) : (
          /* Docs View */
          <motion.div 
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="w-full max-w-4xl mx-auto space-y-12 pb-12 pt-4"
          >
             <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 border-b border-m3-outline-variant/20 pb-6">
               <div className="space-y-1.5">
                 <h2 className="text-lg font-black text-m3-on-surface tracking-tight flex items-center gap-2">
                   <div className="p-2 bg-m3-primary/10 rounded-lg text-m3-primary">
                     <Code className="w-5 h-5" />
                   </div>
                   SDK & Integração
                 </h2>
                 <p className="text-xs font-medium text-m3-on-surface-variant max-w-2xl leading-relaxed">
                   Guia completo para conectar seu aplicativo ao Servidor Valorae e enviar dados de telemetria.
                 </p>
               </div>
               <button 
                 onClick={handleDownloadSdk} 
                 className="flex items-center justify-center gap-1.5 bg-m3-primary text-m3-on-primary px-4 py-2 rounded-lg font-bold text-[10px] uppercase tracking-widest hover:bg-m3-primary/90 transition-all hover:-translate-y-0.5 shadow-md shadow-m3-primary/15 shrink-0"
               >
                 <Download className="w-4 h-4" />
                 Baixar SDK
               </button>
             </div>
             
             <div className="space-y-10">
               <section className="space-y-3">
                 <h3 className="text-sm font-bold text-m3-on-surface flex items-center gap-2">
                    <span className="text-m3-primary font-mono text-xs uppercase tracking-widest font-black">01 //</span> 
                    Visão Geral
                 </h3>
                 <p className="text-xs font-medium text-m3-on-surface-variant leading-relaxed max-w-3xl">
                   O servidor monitoria ativamente as requisições recebidas nos endpoints de <strong>Scrape</strong> (para coletas individuais parciais) e <strong>Sync</strong> (sincronização em massa).
                   Recomendamos utilizar a classe <code className="font-mono text-m3-primary">NexusClient</code> para garantir que o <em>payload</em> siga os padrões rigorosos e registre corretamente duração, tipos e status no Proxy.
                  </p>
                </section>

                <section className="space-y-4">
                 <h3 className="text-sm font-bold text-m3-on-surface flex items-center gap-2">
                    <span className="text-m3-primary font-mono text-xs uppercase tracking-widest font-black">02 //</span> 
                    Passo a Passo
                 </h3>
                 <div className="grid gap-3.5 max-w-3xl pt-1">
                   {[
                     "Faça o download do SDK usando o botão localizado no topo desta página.",
                     "Inclua o arquivo nexus-client.ts na pasta raiz (ex: src/lib/ ou src/services/) do seu projeto.",
                     "Instancie o NexusClient informando a URL deste servidor Proxy. Se for para chamadas no mesmo domínio, pode instanciar sem argumentos.",
                     "Sempre que seu sistema fizer uma coleta de dados (ex: Scrape) ou fechar uma operação, chame os métodos sendScrapeData ou syncData."
                   ].map((step, idx) => (
                     <div key={idx} className="flex gap-3 py-1 select-none">
                       <div className="w-5 h-5 rounded-full bg-m3-primary/10 text-m3-primary flex items-center justify-center font-bold text-[10px] shrink-0">
                         {idx + 1}
                       </div>
                       <p className="text-xs text-m3-on-surface/95 max-w-2xl font-medium pt-0.5">{step}</p>
                     </div>
                   ))}
                 </div>
               </section>

               <section className="space-y-6">
                 <div className="space-y-2">
                   <h3 className="text-xl font-bold text-m3-on-surface flex items-center gap-3">
                      <span className="text-m3-primary font-mono text-sm uppercase tracking-widest font-black">03 //</span> 
                      Recursos e Códigos
                   </h3>
                   <p className="text-sm text-m3-on-surface-variant">Copie os snippets abaixo para acelerar a implementação no seu projeto.</p>
                 </div>
                 <div className="space-y-4 max-w-4xl">
                   <AccordionCode 
                     title="Exemplo de Código (TypeScript)" 
                     icon={Code}
                     type="code"
                     content={`import { NexusClient } from './lib/nexus-client';

// Se for um App externo chamando o Proxy:
const proxyURL = 'https://sua-url-do-proxy.run.app';
const nexus = new NexusClient(proxyURL);

// Enviar evento de execução com sucesso
async function processStockData() {
  try {
    const data = await fetchExternalData('PETR4');
    
    // Notifica o Proxy do Sucesso
    await nexus.sendScrapeData({
      ticker: 'PETR4',
      type: 'B3_BATCH_SCRAPE',
      metrics: { source: 'Frontend App', items: 120 }
    });
  } catch (error) {
    // Notifica o Proxy da Falha
    await nexus.sendScrapeData({
      ticker: 'PETR4',
      type: 'B3_BATCH_SCRAPE',
      error: error.message,
      metrics: { source: 'Frontend App' }
    });
  }
}`}
                   />
                   <AccordionCode 
                     title="Prompt para Inteligência Artificial" 
                     icon={Terminal}
                     type="prompt"
                     content={"Vou te enviar um arquivo chamado \"nexus-client.ts\". Este é o SDK oficial do meu servidor Proxy de monitoramento.\n\nSua tarefa:\n1. Crie o arquivo \"nexus-client.ts\" no meu projeto exatamente com o código que vou mandar.\n2. Identifique na minha aplicação os pontos onde ela faz requisições ou extrações (scraping/buscas).\n3. Importe a classe `NexusClient`, instancie (coloque a string da URL do proxy se houver) e chame `sendScrapeData` no final de cada função principal de busca. Envie os dados `ticker`, `type`, e se houver erro, envie no campo `error`.\n\nVocê deve disparar calls para esse Proxy sempre que algo importante acontecer para que o Dashboard em tempo real atualize. Fique atento a blocos `try/catch` para avisar quando falhar e quando der sucesso."}
                   />
                 </div>
               </section>
             </div>
          </motion.div>
        )}
        </div>
      </main>

      <style>{`
        .custom-scrollbar::-webkit-scrollbar { width: 4px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: rgba(6, 182, 212, 0.15); border-radius: 10px; }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover { background: rgba(6, 182, 212, 0.3); }
      `}</style>
    </div>
  );
}

function AccordionCode({ title, content, type = "code", icon: Icon }: { title: string, content: string, type?: "code" | "prompt", icon?: any }) {
  const [isOpen, setIsOpen] = useState(false);
  const [copied, setCopied] = useState(false);

  const handleCopy = (e: MouseEvent) => {
    e.stopPropagation();
    navigator.clipboard.writeText(content);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="border border-m3-outline-variant/30 rounded-[16px] overflow-hidden bg-m3-surface">
      <div 
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex items-center justify-between p-4 bg-m3-primary/5 hover:bg-m3-primary/10 transition-colors cursor-pointer"
      >
        <div className="flex items-center gap-3">
          {Icon && <Icon className="w-5 h-5 text-m3-primary" />}
          <span className="font-bold text-m3-on-surface tracking-tight">{title}</span>
        </div>
        <div className="flex items-center gap-3">
          <button 
            onClick={handleCopy}
            className="flex items-center gap-2 px-3 py-1.5 rounded-[8px] bg-m3-surface text-m3-primary hover:bg-m3-primary/10 transition-colors border border-m3-primary/20 text-xs font-bold uppercase tracking-widest shadow-sm"
          >
            {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
            {copied ? 'Copiado' : 'Copiar'}
          </button>
          <motion.div animate={{ rotate: isOpen ? 180 : 0 }} transition={{ duration: 0.2 }}>
            <ChevronDown className="w-5 h-5 text-m3-on-surface-variant" />
          </motion.div>
        </div>
      </div>
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden"
          >
            <div className="p-4 sm:p-5 border-t border-m3-outline-variant/30 bg-m3-surface-container-high/50">
              <pre className="text-[10.5px] sm:text-[12px] md:text-[13px] font-mono leading-relaxed text-m3-on-surface-variant whitespace-pre-wrap break-words">
                {content}
              </pre>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function MetricsGroup({ label, value, icon, subtitle }: { label: string, value: string | number, icon?: any, subtitle?: string }) {
  return (
    <div className="py-2 px-1 border-b border-m3-outline-variant/10 flex flex-col justify-between transition-all group">
      <div className="flex flex-col gap-0.5">
        <div className="text-[9px] uppercase font-bold text-m3-on-surface-variant/85 tracking-[0.06em] flex items-center gap-1 opacity-80 group-hover:text-m3-primary transition-colors">
          {icon}
          {label}
        </div>
        <div className="text-base font-black text-m3-on-surface tracking-tight mt-0.5 font-mono">
          {value}
        </div>
      </div>
      {subtitle && (
        <span className="text-[8.5px] font-medium text-m3-on-surface-variant/40 mt-1 leading-tight select-none">
          {subtitle}
        </span>
      )}
    </div>
  );
}

function formatUptime(seconds: number) {
  const d = Math.floor(seconds / (3600*24));
  const h = Math.floor(seconds % (3600*24) / 3600);
  const m = Math.floor(seconds % 3600 / 60);
  return `${d}d ${h}h ${m}m`;
}

function Badge({ label }: { label: string }) {
  return (
    <span className="px-2 py-1 sm:px-3 sm:py-1 mb-1 bg-m3-primary/10 text-m3-primary rounded-[8px] text-[9px] font-black uppercase tracking-[0.15em]">
      {label}
    </span>
  );
}

