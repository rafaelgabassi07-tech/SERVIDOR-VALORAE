import express from 'express';
import cors from 'cors';
import morgan from 'morgan';
import path from 'path';

const app = express();
app.disable('x-powered-by');
const PORT = 3000;

app.use(cors());
app.use(express.json());
app.use(morgan('dev'));

// Global Error Handler
app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error('[Server Error]:', err);
  if (!res.headersSent) {
    res.status(500).json({ error: 'Internal Server Error', details: err.message });
  }
});

// Serve Static Files or Vite Middleware
async function startServer() {
  if (process.env.NODE_ENV !== 'production' && !process.env.VERCEL) {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    // Vercel serverless functions / Node prod build
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));

    // Express v4 fallback
    app.get('*', (req, res) => {
      if (req.path.startsWith('/api')) return res.status(404).json({ error: 'Not Found' });
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  if (process.env.NODE_ENV !== 'test' && !process.env.VERCEL) {
    app.listen(PORT, '0.0.0.0', () => {
      console.log(`Server running on port ${PORT}`);
    });
  }
}

startServer();

export default app;
