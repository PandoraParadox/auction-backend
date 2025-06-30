const mysql = require("mysql2/promise");
require("dotenv").config();

const pool = mysql.createPool({
    host: process.env.MYSQL_HOST,
    user: process.env.MYSQL_USER,
    password: process.env.MYSQL_PASSWORD,
    database: process.env.MYSQL_DATABASE,
    typeCast: function (field, next) {
        if (field.type === "JSON" || field.type === "TEXT") {
            const val = field.string();
            return val ? JSON.parse(val) : null;
        }
        return next();
    }
});

(async () => {
    try {
        const conn = await pool.getConnection();
        console.log("Database connection successful!");
        conn.release(); 
    } catch (err) {
        console.error(" Database connection failed:", err.message);
        process.exit(1); 
    }
})();
(async () => {
    try {
        const conn = await pool.getConnection();

        const alterStatements = [
            `ALTER TABLE product MODIFY COLUMN highest_bid DECIMAL(20, 0)`,
            `ALTER TABLE bid_history MODIFY COLUMN bid_amount DECIMAL(20, 0)`,
            `ALTER TABLE wallets MODIFY COLUMN balance DECIMAL(20, 0)`,
            `ALTER TABLE wallets MODIFY COLUMN pending_bids DECIMAL(20, 0)`,
            `ALTER TABLE wallet_transactions MODIFY COLUMN amount DECIMAL(20, 0)`,
            `ALTER TABLE won_items MODIFY COLUMN final_price DECIMAL(20, 0)`
        ];

        for (const sql of alterStatements) {
            try {
                await conn.query(sql);
                console.log(`✅ Đã cập nhật: ${sql}`);
            } catch (err) {
                console.error(`❌ Lỗi khi cập nhật: ${sql}\n   ↳ ${err.message}`);
            }
        }

        conn.release();
    } catch (err) {
        console.error("❌ Lỗi kết nối khi cập nhật schema:", err.message);
    }
})();

module.exports = pool;
