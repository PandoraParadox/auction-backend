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

module.exports = pool;