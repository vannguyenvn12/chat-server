require('dotenv').config();
const http = require('http');
const app = require('./app');
const { initIO, attachKillAllEndpoint } = require('./sockets/hub');
const { connectDB } = require('./config/db');

const PORT = process.env.PORT || 8787;

(async () => {
  await connectDB(process.env.MONGO_URL);

  const server = http.createServer(app);
  initIO(server);

  // Gắn endpoint kill-all, bảo vệ bằng token
  attachKillAllEndpoint(app, {
    path: '/admin/sockets/kill-all',
    token: process.env.SOCKETS_ADMIN_TOKEN, // đặt biến môi trường
  });

  server.listen(PORT, () => {
    console.log(`HTTP+Socket.IO on http://localhost:${PORT}`);
    console.log(`- Socket.IO path: ws://localhost:${PORT}/ws`);
    console.log(`- POST /push ; GET /clients`);
  });
})();
