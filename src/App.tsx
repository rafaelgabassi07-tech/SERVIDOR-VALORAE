/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useEffect, useCallback } from 'react';
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
  AlertTriangle
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { ResponsiveContainer, LineChart, Line, YAxis } from 'recharts';
import { M3Card } from './components/M3Card';
import { LogEntry } from './types';

export default function App() {
  const [stats, setStats] = useState<any>(null);
  const [testTicker, setTestTicker] = useState('PETR4');
  const [testResult, setTestResult] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [activeTab, setActiveTab] = useState<'monitor' | 'logs'>('monitor');
  const [logSearch, setLogSearch] = useState('');

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

  const handleTest = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!testTicker) return;
    
    setLoading(true);
    try {
      const res = await fetch(`/api/asset?ticker=${testTicker.toUpperCase()}`);
      const data = await res.json();
      setTestResult(data);
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
    const interval = setInterval(fetchData, 5000);
    return () => clearInterval(interval);
  }, [fetchData]);

  const uptimeStr = stats?.server?.uptime ? formatUptime(stats.server.uptime) : '...';
  const memTotal = stats?.server?.totalMem ? (stats.server.totalMem / 1024 / 1024 / 1024).toFixed(2) + ' GB' : '...';
  const memFree = stats?.server?.freeMem ? (stats.server.freeMem / 1024 / 1024 / 1024).toFixed(2) + ' GB' : '...';
  const processMem = stats?.server?.memoryUsage ? (stats.server.memoryUsage.heapUsed / 1024 / 1024).toFixed(2) + ' MB' : '...';
  const cpus = stats?.server?.cpus || '...';
  const load = stats?.server?.loadavg ? stats.server.loadavg[0].toFixed(2) : '...';

  const filteredLogs = logs.filter(l => l.ticker.toLowerCase().includes(logSearch.toLowerCase()) || l.type.toLowerCase().includes(logSearch.toLowerCase()));
  const avgLatency = logs.length > 0 ? (logs.reduce((acc, l) => acc + l.duration, 0) / logs.length).toFixed(0) : '0';
  const errorRate = logs.length > 0 ? ((logs.filter(l => l.status !== 'success').length / logs.length) * 100).toFixed(1) : '0';

  return (
    <div className="min-h-screen font-sans selection:bg-m3-primary/20">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 md:px-8 py-4 sm:py-6">
        
        {/* Top Header */}
        <header className="flex flex-col md:flex-row items-start md:items-center justify-between mb-6 gap-4">
          <div className="flex items-center gap-4">
            <motion.div 
              whileHover={{ scale: 1.05, rotate: 5 }}
              whileTap={{ scale: 0.95 }}
              className="w-12 h-12 md:w-16 md:h-16 bg-m3-primary-container rounded-[20px] flex items-center justify-center text-m3-on-primary-container shadow-2xl shadow-m3-primary/15"
            >
              <Server className="w-6 h-6 md:w-8 md:h-8" />
            </motion.div>
            <div>
              <h1 className="text-xl md:text-3xl font-black text-m3-on-surface tracking-tight mb-1">Servidor Valorae</h1>
              <div className="flex items-center gap-3">
                <span className="flex items-center gap-1.5 text-m3-success text-xs font-black uppercase tracking-widest">
                  <span className="w-2 h-2 rounded-full bg-current animate-pulse" />
                  Operacional
                </span>
                <span className="w-1 h-1 rounded-full bg-m3-outline-variant" />
                <span className="text-m3-on-surface-variant text-xs font-bold uppercase tracking-widest opacity-60">
                  Uptime OS: {uptimeStr}
                </span>
              </div>
            </div>
          </div>

          <nav className="flex w-full md:w-auto overflow-x-auto bg-m3-surface-container-high rounded-[16px] p-1 border border-m3-outline-variant/20 shadow-inner no-scrollbar">
            {[
              { id: 'monitor', label: 'Monitoramento', icon: <Activity className="w-4 h-4 shrink-0" /> },
              { id: 'logs', label: 'Tráfego', icon: <Layers className="w-4 h-4 shrink-0" /> }
            ].map(tab => (
              <button 
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                className={`flex-1 md:flex-none flex items-center justify-center gap-2 px-4 py-2 sm:px-6 sm:py-2.5 rounded-[12px] text-sm font-black transition-all whitespace-nowrap ${activeTab === tab.id ? 'bg-m3-primary text-m3-on-primary shadow-md' : 'text-m3-on-surface-variant hover:bg-m3-surface-variant'}`}
              >
                {tab.icon}
                {tab.label}
              </button>
            ))}
          </nav>
        </header>

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
            {/* Unified Metrics Cards */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              
              <M3Card variant="elevated" className="border border-m3-outline-variant/10 shadow-lg flex flex-col justify-between">
                <div>
                  <div className="flex items-center gap-2 mb-4">
                    <Cpu className="w-5 h-5 text-m3-primary" />
                    <h2 className="text-lg font-black text-m3-on-surface tracking-tight">Status do Hardware & OS</h2>
                  </div>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                    <MetricsGroup label="CPU Núcleos" value={cpus} icon={<Cpu className="w-4 h-4 opacity-50"/>} />
                    <MetricsGroup label="Load (1m)" value={load} icon={<Activity className="w-4 h-4 opacity-50"/>} />
                    <MetricsGroup label="Mem Total" value={memTotal} icon={<HardDrive className="w-4 h-4 opacity-50"/>} />
                    <MetricsGroup label="Mem Livre" value={memFree} icon={<HardDrive className="w-4 h-4 opacity-50"/>} />
                    <MetricsGroup label="Uso Node" value={processMem} icon={<Database className="w-4 h-4 opacity-50"/>} />
                    <MetricsGroup label="Plataforma" value={stats?.server?.platform || '...'} />
                    <MetricsGroup label="Node.js" value={stats?.server?.nodeVersion || '...'} />
                  </div>
                </div>
              </M3Card>

              <M3Card variant="elevated" className="border border-m3-outline-variant/10 shadow-lg flex flex-col justify-between">
                <div>
                  <div className="flex items-center gap-2 mb-4">
                    <Globe className="w-5 h-5 text-m3-primary" />
                    <h2 className="text-lg font-black text-m3-on-surface tracking-tight">Motor de Scraping & Proxy</h2>
                  </div>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                    <MetricsGroup label="Requests Totais" value={stats?.totalRequests || 0} />
                    <MetricsGroup label="Taxa Sucesso" value={stats?.successRate || '0%'} />
                    <MetricsGroup label="Falhas" value={stats?.totalFailures || 0} />
                    <MetricsGroup label="In-Flight reqs" value={stats?.inFlightRequests || 0} />
                    <MetricsGroup label="Cache Tamanho" value={`${stats?.cache?.tamanho || 0} / ${stats?.cache?.tamanhoMax || 0}`} />
                    <MetricsGroup label="Cache Hits" value={stats?.session?.cacheHits || 0} />
                    <MetricsGroup label="Cache Misses" value={stats?.session?.cacheMisses || 0} />
                    <MetricsGroup label="Cache Stale" value={stats?.session?.cacheStale || 0} />
                  </div>
                </div>
              </M3Card>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
              {/* Interaction Panel */}
              <div className="lg:col-span-4 space-y-4">
                <M3Card variant="elevated" className="border-none shadow-lg shadow-m3-primary/5">
                  <div className="flex items-center gap-2 mb-4">
                    <div className="w-8 h-8 bg-m3-secondary-container rounded-lg flex items-center justify-center text-m3-on-secondary-container font-black">
                      <Search className="w-4 h-4" />
                    </div>
                    <h2 className="text-lg font-black text-m3-on-surface">Fetch Manual</h2>
                  </div>
                  <form onSubmit={handleTest} className="space-y-4 text-m3-on-surface">
                    <div className="relative group">
                      <input 
                        type="text" 
                        value={testTicker}
                        onChange={(e) => setTestTicker(e.target.value)}
                        placeholder="EX: PETR4, HGCR11, AAPL" 
                        className="w-full bg-m3-surface-container-high border-2 border-transparent rounded-[16px] px-4 py-3 sm:px-6 sm:py-4 text-m3-on-surface placeholder:text-m3-on-surface-variant/30 focus:outline-none focus:border-m3-primary focus:bg-m3-surface transition-all uppercase font-mono text-base md:text-lg font-black tracking-widest shadow-inner relative z-10"
                      />
                      <span className="hidden sm:inline absolute right-4 top-1/2 -translate-y-1/2 text-[10px] font-black uppercase text-m3-on-surface-variant/40 group-focus-within:text-m3-primary/40 transition-colors z-20">TICKER</span>
                    </div>
                    
                    <button 
                      disabled={loading}
                      className="group w-full h-12 sm:h-14 bg-m3-primary text-m3-on-primary rounded-[16px] font-black text-base sm:text-lg transition-all hover:bg-m3-primary/90 hover:shadow-xl hover:shadow-m3-primary/30 active:scale-95 disabled:opacity-50 flex items-center justify-center gap-2.5"
                    >
                      {loading ? (
                        <RefreshCcw className="w-5 h-5 animate-spin" />
                      ) : (
                        <>
                          Realizar Scrape <ArrowRight className="w-5 h-5 group-hover:translate-x-1.5 transition-transform" />
                        </>
                      )}
                    </button>
                  </form>
                </M3Card>

                {/* Latency Sparkline */}
                <M3Card variant="elevated" className="border-none shadow-lg shadow-m3-primary/5 flex flex-col items-center justify-center p-6 h-48">
                  <div className="flex w-full justify-between items-center mb-4">
                    <h3 className="text-sm font-black text-m3-on-surface-variant uppercase tracking-widest flex items-center gap-2">
                       <Activity className="w-4 h-4 opacity-50" /> Latência
                    </h3>
                    <span className="text-sm font-mono font-bold text-m3-primary">{avgLatency}ms avg</span>
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
              <div className="lg:col-span-8 flex flex-col h-[400px] md:h-[650px]">
                <M3Card className="flex-1 flex flex-col p-0 border border-m3-outline-variant/20 bg-m3-surface-container overflow-hidden shadow-lg">
                  <div className="px-4 py-3 sm:px-6 sm:py-4 text-sm border-b border-m3-outline-variant/20 flex justify-between items-center bg-m3-surface-container-high/50">
                    <div className="flex items-center gap-2.5">
                      <Terminal className="w-4 h-4 text-m3-primary" />
                      <h2 className="font-black text-sm sm:text-base text-m3-on-surface tracking-tight">Console de Payload</h2>
                    </div>
                    {testResult && (
                      <div className="flex gap-2">
                        <Badge label={testResult.type || 'UNKNOWN'} />
                        <Badge label={testResult.cacheStatus || 'MISS'} />
                      </div>
                    )}
                  </div>
                  <div className="flex-1 overflow-auto p-4 sm:p-6 font-mono text-[11px] sm:text-[13px] leading-relaxed custom-scrollbar bg-m3-surface text-m3-on-surface-variant/80 border-t-2 border-m3-primary/5">
                    {testResult ? (
                      <pre className="text-m3-on-surface-variant whitespace-pre-wrap">
                        {JSON.stringify(testResult, null, 2)}
                      </pre>
                    ) : (
                      <div className="h-full flex flex-col items-center justify-center text-m3-on-surface-variant opacity-30 select-none">
                        <div className="w-24 h-24 border-2 border-dashed border-m3-outline-variant rounded-[32px] flex items-center justify-center mb-6">
                          <Layers className="w-10 h-10" />
                        </div>
                        <p className="text-sm font-black tracking-[0.2em] uppercase">Vazio • Aguardando Comando</p>
                      </div>
                    )}
                  </div>
                </M3Card>
              </div>
            </div>
          </div>
        ) : (
          /* Logs View */
          <motion.div 
            initial={{ opacity: 0, scale: 0.99 }}
            animate={{ opacity: 1, scale: 1 }}
            className="space-y-4"
          >
            {/* Logs Header / Actions */}
            <M3Card variant="elevated" className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border border-m3-outline-variant/10 shadow-sm">
              <div className="flex gap-6 w-full sm:w-auto">
                <MetricsGroup label="Total Logs" value={logs.length} />
                <MetricsGroup label="Gargalo Médio" value={`${avgLatency}ms`} />
                <MetricsGroup label="Erros" value={`${errorRate}%`} />
              </div>
              <div className="flex w-full sm:w-auto items-center gap-3">
                <div className="relative flex-1 sm:w-64">
                  <input 
                    type="text" 
                    value={logSearch}
                    onChange={(e) => setLogSearch(e.target.value)}
                    placeholder="Filtrar ticker, tipo..." 
                    className="w-full bg-m3-surface border-2 border-transparent rounded-[12px] pl-10 pr-4 py-2 text-sm text-m3-on-surface placeholder:text-m3-on-surface-variant/40 focus:outline-none focus:border-m3-primary transition-all font-mono shadow-inner"
                  />
                  <Filter className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-m3-on-surface-variant/40" />
                </div>
                <button 
                  onClick={handleClearLogs}
                  className="p-2.5 rounded-[12px] bg-m3-error/10 text-m3-error hover:bg-m3-error hover:text-m3-on-error transition-colors shrink-0 outline-none"
                  title="Limpar Logs"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </M3Card>

            {/* Desktop Table View */}
            <M3Card variant="elevated" className="hidden md:block p-0 overflow-hidden border border-m3-outline-variant/10 shadow-lg">
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-m3-surface-container text-m3-on-surface-variant text-[10px] uppercase tracking-[0.25em] font-black">
                      <th className="px-6 py-5 min-w-[100px]">Stamp</th>
                      <th className="px-6 py-5 min-w-[120px]">Ticker / Ação</th>
                      <th className="px-6 py-5 min-w-[100px]">Tipo</th>
                      <th className="px-6 py-5 min-w-[100px]">Status</th>
                      <th className="px-6 py-5 min-w-[100px]">Resolução</th>
                      <th className="px-6 py-5 min-w-[100px]">Origem</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-m3-outline-variant/10">
                    <AnimatePresence>
                      {filteredLogs.map((log) => (
                        <motion.tr 
                          key={log.id} 
                          initial={{ opacity: 0, y: 5 }}
                          animate={{ opacity: 1, y: 0 }}
                          className="hover:bg-m3-primary/5 transition-colors group"
                        >
                          <td className="px-6 py-4 text-[11px] font-mono font-bold text-m3-on-surface-variant opacity-50">
                            {log.timestamp}
                          </td>
                          <td className="px-6 py-4 text-sm font-black text-m3-on-surface tracking-tighter">{log.ticker}</td>
                          <td className="px-6 py-4 text-xs font-bold text-m3-on-surface-variant uppercase tracking-widest">{log.type}</td>
                          <td className="px-6 py-4">
                            <span className={`px-4 py-1 rounded-full text-[9px] font-black uppercase tracking-widest ${log.status === 'success' ? 'bg-m3-success/15 text-m3-success' : 'bg-m3-error/15 text-m3-error'}`}>
                              {log.status === 'success' ? 'OK' : 'Falha'}
                            </span>
                          </td>
                          <td className="px-6 py-4 text-xs font-mono font-black text-m3-primary whitespace-nowrap">
                            {log.duration.toFixed(0)} ms
                          </td>
                          <td className="px-6 py-4">
                             <span className="text-[10px] font-black uppercase text-m3-on-surface-variant/60">{log.source}</span>
                          </td>
                        </motion.tr>
                      ))}
                    </AnimatePresence>
                    {filteredLogs.length === 0 && (
                      <tr>
                        <td colSpan={6} className="px-6 py-24 text-center text-m3-on-surface-variant/30 text-xs font-black uppercase tracking-[0.3em]">
                          {logs.length === 0 ? 'Nenhum tráfego em rede detectado' : 'Nenhum resultado para o filtro'}
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
                    className="bg-m3-surface rounded-[16px] p-4 border border-m3-outline-variant/20 shadow-sm flex flex-col gap-3"
                  >
                     <div className="flex justify-between items-center">
                       <span className="text-[10px] font-mono font-bold text-m3-on-surface-variant opacity-60">{log.timestamp}</span>
                       <span className={`px-2 py-0.5 rounded-full text-[8px] font-black uppercase tracking-widest ${log.status === 'success' ? 'bg-m3-success/15 text-m3-success' : 'bg-m3-error/15 text-m3-error'}`}>
                        {log.status === 'success' ? 'OK' : 'Falha'}
                       </span>
                     </div>
                     <div className="flex justify-between items-end">
                       <div>
                         <h3 className="text-base font-black text-m3-on-surface tracking-tight leading-none mb-1 shadow-sm">{log.ticker}</h3>
                         <p className="text-[10px] font-bold text-m3-on-surface-variant uppercase tracking-widest">{log.type}</p>
                       </div>
                       <div className="text-right">
                         <p className="text-xs font-mono font-black text-m3-primary">{log.duration.toFixed(0)} ms</p>
                         <p className="text-[9px] font-black uppercase text-m3-on-surface-variant/60 mt-0.5">{log.source}</p>
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

          </motion.div>
        )}
      </div>

      <style>{`
        .custom-scrollbar::-webkit-scrollbar { width: 4px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: rgba(112, 93, 0, 0.1); border-radius: 10px; }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover { background: rgba(112, 93, 0, 0.2); }
      `}</style>
    </div>
  );
}

function MetricsGroup({ label, value, icon }: { label: string, value: string | number, icon?: any }) {
  return (
    <div className="flex flex-col gap-1">
      <div className="text-[10px] uppercase font-black text-m3-on-surface-variant opacity-60 tracking-[0.1em] flex items-center gap-1">
        {icon}
        {label}
      </div>
      <div className="text-xl font-black text-m3-on-surface tracking-tighter">
        {value}
      </div>
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

