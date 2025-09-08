const express = require('express');
const router = express.Router();
const ctrl = require('../controllers/push.controller');
const correlationId = require('../middlewares/correlation-id');
const { uploadMiddleware } = require('../utils/upload');

// Giữ nguyên endpoints cũ: GET /clients, POST /push
router.get('/clients', ctrl.getClients);
router.post('/push', correlationId(), uploadMiddleware, ctrl.postPush);
router.post('/push/new', ctrl.postNew);

module.exports = router;
