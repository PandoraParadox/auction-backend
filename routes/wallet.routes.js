const express = require('express');
const router = express.Router();
const walletController = require('../controllers/wallet.controller');
const { verifyTokenWithParam } = require('../middleware/auth');
const { verifyToken } = require('../middleware/auth');

router.post("/", verifyToken, walletController.createWallet);
router.get("/:userId", walletController.getWalletByUserId);

router.post("/transaction", verifyToken, walletController.createTransaction);
router.get("/transactions/:userId", walletController.getTransactionsByUserId);
router.get("/gettrans/all", walletController.getAllTransactions);

module.exports = router;

