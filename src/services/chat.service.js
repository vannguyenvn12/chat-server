const Conversation = require('../models/Conversation');
const Message = require('../models/Message');

let SINGLE_CONVO_ID = null;

async function getOrCreateSingleConversation() {
    if (SINGLE_CONVO_ID) return SINGLE_CONVO_ID;
    const convo = await Conversation.create({ title: 'Chat with Assistant' });
    SINGLE_CONVO_ID = convo._id;
    return SINGLE_CONVO_ID;
}

/**
 * LƯU TIN ĐẦU (ME): chỉ setOnInsert — nếu đã có cùng (convo, 'me', push_id) thì bỏ qua
 */
async function saveFirstMe({ conversation_id, push_id, content }) {
    if (!push_id) throw new Error('saveFirstMe requires push_id');
    const doc = await Message.findOneAndUpdate(
        { conversation_id, role: 'me', push_id },
        { $setOnInsert: { content, status: 'sent', created_at: new Date() } },
        { upsert: true, new: true, setDefaultsOnInsert: true }
    ).lean();
    return doc;
}

/**
 * LƯU TIN CUỐI (ASSISTANT): luôn ghi đè nội dung theo push_id (upsert)
 * => đảm bảo chỉ còn 1 bản cuối cùng
 */
async function saveLastAssistant({ conversation_id, push_id, content }) {
    if (!push_id) throw new Error('saveLastAssistant requires push_id');
    const doc = await Message.findOneAndUpdate(
        { conversation_id, role: 'assistant', push_id },
        {
            $set: {
                content,
                status: 'sent',
                // có thể cập nhật created_at để “đẩy lên” theo thời điểm hoàn tất,
                // hoặc bỏ dòng dưới để giữ mốc lần đầu. Ở đây ta giữ mốc hoàn tất:
                created_at: new Date(),
            },
        },
        { upsert: true, new: true, setDefaultsOnInsert: true }
    ).lean();
    return doc;
}

module.exports = {
    getOrCreateSingleConversation,
    saveFirstMe,
    saveLastAssistant,
};
