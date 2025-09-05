const { clientCount, broadcast, waitFor, emitPushResult } = require('../sockets/hub');
const { getOrCreateSingleConversation, saveFirstMe, saveLastAssistant } = require('../services/chat.service');

function pickOutboundText(body) {
    return body.prompt ?? body.message ?? body.text ?? JSON.stringify(body);
}
function pickInboundText(result) {
    return result?.text ?? result?.result?.text ?? JSON.stringify(result ?? {});
}

exports.getClients = (req, res) => res.json({ count: clientCount() });

exports.postPush = async (req, res) => {
    const body = req.body || {};
    const id = body.id || `req-${Date.now()}`;
    body.id = id;

    if (clientCount() === 0) {
        return res.status(503).json({ ok: false, error: 'no socket.io clients connected' });
    }

    const conversation_id =
        req.query.conversation_id ||
        req.body.conversation_id ||
        await getOrCreateSingleConversation();

    // === LƯU TIN ĐẦU (ME) — chỉ 1 lần cho mỗi push_id ===
    try {
        const meText = pickOutboundText(body);
        if (typeof meText === 'string' && meText.length) {
            await saveFirstMe({ conversation_id, push_id: id, content: meText });
        }
    } catch (_) { /* không chặn flow */ }

    // broadcast như cũ
    broadcast(body);

    try {
        if (body.type === 'ask_block') {
            return res.json({ ok: true, id, result: 'ok' });
        }

        const result = await waitFor(id, 25000);

        // === LƯU TIN CUỐI (ASSISTANT) — luôn ghi đè theo push_id ===
        try {
            const asText = pickInboundText(result);
            if (typeof asText === 'string' && asText.length) {
                await saveLastAssistant({ conversation_id, push_id: id, content: asText });
            }
        } catch (_) { /* không chặn flow */ }

        const text = pickInboundText(result);
        emitPushResult({ type: 'push_result', id, text, payload: result, t: Date.now() });

        return res.json({ ok: true, id, result });
    } catch (e) {
        return res.status(504).json({ ok: false, id, error: e.message });
    }
};
