require('dotenv').config();
const http = require('http');
const app = require('./app');
const { initIO } = require('./sockets/hub');
const { connectDB } = require('./config/db');

const PORT = process.env.PORT || 8787;

(async () => {
  await connectDB(process.env.MONGO_URL);

  const server = http.createServer(app);
  initIO(server);

  server.listen(PORT, () => {
    console.log(`HTTP+Socket.IO on http://localhost:${PORT}`);
    console.log(`- Socket.IO path: ws://localhost:${PORT}/ws`);
    console.log(`- POST /push ; GET /clients`);
  });
})();
