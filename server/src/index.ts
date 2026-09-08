// Emberhold realtime server (phase 6.0 skeleton).
// - GET /health      -> { ok, uptime, rooms, mongo }
// - WS  /ws?ticket=  -> verifies the HMAC ticket, then echoes JSON messages
//                       and answers {type:'ping'} with {type:'pong'} until the
//                       real room simulation lands in 6.2.
import { createServer } from 'node:http';
import { WebSocketServer, type WebSocket } from 'ws';
import { MongoClient } from 'mongodb';
import { verify, type Claims } from './ticket.ts';
import { HALF } from '../../lib/game/terrain.ts';

const PORT = Number(process.env.PORT || 8787);
const SECRET = process.env.PVP_SECRET || '';
const ORIGIN = process.env.ORIGIN || '';
const started = Date.now();
let mongoStatus: 'off' | 'connecting' | 'ok' | 'error' = 'off';
let mongo: MongoClient | null = null;
if (process.env.MONGODB_URI) {
  mongoStatus = 'connecting';
  mongo = new MongoClient(process.env.MONGODB_URI, {
    serverSelectionTimeoutMS: 5000,
  });
  mongo
    .connect()
    .then(() => {
      mongoStatus = 'ok';
      console.log('mongo connected');
    })
    .catch((e) => {
      mongoStatus = 'error';
      console.error('mongo error', e.message);
    });
}
type Client = { ws: WebSocket; claims: Claims; joined: number };
const clients = new Set<Client>();
const server = createServer((req, res) => {
  if (req.url === '/health') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(
      JSON.stringify({
        ok: true,
        uptime: Math.round((Date.now() - started) / 1000),
        clients: clients.size,
        mongo: mongoStatus,
        mapHalf: HALF,
      }),
    );
    return;
  }
  res.writeHead(404);
  res.end();
});
const wss = new WebSocketServer({ noServer: true });
server.on('upgrade', (req, socket, head) => {
  const url = new URL(req.url || '/', 'http://x');
  if (url.pathname !== '/ws') return socket.destroy();
  if (ORIGIN && req.headers.origin && req.headers.origin !== ORIGIN)
    return socket.destroy();
  const claims = SECRET
    ? verify(url.searchParams.get('ticket') || '', SECRET)
    : { id: 'dev', name: 'dev', exp: Infinity };
  if (!claims) {
    socket.write('HTTP/1.1 401 Unauthorized\r\n\r\n');
    return socket.destroy();
  }
  wss.handleUpgrade(req, socket, head, (ws) => {
    const c: Client = { ws, claims, joined: Date.now() };
    clients.add(c);
    ws.send(
      JSON.stringify({
        type: 'hello',
        id: claims.id,
        name: claims.name,
        server: 'emberhold 0.1',
      }),
    );
    ws.on('message', (data) => {
      const text = Array.isArray(data)
        ? Buffer.concat(data).toString()
        : Buffer.from(data as ArrayBuffer).toString();
      let msg: { type?: string } = {};
      try {
        msg = JSON.parse(text);
      } catch {
        return ws.send(JSON.stringify({ type: 'error', error: 'bad json' }));
      }
      if (msg.type === 'ping')
        return ws.send(JSON.stringify({ type: 'pong', t: Date.now() }));
      ws.send(JSON.stringify({ type: 'echo', msg }));
    });
    ws.on('close', () => clients.delete(c));
  });
});
server.listen(PORT, () =>
  console.log(
    `emberhold-server listening on :${PORT} (mongo: ${mongoStatus}, ticket: ${SECRET ? 'required' : 'dev-open'})`,
  ),
);
