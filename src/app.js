const express = require('express');
const cors = require('cors');

const pushRoutes = require('./routes/push.routes');
const chatRoutes = require('./routes/chat.routes');

const app = express();
app.disable('etag');
app.use((err, req, res, next) => {
    if (err && err.code && err.field) {
        return res.status(400).json({ ok: false, error: `${err.code} on field ${err.field}` });
    }
    if (err) return res.status(500).json({ ok: false, error: String(err) });
    next();
});


app.use(cors({
    origin: [
        'https://chat.openai.com',
        'https://chatgpt.com',
        'http://localhost:5173',
        'http://localhost:8787',
        'https://d335dc940374.ngrok-free.app',
        'https://gpt.vannguyenv12.com',
        '*'
    ],
    methods: ['GET', 'POST'],
    credentials: false,
}));
app.use(express.json());

// Mount trực tiếp tại root để đường dẫn giữ nguyên
app.use('/', pushRoutes);
app.use('/conversations', chatRoutes);

module.exports = app;
