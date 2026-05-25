export interface Stats {
  session: {
    cacheHits: number;
    cacheStale: number;
    cacheMisses: number;
  };
  requests: {
    total: number;
    success: number;
    fail: number;
  };
  uptime: number;
}

export interface LogEntry {
  id: string;
  timestamp: string;
  ticker: string;
  type: string;
  status: 'success' | 'error';
  duration: number;
  source: string;
}
