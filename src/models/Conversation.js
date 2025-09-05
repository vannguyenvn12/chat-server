const mongoose = require('mongoose');

const conversationSchema = new mongoose.Schema({
    title: { type: String, default: "Chat with Assistant" },
    created_at: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Conversation', conversationSchema);
