import express from 'express';
import { createServer } from 'http';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import net from 'net';

const __dirname = dirname(fileURLToPath(import.meta.url));
const PUBLIC_DIR = join(__dirname, '..', 'public');

function findAvailablePort(start = 3000, end = 3999) {
  return new Promise((resolve, reject) => {
    let port = start;
    const tryPort = () => {
      if (port > end) return reject(new Error('No available port in range 3000–3999'));
      const server = net.createServer();
      server.listen(port, '127.0.0.1', () => {
        server.close(() => resolve(port));
      });
      server.on('error', () => {
        port++;
        tryPort();
      });
    };
    tryPort();
  });
}

export async function startServer(analysis) {
  const port = await findAvailablePort();
  const app = express();

  app.use(express.static(PUBLIC_DIR));

  app.get('/api/analysis', (req, res) => {
    res.json(analysis);
  });

  // Catch-all: serve index.html for any non-API route
  app.get('*', (req, res) => {
    res.sendFile(join(PUBLIC_DIR, 'index.html'));
  });

  await new Promise((resolve) => {
    const server = createServer(app);
    server.listen(port, '127.0.0.1', resolve);
  });

  return port;
}
