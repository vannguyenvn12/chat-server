const Conversation = require('../models/Conversation');
const Message = require('../models/Message');

let SINGLE_CONVO_ID = null;

async function listAllMessages({ conversation_id }) {
    return Message.find({})
        .sort({ created_at: 1 })
        .lean();
}


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
    const res = await Message.findOneAndUpdate(
        { conversation_id, role: 'me', push_id },
        { $setOnInsert: { content, status: 'sent', created_at: new Date() } },
        { upsert: true, new: true, setDefaultsOnInsert: true }
    );

    return res;
}

/**
 * LƯU TIN CUỐI (ASSISTANT): luôn ghi đè nội dung theo push_id (upsert)
 * => đảm bảo chỉ còn 1 bản cuối cùng
 */
async function getOrCreateSingleConversation() {
    if (SINGLE_CONVO_ID) return SINGLE_CONVO_ID;
    const convo = await Conversation.create({ title: 'Chat with Assistant' });
    SINGLE_CONVO_ID = convo._id;
    return SINGLE_CONVO_ID;
}


/** Giữ nguyên: assistant đã là “lần cuối” */
async function saveLastAssistant({ conversation_id, push_id, content }) {
    if (!push_id) throw new Error('saveLastAssistant requires push_id');
    const doc = await Message.findOneAndUpdate(
        { conversation_id, role: 'assistant', push_id },
        {
            $set: {
                content,
                status: 'sent',
                created_at: new Date(),
            },
        },
        { upsert: true, new: true, setDefaultsOnInsert: true }
    ).lean();
    return doc;
}

// Upsert assistant theo kiểu REPLACE (full text tạm thời)
async function upsertAssistantReplace({ conversation_id, push_id, content, meta, reply_to }) {
    return Message.findOneAndUpdate(
        { conversation_id, role: 'assistant', reply_to, push_id },
        {
            $set: {
                content,
                ...(meta ? { meta } : {}),
                updated_at: new Date(),
            },
            $setOnInsert: { created_at: new Date() },
        },
        { upsert: true, new: true }
    );
}

// Upsert assistant theo kiểu APPEND (delta)
async function upsertAssistantAppend({ conversation_id, push_id, delta, meta, reply_to }) {
    // ⚠️ YÊU CẦU MongoDB cho phép "aggregation pipeline update"
    return Message.findOneAndUpdate(
        { conversation_id, role: 'assistant', reply_to, push_id },
        [
            {
                $set: {
                    content: { $concat: [{ $ifNull: ['$content', ''] }, delta] },
                    ...(meta ? { meta } : {}),
                    updated_at: new Date(),
                },
            },
            {
                $set: { created_at: { $ifNull: ['$created_at', new Date()] } }
            }
        ],
        { upsert: true, new: true }
    );
}

module.exports = {
    getOrCreateSingleConversation,
    saveFirstMe,
    saveLastAssistant,
    listAllMessages,
    upsertAssistantReplace,
    upsertAssistantAppend
};
