// Socket.IO hub: giữ nguyên hành vi cũ, tách ra dạng module
const { Server } = require('socket.io');

let io = null;

// Kết nối Socket.IO đang hoạt động & các yêu cầu đang chờ phản hồi
const sockets = new Set();
const pending = new Map(); // id -> { resolve, reject, timer }

// === NEW: biến giữ "chủ ghế" hiện tại (độc quyền) ===
let occupantSocketId = null;
let occupantClientId = null; // nếu muốn so sánh theo clientId ổn định từ phía client

function initIO(server) {
    if (io) return io;

    io = new Server(server, {
        path: '/ws', // giữ nguyên path cũ
        cors: {
            origin: [
                'https://chat.openai.com',
                'https://chatgpt.com',
                'http://localhost:5173',
                'http://localhost:8787',
                'https://gpt.vannguyenv12.com',
            ],
            methods: ['GET', 'POST'],
            credentials: false,
        },
    });

    io.on('connection', (socket) => {
        sockets.add(socket);

        // === Exclusive seat: client yêu cầu giữ ghế ===
        socket.on('exclusive:claim', (payload = {}) => {
            const clientId = payload.clientId || socket.id;

            // Nếu chưa có ai giữ ghế -> chấp nhận
            if (!occupantSocketId) {
                occupantSocketId = socket.id;
                occupantClientId = clientId;
                socket.emit('exclusive:accept', { you: socket.id, clientId });
                return;
            }

            // Nếu chính chủ reconnect (cùng socketId hoặc cùng clientId) -> chấp nhận
            if (socket.id === occupantSocketId || (clientId && clientId === occupantClientId)) {
                occupantSocketId = socket.id;   // cập nhật socketId mới nếu reconnect
                occupantClientId = clientId;
                socket.emit('exclusive:accept', { you: socket.id, clientId });
                return;
            }

            // Đã có người dùng khác -> từ chối
            socket.emit('exclusive:reject', {
                by: occupantSocketId,
                reason: 'occupied',
            });
        });

        socket.on('disconnect', () => {
            sockets.delete(socket);

            // Nếu chủ ghế rời đi -> giải phóng ghế và thông báo cho mọi người
            if (socket.id === occupantSocketId) {
                occupantSocketId = null;
                occupantClientId = null;
                io.emit('exclusive:vacated'); // để client khác thử claim lại
            }
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
        socket.on('ext_ready', (_payload) => {
            // có thể log nếu muốn
        });
    });

    return io;
}

// --- Tiện ích ---
function clientCount() {
    return sockets.size;
}

function broadcast(obj) {
    if (!io) return 0;
    io.emit('server_push', obj); // event thống nhất
    return sockets.size;         // trả về số client đang kết nối (tham khảo)
}

function broadcastNewUrl(obj) {
    if (!io) return 0;
    io.emit('new_url', obj); // event thống nhất
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

function emitPushResult(payload) {
    if (!io) return;
    io.emit('push_result', payload);
}

// === (tuỳ chọn) expose trạng thái ghế để debug/endpoint /clients ===
function getOccupancy() {
    return {
        clients: sockets.size,
        occupied: !!occupantSocketId,
        occupantSocketId,
        occupantClientId,
    };
}

// === NEW: force disconnect API ===
function disconnectAllSockets(reason = 'admin_kick') {
    if (!io) return 0;

    const count = sockets.size;

    // Thông báo trước khi ngắt (client có thể log/cleanup)
    for (const s of Array.from(sockets)) {
        try {
            s.emit('server:disconnect', { reason });
        } catch (_) { }
    }

    // Thực sự cắt kết nối
    for (const s of Array.from(sockets)) {
        try {
            s.disconnect(true);    // true = close underlying connection
        } catch (_) { }
        sockets.delete(s);
    }

    // Dọn dẹp pending promises
    for (const [id, p] of pending.entries()) {
        try {
            clearTimeout(p.timer);
            p.reject(new Error('force-disconnect'));
        } catch (_) { }
        pending.delete(id);
    }

    // Reset trạng thái ghế độc quyền
    occupantSocketId = null;
    occupantClientId = null;

    return count; // trả về số lượng socket đã ngắt
}

/**
 * Gắn endpoint Express để "kill all sockets"
 * @param {import('express').Express} app
 * @param {{ path?: string, token?: string }} opts
 *  - path: đường dẫn endpoint (mặc định: '/admin/sockets/kill-all')
 *  - token: mã quản trị; request phải gửi header 'x-admin-token' = token này
 */
function attachKillAllEndpoint(app, opts = {}) {
    const path = opts.path || '/admin/sockets/kill-all';
    const token = opts.token || ''; // nếu rỗng thì không bắt buộc token (không khuyến nghị)

    app.post(path, (req, res) => {
        // if (token) {
        //     const provided = req.header('x-admin-token') || '';
        //     if (provided !== token) {
        //         return res.status(401).json({ ok: false, error: 'unauthorized' });
        //     }
        // }

        const reason = (req.body && req.body.reason) || 'admin_kick';
        const killed = disconnectAllSockets(reason);

        return res.json({
            ok: true,
            killed,
            reason,
            // trạng thái sau khi ngắt
            occupancy: getOccupancy(),
        });
    });
}

module.exports = {
    initIO,
    clientCount,
    broadcast,
    broadcastNewUrl,
    waitFor,
    emitPushResult,
    // optional
    getOccupancy,
    disconnectAllSockets, attachKillAllEndpoint
};
