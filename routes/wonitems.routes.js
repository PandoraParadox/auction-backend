const express = require('express');
const router = express.Router();
const { verifyTokenWithParam } = require('../middleware/auth');
const { verifyToken } = require('../middleware/auth');
const wonitemController = require("../controllers/wonitems.controller")

router.get('/:userId', verifyTokenWithParam, wonitemController.getWonItem);

router.post('/confirm/:productID', verifyToken, wonitemController.confirmPayment);

router.get('/payments/:id', verifyToken, wonitemController.detailWonitem);

router.post('/received/:productID', verifyToken, wonitemController.confirmReceived);

router.get('/pendingItem/:userId', verifyTokenWithParam, wonitemController.getPendingItem);


module.exports = router;