const { clientCount, broadcast, waitFor, emitPushResult } = require('../sockets/hub');
const { getOrCreateSingleConversation, saveFirstMe, saveLastAssistant, upsertAssistantReplace, upsertAssistantAppend } = require('../services/chat.service');
const { ulid } = require('ulid');
const { getOrCreateStoragePushId, clearStoragePushId } = require('../utils/stream-push-map');

function looksLikeJSON(str) {
    if (typeof str !== 'string') return false;
    const s = str.trim();
    if (!(s.startsWith('{') || s.startsWith('['))) return false;
    try { JSON.parse(s); return true; } catch { return false; }
}

function pickOutboundText(body) {
    // Ưu tiên chuỗi "người gõ" thay vì toàn bộ body
    const candidates = [body.prompt, body.message, body.text];

    for (const v of candidates) {
        if (typeof v === 'string' && v.trim()) {
            // nếu chuỗi là JSON → bỏ
            if (!looksLikeJSON(v)) return v.trim();
        }
    }
    // Không fallback stringify(body) nữa để tránh lưu JSON
    return '';
}

function pickInboundText(result) {
    return result?.text ?? result?.result?.text ?? JSON.stringify(result ?? {});
}

exports.getClients = (req, res) => res.json({ count: clientCount() });

function getStreamKey(req, body) {
    return body.stream_key || req.query.stream_key || body.parent_id || body.root_id;
}

exports.postPush = async (req, res) => {
    const body = req.body || {};
    const correlationId = body.id || `req-${Date.now()}`;
    body.id = correlationId;

    if (clientCount() === 0) {
        return res.status(503).json({ ok: false, error: 'no socket.io clients connected' });
    }

    const conversation_id =
        req.query.conversation_id ||
        body.conversation_id ||
        await getOrCreateSingleConversation();

    // Stream flags do client gán
    let stream_key = getStreamKey(req, body);
    const isFirstChunk = !!body.is_first;
    const isFinalChunk = !!body.is_final;

    // Nếu không có stream_key ở chunk đầu → tự sinh
    if (!stream_key) stream_key = ulid();

    // Push ID ổn định cho cả stream
    const storagePushId = getOrCreateStoragePushId(conversation_id, stream_key);
    body.push_id = storagePushId;

    // 1) Lưu user ở CHUNK ĐẦU
    try {
        const meText = pickOutboundText(body);
        if (meText) {
            await saveFirstMe({
                conversation_id,
                push_id: storagePushId,
                content: meText,
                meta: { stream_key },
            });
        }
    } catch (_) { }

    // 2) Phát realtime
    broadcast(body);

    try {
        if (body.type === 'ask_block') {
            return res.json({ ok: true, id: correlationId, push_id: storagePushId, stream_key, result: 'ok' });
        }

        const result = await waitFor(correlationId, 25000);

        // 3) Ghi assistant: full hoặc delta
        const fullText = result?.text ?? result?.result?.text;
        const delta = result?.delta ?? result?.result?.delta;

        try {
            if (typeof fullText === 'string' && fullText.length) {
                await upsertAssistantReplace({
                    conversation_id,
                    push_id: storagePushId,
                    content: fullText,
                    meta: { stream_key },
                });
            } else if (typeof delta === 'string' && delta.length) {
                await upsertAssistantAppend({
                    conversation_id,
                    push_id: storagePushId,
                    delta,
                    meta: { stream_key },
                });
            }
        } catch (_) { }

        // 4) Kết thúc stream → dọn map
        if (isFinalChunk) {
            clearStoragePushId(conversation_id, stream_key);
        }

        const text = fullText ?? delta ?? '';
        emitPushResult({ type: 'push_result', id: correlationId, text, payload: result, t: Date.now() });

        return res.json({ ok: true, id: correlationId, push_id: storagePushId, stream_key, result });
    } catch (e) {
        return res.status(504).json({ ok: false, id: correlationId, push_id: storagePushId, stream_key, error: e.message });
    }
};
