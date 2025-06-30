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
        const [result] = await conn.query(`
            ALTER TABLE product 
            MODIFY COLUMN startingPrice DECIMAL(20, 0)
        `);
        console.log("✅ Cột 'startingPrice' đã được chỉnh sửa thành DECIMAL(20, 0)");
        conn.release();
    } catch (err) {
        console.error("❌ Không thể chỉnh sửa cột 'startingPrice':", err.message);
    }
})();

module.exports = pool;
