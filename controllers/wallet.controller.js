const path = require("path");
const db = require("../config/db");
const admin = require('../config/firebase');

exports.createWallet = async (req, res) => {
    const { user_id } = req.body;
    try {
        const [exists] = await db.query("SELECT * FROM wallets WHERE user_id = ?", [user_id]);
        if (exists.length > 0) return res.json({ message: "Wallet already exists" });

        await db.query("INSERT INTO wallets (user_id) VALUES (?)", [user_id]);
        res.json({ message: "Wallet created" });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

exports.getWalletByUserId = async (req, res) => {
    const userId = req.params.userId;
    try {
        const [rows] = await db.query("SELECT * FROM wallets WHERE user_id = ?", [userId]);
        if (rows.length === 0) return res.status(404).json({ message: "Wallet not found" });
        res.json(rows[0]);
    } catch (error) {
        await db.rollback();
        res.status(500).json({ error: error.message });
    }
};

exports.createTransaction = async (req, res) => {
    const { user_id, type, amount, description } = req.body;
    try {
        const [[wallet]] = await db.query("SELECT * FROM wallets WHERE user_id = ?", [user_id]);
        if (!wallet) return res.status(404).json({ message: "Wallet not found" });
        const newBalance =
            type === "Add Funds" ? parseFloat(wallet.balance) + parseFloat(amount) : type === "Withdrawal" || type === "Confirm" ? wallet.balance - amount : wallet.balance;

        const newPending = type === "Confirm" ? parseFloat(wallet.pending_bids) - parseFloat(amount) : wallet.pending_bids;

        if (type !== "Confirm" && (newBalance < 0 || newBalance < wallet.pending_bids)) {
            return res.status(500).json({ message: "Invalid balance" });
        } else if (type === "Confirm" && (newBalance < 0 || newBalance < newPending)) {
            return res.status(500).json({ message: "Invalid balance" });
        }

        await db.query("INSERT INTO wallet_transactions (wallet_id, type, amount, description, created_at) VALUES (?, ?, ?, ?, NOW())",
            [wallet.id, type, amount, description]);

        await db.query("UPDATE wallets SET balance = ?, pending_bids = ? WHERE id = ?",
            [newBalance, newPending, wallet.id]);

        res.json({ message: "Transaction completed" });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

exports.getTransactionsByUserId = async (req, res) => {
    const userId = req.params.userId;
    try {
        const [[wallet]] = await db.query("SELECT * FROM wallets WHERE user_id = ?", [userId]);
        if (!wallet) return res.status(404).json({ message: "Wallet not found" });

        const [transactions] = await db.query(
            "SELECT * FROM wallet_transactions WHERE wallet_id = ? ORDER BY created_at DESC",
            [wallet.id]
        );
        res.json(transactions);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

exports.getAllTransactions = async (req, res) => {
    try {
        const [trans] = await db.query(`
            SELECT 
                wt.id,
                wt.wallet_id,
                w.user_id,
                wt.type,
                wt.amount,
                wt.description,
                wt.created_at
            FROM wallet_transactions wt
            JOIN wallets w ON wt.wallet_id = w.id
            ORDER BY wt.id ASC
        `);
        res.json(trans);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

