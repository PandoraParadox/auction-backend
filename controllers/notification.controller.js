const pool = require('../config/db');
const path = require("path");

exports.getNotificationById = async (req, res) => {
    const userId = req.params.userId;
    try {
        const [rows] = await pool.query(`SELECT * FROM notifications WHERE user_id = ?`, [userId]);
        const nofitiData = rows.map((nof) => {
            return {
                id: nof.id,
                message: nof.message,
                type: nof.type,
                sttus: nof.is_read,
                time: nof.created_at,
            }
        });
        res.json(nofitiData);
    }
    catch (err) {
        console.log(err);
        res.status(500).json({ error: 'System error' });
    }
};

exports.clearAll = async (req, res) => {
    const userId = req.params.userId;
    try {
        await pool.query(`DELETE FROM notifications WHERE user_id = ?`, [userId]);
        res.json("Clear complete");
    }
    catch (err) {
        console.log(err);
        res.status(500).json({ error: 'System error' });
    }
};

exports.markAllRead = async (req, res) => {
    const userId = req.params.userId;
    try {
        await pool.query(`UPDATE notifications SET is_read = 1 WHERE user_id = ?`, [userId]);
        res.json("Clear complete");
    }
    catch (err) {
        console.log(err);
        res.status(500).json({ error: 'System error' });
    }
}

exports.markOneRead = async (req, res) => {
    const { notificationId } = req.params;
    try {
        await pool.query(`UPDATE notifications SET is_read = 1 WHERE id = ?`, [notificationId]);
        res.json({ message: 'Marked as read' });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'System error' });
    }
};