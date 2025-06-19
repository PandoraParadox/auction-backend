const mysql = require('mysql2/promise');
require('dotenv').config();

(async () => {
  const connection = await mysql.createConnection({
    host: process.env.MYSQL_HOST,
    user: process.env.MYSQL_USER,
    password: process.env.MYSQL_PASSWORD,
    database: process.env.MYSQL_DATABASE
  });

  try {
    console.log("🚀 Initializing database...");

    // 👉 Tạo bảng KHÔNG có foreign key trước
    await connection.query(`
      CREATE TABLE IF NOT EXISTS product (
        id INT AUTO_INCREMENT PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        startingPrice DECIMAL(10,2) NOT NULL,
        auctionTime DATETIME NOT NULL,
        category VARCHAR(100),
        images LONGTEXT CHARACTER SET utf8mb4 COLLATE utf8mb4_bin,
        description TEXT,
        highest_bid DECIMAL(10,2),
        highest_bidder_user VARCHAR(255)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
    `);

    await connection.query(`
      CREATE TABLE IF NOT EXISTS won_items (
        id INT AUTO_INCREMENT PRIMARY KEY,
        user_id CHAR(28) NOT NULL,
        product_id INT NOT NULL,
        final_price DECIMAL(10,2) NOT NULL,
        status ENUM('Pending','Delivered','Received','Cancel') DEFAULT 'Pending',
        won_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        created_at DATETIME DEFAULT NULL,
        payment_due DATETIME DEFAULT NULL,
        KEY (product_id),
        CONSTRAINT won_items_ibfk_1 FOREIGN KEY (product_id) REFERENCES product(id)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
    `);

    await connection.query(`
      CREATE TABLE IF NOT EXISTS payments (
        id INT AUTO_INCREMENT PRIMARY KEY,
        user_id CHAR(28) NOT NULL,
        won_item_id INT NOT NULL,
        paid_at DATETIME DEFAULT NULL,
        shipping_address TEXT,
        phoneNumber VARCHAR(15),
        deliveredTime DATETIME DEFAULT NULL,
        shipping_method ENUM('Standard','Express','Pickup') DEFAULT 'Standard',
        KEY (won_item_id),
        CONSTRAINT payments_ibfk_1 FOREIGN KEY (won_item_id) REFERENCES won_items(id)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
    `);

    await connection.query(`
      CREATE TABLE IF NOT EXISTS wallets (
        id INT AUTO_INCREMENT PRIMARY KEY,
        user_id VARCHAR(128) NOT NULL,
        balance DECIMAL(20,6) NOT NULL DEFAULT 0.000000,
        pending_bids DECIMAL(12,2) NOT NULL DEFAULT 0.00,
        UNIQUE KEY (user_id)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
    `);

    await connection.query(`
      CREATE TABLE IF NOT EXISTS wallet_transactions (
        id INT AUTO_INCREMENT PRIMARY KEY,
        wallet_id INT NOT NULL,
        type ENUM('Add Funds','Bids','Withdrawal','Confirm') NOT NULL,
        amount DECIMAL(12,2) NOT NULL,
        description TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        KEY (wallet_id),
        CONSTRAINT wallet_transactions_ibfk_1 FOREIGN KEY (wallet_id) REFERENCES wallets(id) ON DELETE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
    `);

    await connection.query(`
      CREATE TABLE IF NOT EXISTS bid_history (
        id INT AUTO_INCREMENT PRIMARY KEY,
        product_id INT NOT NULL,
        user_id CHAR(28) NOT NULL,
        bid_amount DECIMAL(10,2) NOT NULL,
        bid_time DATETIME DEFAULT CURRENT_TIMESTAMP,
        KEY (product_id),
        CONSTRAINT bid_history_ibfk_1 FOREIGN KEY (product_id) REFERENCES product(id)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
    `);

    await connection.query(`
      CREATE TABLE IF NOT EXISTS notifications (
        id INT AUTO_INCREMENT PRIMARY KEY,
        user_id CHAR(28) NOT NULL,
        message TEXT,
        type ENUM('bid','auction','confirm','cancel'),
        is_read TINYINT(1) DEFAULT 0,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
    `);

    await connection.query(`
      CREATE TABLE IF NOT EXISTS reserved_bids (
        id INT AUTO_INCREMENT PRIMARY KEY,
        user_id VARCHAR(255) NOT NULL,
        product_id INT NOT NULL,
        reserved_amount INT NOT NULL,
        UNIQUE KEY (user_id, product_id)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
    `);

    await connection.query(`
      CREATE TABLE IF NOT EXISTS transactions (
        txn_ref VARCHAR(50) PRIMARY KEY,
        createdate VARCHAR(14) NOT NULL,
        paydate VARCHAR(14),
        infor VARCHAR(255)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
    `);

    console.log("✅ All tables created successfully.");
    await connection.end();
  } catch (err) {
    console.error("❌ Error initializing database:", err);
    process.exit(1);
  }
})();
