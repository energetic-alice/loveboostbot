import http from 'node:http';
import * as db from './services/db.js';
import config from './config.js';
import { info as logInfo, error as logError } from './logger.js';

async function checkDb() {
  try {
    await db.getLanguage(0);
    return true;
  } catch {
    return false;
  }
}

export function startHealthServer() {
  const server = http.createServer(async (req, res) => {
    if (req.method !== 'GET' || (req.url !== '/health' && req.url !== '/')) {
      res.writeHead(404);
      res.end();
      return;
    }

    const dbOk = await checkDb();
    const status = dbOk ? 'ok' : 'degraded';
    const statusCode = dbOk ? 200 : 503;
    const current_server_time = new Date().toISOString();

    res.writeHead(statusCode, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ status, db: dbOk ? 'connected' : 'error', current_server_time }));
  });

  server.listen(config.healthPort, () => {
    logInfo(`Health check server listening on port ${config.healthPort}`);
  });

  return server;
}
