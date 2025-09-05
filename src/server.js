// server.js
// npm i express cors socket.io
const express = require('express');
const cors = require('cors');
const http = require('http');
const { Server } = require('socket.io');

const PORT = process.env.PORT || 8787;

const app = express();
app.use(cors());
app.use(express.json());

const server = http.createServer(app);

// ===== Socket.IO =====
// Dùng path '/ws' để giữ tương thích URL cũ (ws://localhost:8787/ws)
const io = new Server(server, {
  path: '/ws',
  cors: {
    origin: [
      'https://chat.openai.com',
      'https://chatgpt.com',
      'http://localhost:5173', // nếu bạn dev Vite
      'http://localhost:8787'
    ],
    methods: ['GET', 'POST'],
    credentials: false,
  },
});

// Kết nối Socket.IO đang hoạt động & các yêu cầu đang chờ phản hồi
const sockets = new Set();
const pending = new Map(); // id -> {resolve, reject, timer}

// --- Tiện ích ---
function broadcast(obj) {
  io.emit('server_push', obj); // event thống nhất
  return sockets.size;         // trả về số client đang kết nối (tham khảo)
}

function waitFor(id, timeoutMs = 25000) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      pending.delete(id);
      reject(new Error('timeout waiting for client_result'));
    }, timeoutMs);
    pending.set(id, { resolve, reject, timer });
  });
}

// --- Socket.IO hub ---
io.on('connection', (socket) => {
  sockets.add(socket);
  // console.log('[io] connected', socket.id);

  socket.on('disconnect', () => {
    sockets.delete(socket);
    // console.log('[io] disconnected', socket.id);
  });

  // Extension/clients gửi kết quả về đây
  socket.on('client_result', (msg = {}) => {
    const id = msg.id;
    if (!id) return;
    if (pending.has(id)) {
      const p = pending.get(id);
      clearTimeout(p.timer);
      pending.delete(id);
      p.resolve(msg); // trả nguyên payload extension gửi về
    }
  });

  // (tùy chọn) extension có thể ping ready
  socket.on('ext_ready', (payload) => {
    // console.log('[io] ext_ready', socket.id, payload);
  });
});

// --- HTTP ---
app.get('/clients', (req, res) => res.json({ count: sockets.size }));

// POST /push => broadcast & CHỜ kết quả trả về theo id (request/response)
app.post('/push', async (req, res) => {
  const body = req.body || {};
  const id = body.id || `req-${Date.now()}`;
  body.id = id;

  if (sockets.size === 0) {
    return res.status(503).json({ ok: false, error: 'no socket.io clients connected' });
  }

  // Gửi lệnh cho extension qua Socket.IO
  broadcast(body);

  try {
    // ask_block không cần chờ — giữ hành vi cũ
    if (body.type === 'ask_block') {
      return res.json({ ok: true, id, result: 'ok' });
    }

    // Chờ extension emit 'client_result' cùng id
    const result = await waitFor(id, 25000);

    // Phát lại cho tất cả (cho UI khác có thể lắng nghe)
    const text =
      result?.text ??
      result?.result?.text ?? // đề phòng client bọc
      '';

    io.emit('push_result', {
      type: 'push_result',
      id,
      text,
      payload: result,
      t: Date.now(),
    });

    return res.json({ ok: true, id, result });
  } catch (e) {
    return res.status(504).json({ ok: false, id, error: e.message });
  }
});

server.listen(PORT, () => {
  console.log(`HTTP+Socket.IO on http://localhost:${PORT}`);
  console.log(`- Socket.IO path: ws://localhost:${PORT}/ws`);
  console.log(`- POST /push ; GET /clients`);
});
