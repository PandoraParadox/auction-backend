const pool = require('../config/db');
const path = require("path");
async function recalculatePending(userId) {
    const [rows] = await pool.query(`
        SELECT SUM(final_price) AS total_pending
        FROM won_items 
        WHERE user_id = ? AND status = 'Pending'
    `, [userId]);

    const totalPending = rows[0].total_pending || 0;

    await pool.query(`
        UPDATE wallets SET pending_bids = ? WHERE user_id = ?
    `, [totalPending, userId]);
}
exports.getWonItem = async (req, res) => {
    const userId = req.params.userId;
    try {
        const [toBeCancelled] = await pool.query(`SELECT p.name FROM won_items wi JOIN product p ON wi.product_id = p.id WHERE wi.user_id = ? AND wi.status NOT IN ('Delivered', 'Received', 'Cancel') AND wi.created_at < NOW()`, [userId]);
        const [cancelResult] = await pool.query(`
            UPDATE won_items 
            SET status = 'Cancel' 
            WHERE user_id = ? 
              AND status NOT IN ('Delivered', 'Received', 'Cancel') 
              AND created_at < NOW()
        `, [userId]);


        if (cancelResult.affectedRows > 0) {
            await recalculatePending(userId);

            for (const item of toBeCancelled) {
                const message = `Your product "${item.name}" is overdue.`;
                await pool.query(
                    `INSERT INTO notifications(user_id, message, type, is_read) VALUES (?,?,?,0)`,
                    [userId, message, "cancel"]
                );
            }
        }

        const [rows] = await pool.query(
            `SELECT wi.id AS won_item_id, p.id AS product_id, p.name, wi.final_price, wi.status, wi.won_at ,wi.payment_due, p.images, wi.created_at
             FROM won_items wi
             JOIN product p ON wi.product_id = p.id
             WHERE wi.user_id = ? and wi.status NOT IN ('Received', 'Cancel')`,
            [userId]
        );

        const wonItems = rows.map((row) => {
            const images = row.images ? JSON.parse(row.images) : [];
            return {
                id: row.won_item_id,
                productID: row.product_id,
                name: row.name,
                price: row.final_price || 0,
                status: row.status,
                date: row.won_at,
                payment_due: row.payment_due,
                created_at: row.created_at,
                image: images.length > 0 ? images[0] : '',
            };
        });

        res.json(wonItems);
    } catch (error) {
        console.error('Error while getting list of won items:', error);
        res.status(500).json({ error: 'System error' });
    }
};

exports.confirmPayment = async (req, res) => {
    const connection = await pool.getConnection();
    try {
        await connection.beginTransaction();

        const productId = req.params.productID;
        const { id, address, shipMethod, phone } = req.body;
        const userId = req.user.uid;

        await connection.query(
            `UPDATE won_items SET status = ? WHERE product_id = ? AND user_id = ?`,
            ['Delivered', productId, userId]
        );
        await connection.query(
            `INSERT INTO payments (user_id, won_item_id,  paid_at, shipping_method, shipping_address, phoneNumber, deliveredTime) 
             VALUES (?, ?, NOW(), ?, ?, ?, DATE_ADD(NOW(), INTERVAL 4 DAY))`,
            [userId, id, shipMethod, address, phone]
        );
        const [productRows] = await connection.query(
            `SELECT name FROM product WHERE id = ?`,
            [productId]
        );
        const productName = productRows.length > 0 ? productRows[0].name : 'your product';

        await pool.query(`INSERT INTO notifications(user_id, message, type, is_read) VALUES (?,?,?,0)`, [userId, `Payment confirmation for "${productName}" successful.`, "confirm"]);

        await connection.commit();
        res.status(200).json({ message: 'Payment confirmation successful' });
    } catch (err) {
        await connection.rollback();
        res.status(500).json({ error: 'Payment confirmation error' });
    } finally {
        connection.release();
    }
};

exports.detailWonitem = async (req, res) => {
    const itemId = req.params.id;
    const connection = await pool.getConnection();
    try {
        const [rows] = await connection.query(`
            SELECT 
                pay.phoneNumber,
                pay.shipping_address,
                pay.shipping_method,
                pay.deliveredTime,
                p.description
            FROM payments pay
            JOIN won_items wi ON pay.won_item_id = wi.id
            JOIN product p ON wi.product_id = p.id
            WHERE pay.won_item_id = ?
        `, [itemId]);

        if (rows.length === 0) return res.status(404).json({ error: 'Item not found' });

        res.json(rows[0]);
    } catch (error) {
        await connection.rollback();
        console.error("Error querying product details won:", error);
        res.status(500).json({ error: 'Internal server error' });
    } finally {
        connection.release();
    }
};

exports.confirmReceived = async (req, res) => {
    const itemId = req.params.productID;
    const userId = req.user.uid;
    const connection = await pool.getConnection();
    try {
        await connection.query(
            `UPDATE won_items SET status = ? WHERE id = ? AND user_id = ?`,
            ['Received', itemId, userId]
        );
        await connection.commit();
        res.status(200).json({ message: 'Received done' });
    } catch (err) {
        await connection.rollback();
        console.log(err);
        res.status(500).json({ error: 'Received fail' })
    } finally {
        connection.release();
    }
};

exports.getPendingItem = async (req, res) => {
    const userId = req.params.userId;
    try {
        const [rows] = await pool.query(`SELECT wi.id AS won_item_id, p.id AS product_id, p.name, wi.final_price, wi.status, wi.won_at ,wi.payment_due, p.images, wi.created_at
             FROM won_items wi
             JOIN product p ON wi.product_id = p.id
             WHERE wi.user_id = ? and wi.status = 'Pending'`, [userId]);
        res.status(200).json(rows);
    } catch (err) {
        console.error('Error while getting list of pending items:', err);
        res.status(500).json({ error: 'System error' });
    }
};