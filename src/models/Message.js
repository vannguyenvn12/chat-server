const mongoose = require('mongoose');

const attachmentSchema = new mongoose.Schema({
    type: { type: String, enum: ['image', 'file', 'audio', 'video'] },
    url: String,
    name: String,
    size: Number,
}, { _id: false });

const messageSchema = new mongoose.Schema({
    conversation_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Conversation', required: true, index: true },
    role: { type: String, enum: ['me', 'assistant'], required: true },
    content: { type: String, default: '' },
    attachments: [attachmentSchema],
    reply_to: { type: mongoose.Schema.Types.ObjectId, ref: 'Message' },
    status: { type: String, enum: ['sent', 'read'], default: 'sent' },
    created_at: { type: Date, default: Date.now, index: true },

    // NEW: dùng để gom theo một lần /push (id của bạn)
    push_id: { type: String, index: true, sparse: true },
});

// sort theo hội thoại + thời gian
messageSchema.index({ conversation_id: 1, created_at: 1 });

// Bảo đảm MỖI (conversation, role, push_id) chỉ có 1 document
messageSchema.index(
    { conversation_id: 1, role: 1, push_id: 1 },
    { unique: true, partialFilterExpression: { push_id: { $type: 'string' } } }
);

module.exports = mongoose.model('Message', messageSchema);
