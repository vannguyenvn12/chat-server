const asyncHandler = require('../middlewares/asyncHandler');
const { createConversation, listMessages, sendMessage } = require('../services/chat.service');

exports.createConversation = asyncHandler(async (req, res) => {
    const { title } = req.body || {};
    const convo = await createConversation({ title });
    res.json({ ok: true, conversation: convo });
});

exports.listMessages = asyncHandler(async (req, res) => {
    const { conversationId } = req.params;
    const { cursor, direction = 'backward', limit = 30 } = req.query;

    const result = await listMessages({
        conversationId,
        cursor,
        direction,
        limit: Number(limit)
    });

    res.json({ ok: true, ...result });
});

exports.sendMessage = asyncHandler(async (req, res) => {
    const { conversationId } = req.params;
    const { role, content, attachments, reply_to } = req.body || {};

    const message = await sendMessage({
        conversationId,
        role,
        content,
        attachments,
        reply_to
    });

    res.json({ ok: true, message });
});
