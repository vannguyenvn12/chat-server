// npm i ws express cors
const express = require('express');
const cors = require('cors');
const http = require('http');
const { WebSocketServer, CLOSING } = require('ws');

const PORT = process.env.PORT || 8787;

const app = express();
app.use(cors());
app.use(express.json());

const server = http.createServer(app);
const wss = new WebSocketServer({ server, path: '/ws' });

// Kết nối WS đang hoạt động & các yêu cầu đang chờ phản hồi
const clients = new Set();
const pending = new Map(); // id -> {resolve, reject, timer}

// --- Tiện ích ---
function broadcast(obj) {
  const data = JSON.stringify(obj);
  let sent = 0;
  for (const ws of clients) {
    if (ws.readyState === ws.OPEN) { ws.send(data); sent++; }
  }
  return sent;
}
function waitFor(id, timeoutMs = 25000) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      pending.delete(id);
      reject(new Error('timeout waiting for WS result'));
    }, timeoutMs);
    pending.set(id, { resolve, reject, timer });
  });
}

// --- WS hub ---
wss.on('connection', (ws) => {
  clients.add(ws);
  ws.on('close', () => clients.delete(ws));

  ws.on('message', (buf) => {
    let msg = {};
    try { msg = JSON.parse(buf.toString()); } catch {}
    const id = msg.id;

    // Trả kết quả cho HTTP nếu đang đợi theo id
    if (id && pending.has(id)) {
      const p = pending.get(id);
      clearTimeout(p.timer);
      pending.delete(id);
      p.resolve(msg); // trả nguyên payload extension gửi về
    }
  });

  // ws.send(JSON.stringify({ type: 'hello', t: Date.now() }));
});

// --- HTTP ---
app.get('/clients', (req, res) => res.json({ count: clients.size }));

// POST /push => broadcast & CHỜ kết quả trả về theo id (request/response)
app.post('/push', async (req, res) => {
  const body = req.body || {};
  const id = body.id || `req-${Date.now()}`;
  body.id = id;

  // Mặc định anchors khi gọi get_last_after mà thiếu anchors
  // if (body.type === 'get_last_after' && (!Array.isArray(body.anchors) || body.anchors.length === 0)) {
  //   body.anchors = ['tôi đã nói', 'bạn đã nói', 'chatgpt đã nói', 'you said'];
  // }

  if (clients.size === 0) return res.status(503).json({ ok:false, error:'no ws clients connected' });

  // Gửi lệnh cho extension
  broadcast(body);

  // Chờ extension trả về gói có cùng id (ví dụ: get_last_after_result)
  try {
    if (body.type === 'ask_block') {
        return res.json({ ok: true, id, result: 'ok' });
    }
    const result = await waitFor(id, 25000);
    // Gửi 1 lần nữa cho client khác
    const text =
      result?.text ??
      result?.result?.text ?? // đề phòng extension bọc thêm 1 lớp
      '';

    broadcast({
      type: 'push_result',
      id,
      text,
      payload: result,
      t: Date.now()
    });

    // Trả thẳng kết quả cho caller
    return res.json({ ok: true, id, result: result });
  } catch (e) {
    return res.status(504).json({ ok:false, id, error: e.message });
  }
});



server.listen(PORT, () => {
  console.log(`HTTP+WS on http://localhost:${PORT}`);
  console.log(`- WS: ws://localhost:${PORT}/ws`);
  console.log(`- POST /push ; GET /clients`);
});
