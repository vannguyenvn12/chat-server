const express = require('express');
const cors = require('cors');

const pushRoutes = require('./routes/push.routes');
const chatRoutes = require('./routes/chat.routes');

const app = express();
app.disable('etag');

app.use(cors({
    origin: [
        'https://chat.openai.com',
        'https://chatgpt.com',
        'http://localhost:5173',
        'http://localhost:8787',
    ],
    methods: ['GET', 'POST'],
    credentials: false,
}));
app.use(express.json());

// Mount trực tiếp tại root để đường dẫn giữ nguyên
app.use('/', pushRoutes);
app.use('/conversations', chatRoutes);

module.exports = app;
