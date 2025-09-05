const express = require('express');
const chatRoutes = express.Router();
const ctrl = require('../controllers/chat.controller');

// Conversation
// chatRoutes.post('', ctrl.createConversation);

// NEW: lấy toàn bộ lịch sử để client render sau mỗi push
chatRoutes.get('/:conversationId/messages', ctrl.listAllMessages);

module.exports = chatRoutes;
