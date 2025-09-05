const express = require('express');
const router = express.Router();
const ctrl = require('../controllers/push.controller');

// Giữ nguyên endpoints cũ: GET /clients, POST /push
router.get('/clients', ctrl.getClients);
router.post('/push', ctrl.postPush);

module.exports = router;
