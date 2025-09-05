const express = require('express');
const router = express.Router();
const ctrl = require('../controllers/push.controller');
const correlationId = require('../middlewares/correlation-id');

// Giữ nguyên endpoints cũ: GET /clients, POST /push
router.get('/clients', ctrl.getClients);
router.post('/push', correlationId(), ctrl.postPush);

module.exports = router;
