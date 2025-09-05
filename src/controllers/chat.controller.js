const asyncHandler = require('../middlewares/asyncHandler');
const { listAllMessages } = require('../services/chat.service');

exports.listAllMessages = asyncHandler(async (req, res) => {
    const { conversationId } = req.params;
    const data = await listAllMessages({ conversation_id: conversationId });
    res.json({ ok: true, messages: data });
});
