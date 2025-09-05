const express = require('express');
const router = express.Router();
const ctrl = require('../controllers/chat.controller');

// Conversation
router.post('/conversations', ctrl.createConversation);

// Messages
router.get('/conversations/:conversationId/messages', ctrl.listMessages);
router.post('/conversations/:conversationId/messages', ctrl.sendMessage);

module.exports = router;
