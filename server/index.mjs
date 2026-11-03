import { createServer } from 'node:http';
import { mkdirSync, writeFileSync } from 'node:fs';

const PORT = Number(process.env.PORT ?? 4000);
const FAIL_RATE = Number(process.env.FAIL_RATE ?? 0);
const store = new Map();
mkdirSync('server/uploads', { recursive: true });

const send = (res, code, body) => {
  res.writeHead(code, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify(body));
};

createServer((req, res) => {
  const match = req.url?.match(/^\/captures\/([\w-]+)$/);
  if (req.method === 'GET' && req.url === '/captures') {
    return send(res, 200, [...store.values()].map(({ photoBase64, ...r }) => r));
  }
  if (req.method !== 'PUT' || !match) return send(res, 404, { error: 'not found' });

  let raw = '';
  req.on('data', (c) => (raw += c));
  req.on('end', () => {
    if (Math.random() < FAIL_RATE) return send(res, 503, { error: 'simulated outage' });
    let body;
    try {
      body = JSON.parse(raw);
    } catch {
      return send(res, 400, { error: 'invalid json' });
    }
    if (!body.title) return send(res, 422, { error: 'title required' });

    const id = match[1];
    const existing = store.get(id);
    if (existing) {
      console.log(`dup   ${id} (already have it, returning ${existing.remoteId})`);
      return send(res, 200, { remoteId: existing.remoteId });
    }
    const remoteId = `srv_${store.size + 1}`;
    if (body.photoBase64) writeFileSync(`server/uploads/${id}.jpg`, Buffer.from(body.photoBase64, 'base64'));
    store.set(id, { ...body, id, remoteId, receivedAt: Date.now() });
    console.log(`saved ${id} -> ${remoteId} "${body.title}"`);
    send(res, 201, { remoteId });
  });
}).listen(PORT, () => console.log(`sync server on :${PORT}  FAIL_RATE=${FAIL_RATE}`));
