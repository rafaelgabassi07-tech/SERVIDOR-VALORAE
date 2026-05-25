import express from 'express';
import cors from 'cors';
import morgan from 'morgan';
import path from 'path';
import { fileURLToPath } from 'url';
import os from 'os';
import assetHandler from './api/asset.js';
import assetsHandler from './api/assets.js';
import scrapeHandler from './api/scrape.js';
import syncHandler from './api/sync.js';
import { NexusEngineUltra } from './api/lib/nexus-engine.js';
import { LogEntry } from './src/types.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = 3000;

// Centralized Logs in Memory (Last 100)
const requestLogs: LogEntry[] = [];

// Middleware for global logging
const logMiddleware = (req: express.Request, res: express.Response, next: express.NextFunction) => {
  const start = performance.now();
  const originalJson = res.json;
  
  res.json = function(body: any) {
    if (req.path.startsWith('/api/') && req.path !== '/api/stats' && req.path !== '/api/logs') {
      const duration = performance.now() - start;
      const ticker = (req.query.ticker || req.body?.tickers?.[0] || 'N/A') as string;
      
      const entry: LogEntry = {
        id: crypto.randomUUID(),
        timestamp: new Date().toLocaleTimeString('pt-BR'),
        ticker: ticker.toUpperCase(),
        type: body?.type || 'BATCH/SCRAPE',
        status: body?.error ? 'error' : 'success',
        duration,
        source: body?.metrics?.source || 'Proxy'
      };
      
      requestLogs.unshift(entry);
      if (requestLogs.length > 100) requestLogs.pop();
    }
    return originalJson.call(this, body);
  };
  next();
};

app.use(cors());
app.use(express.json());
app.use(morgan('dev'));
app.use(logMiddleware);

// Monitoring & Stats APIs
app.get('/api/stats', (req, res) => {
  const engineStats = NexusEngineUltra.getCacheStats();
  
  const recentLogs = requestLogs.slice(0, 50);
  const errorCount = recentLogs.filter(l => l.status === 'error').length;
  const isErrorAlert = recentLogs.length > 0 && (errorCount / recentLogs.length) > 0.10;

  res.json({
    ...engineStats,
    errorAlert: isErrorAlert,
    server: {
      platform: process.platform,
      nodeVersion: process.version,
      memoryUsage: process.memoryUsage(),
      totalMem: os.totalmem(),
      freeMem: os.freemem(),
      cpus: os.cpus().length,
      loadavg: os.loadavg(),
      uptime: os.uptime()
    }
  });
});

app.get('/api/logs', (req, res) => {
  res.json(requestLogs);
});

app.delete('/api/logs', (req, res) => {
  requestLogs.length = 0;
  res.json({ success: true });
});

// Proxy Routes
app.get('/api/asset', assetHandler);
app.get('/api/assets', assetsHandler);
app.post('/api/assets', assetsHandler);
app.post('/api/scrape', scrapeHandler);
app.all('/api/sync', syncHandler);

// Serve Static Files
const distPath = path.join(__dirname, 'dist');
app.use(express.static(distPath));

app.get('*', (req, res) => {
  if (req.path.startsWith('/api')) return res.status(404).json({ error: 'Not Found' });
  res.sendFile(path.join(distPath, 'index.html'));
});

if (process.env.NODE_ENV !== 'test' && !process.env.VERCEL) {
  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Nexus Proxy Professional running on port ${PORT}`);
  });
}

export default app;
