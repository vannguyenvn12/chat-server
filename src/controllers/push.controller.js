const { clientCount, broadcast, waitFor, emitPushResult, broadcastNewUrl } = require('../sockets/hub');
const { getOrCreateSingleConversation, saveFirstMe, saveLastAssistant, upsertAssistantReplace, upsertAssistantAppend } = require('../services/chat.service');
const { ulid } = require('ulid');
const { getState, setState, getOrCreateState, clearState } = require('../utils/stream-push-map');
const fs = require("fs");
const fsP = require('fs/promises');
const path = require("path");
const pdfParse = require('pdf-parse');

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

// exports.postPush = async (req, res) => {
//     const body = req.body || {};
//     const correlationId = body.id || `req-${Date.now()}`;
//     body.id = correlationId;

//     if (clientCount() === 0) {
//         return res.status(503).json({ ok: false, error: 'no socket.io clients connected' });
//     }

//     const conversation_id =
//         req.query.conversation_id ||
//         body.conversation_id ||
//         await getOrCreateSingleConversation();

//     let stream_key = getStreamKey(req, body);
//     const isFirstChunk = !!body.is_first;
//     const isFinalChunk = !!body.is_final;
//     if (!stream_key) stream_key = ulid();

//     // ✅ Lấy/khởi tạo state { push_id, me_id? }
//     const state = getOrCreateState(conversation_id, stream_key, () => ulid());
//     const storagePushId = state.push_id;
//     body.push_id = storagePushId;

//     // 1) Lưu user CHỈ khi có meText (thường là chunk đầu)
//     try {
//         const meText = pickOutboundText(body);
//         if (meText) {
//             const doc = await saveFirstMe({
//                 conversation_id,
//                 push_id: storagePushId,
//                 content: meText,
//                 meta: { stream_key },
//             });
//             // ✅ Cache lại me_id cho các chunk sau
//             if (doc?._id) {
//                 console.log('doc?._id', doc?._id);
//                 state.me_id = String(doc._id);
//                 setState(conversation_id, stream_key, state);
//             }
//         }
//     } catch (_) { }

//     // 2) Phát realtime
//     broadcast(body);

//     try {
//         if (body.type === 'ask_block') {
//             return res.json({ ok: true, id: correlationId, push_id: storagePushId, stream_key, result: 'ok' });
//         }

//         const result = await waitFor(correlationId, 25000);

//         const fullText = result?.text ?? result?.result?.text;
//         const delta = result?.delta ?? result?.result?.delta;

//         // ✅ Lấy me_id đã cache cho reply_to
//         const replyTo = state.me_id || null;
//         console.log('replyTo', replyTo)

//         try {
//             if (typeof fullText === 'string' && fullText.length) {
//                 await upsertAssistantReplace({
//                     conversation_id,
//                     push_id: storagePushId,
//                     content: fullText,
//                     meta: { stream_key },
//                     reply_to: replyTo,
//                 });
//             } else if (typeof delta === 'string' && delta.length) {
//                 await upsertAssistantAppend({
//                     conversation_id,
//                     push_id: storagePushId,
//                     delta,
//                     meta: { stream_key },
//                     reply_to: replyTo,
//                 });
//             }
//         } catch (_) { }

//         // 4) Kết thúc stream → dọn state
//         if (isFinalChunk) {
//             clearState(conversation_id, stream_key);
//         }

//         const text = fullText ?? delta ?? '';
//         emitPushResult({ type: 'push_result', id: correlationId, text, payload: result, t: Date.now() });

//         return res.json({ ok: true, id: correlationId, push_id: storagePushId, stream_key, result });
//     } catch (e) {
//         return res.status
//     }
// }






exports.postPush = async (req, res) => {
    const body = req.body || {};
    const correlationId = body.id || `req-${Date.now()}`;
    body.id = correlationId;

    console.log(body)

    if (clientCount() === 0) {
        return res.status(503).json({ ok: false, error: 'no socket.io clients connected' });
    }

    const conversation_id =
        req.query.conversation_id ||
        body.conversation_id ||
        await getOrCreateSingleConversation();

    let stream_key = getStreamKey(req, body);
    const isFirstChunk = !!body.is_first;
    const isFinalChunk = !!body.is_final;
    if (!stream_key) stream_key = ulid();

    // ✅ Lấy/khởi tạo state { push_id, me_id? }
    const state = getOrCreateState(conversation_id, stream_key, () => ulid());
    const storagePushId = state.push_id;
    body.push_id = storagePushId;


    // 2) Phát realtime
    body.prompt = `${body.attachments_text} - ${body.prompt}`
    broadcast(body);

    try {
        if (body.type === 'ask_block') {
            return res.json({ ok: true, id: correlationId, push_id: storagePushId, stream_key, result: 'ok' });
        }

        const result = await waitFor(correlationId, 25000);

        const fullText = result?.text ?? result?.result?.text;
        const delta = result?.delta ?? result?.result?.delta;

        // ✅ Lấy me_id đã cache cho reply_to
        const replyTo = state.me_id || null;
        console.log('replyTo', replyTo)


        // 4) Kết thúc stream → dọn state
        if (isFinalChunk) {
            clearState(conversation_id, stream_key);
        }

        const text = fullText ?? delta ?? '';
        emitPushResult({ type: 'push_result', id: correlationId, text, payload: result, t: Date.now() });

        return res.json({ ok: true, id: correlationId, push_id: storagePushId, stream_key, result });
    } catch (e) {
        return res.status
    }
}

exports.postNew = async (req, res) => {
    broadcastNewUrl();
    res.json({ ok: true })
}
