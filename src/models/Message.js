const mongoose = require('mongoose');

const attachmentSchema = new mongoose.Schema({
    type: { type: String, enum: ['image', 'file', 'audio', 'video'] },
    url: String
}, { _id: false });

const messageSchema = new mongoose.Schema({
    conversation_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Conversation', required: true },
    role: { type: String, enum: ['me', 'assistant'], required: true },
    content: { type: String, default: '' },
    attachments: [attachmentSchema],
    reply_to: { type: mongoose.Schema.Types.ObjectId, ref: 'Message' },
    status: { type: String, enum: ['sent', 'read'], default: 'sent' },
    created_at: { type: Date, default: Date.now }
});

messageSchema.index({ conversation_id: 1, created_at: 1 });

module.exports = mongoose.model('Message', messageSchema);
