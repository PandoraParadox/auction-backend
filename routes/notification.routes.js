const express = require('express');
const router = express.Router();
const { verifyTokenWithParam } = require('../middleware/auth');
const { verifyToken } = require('../middleware/auth');
const NotificationController = require('../controllers/notification.controller')

router.get('/:userId', verifyTokenWithParam, NotificationController.getNotificationById);

router.post('/clearAll/:userId', verifyTokenWithParam, NotificationController.clearAll);
router.post('/readAll/:userId', verifyTokenWithParam, NotificationController.markAllRead);
router.post('/markOneRead/:notificationId', NotificationController.markOneRead);


module.exports = router;
