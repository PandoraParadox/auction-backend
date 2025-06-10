const path = require("path");
const db = require("../config/db");

exports.createProduct = async (req, res) => {
    try {
        const { name, startingPrice, auctionTime, category, description } = req.body;

        const fileNames = req.files ? req.files.map(file => file.filename) : [];
        console.log("Uploaded files:", fileNames);

        const cleanedPrice = parseFloat(
            startingPrice.toString().replace(/[^\d]/g, "")
        );

        const sql = `
            INSERT INTO product (name, startingPrice, auctionTime, category, images, description, highest_bid)
            VALUES (?, ?, ?, ?, ?, ?, ?)
        `;

        const values = [
            name,
            cleanedPrice,
            auctionTime,
            category,
            JSON.stringify(fileNames),
            description,
            cleanedPrice
        ];

        const [result] = await db.query(sql, values);

        console.log("Product inserted with ID:", result.insertId);
        res.status(200).json({
            message: "Product created successfully",
            productId: result.insertId
        });

    } catch (error) {
        console.error("Server error:", error);
        res.status(500).json({ message: "Server error" });
    }
};

exports.getAllProducts = async (req, res) => {
    try {
        const [results] = await db.query(`
            SELECT p.* 
            FROM product p
            WHERE p.id NOT IN (
                SELECT product_id 
                FROM won_items
                WHERE product_id IS NOT NULL
            )
            ORDER BY p.id DESC
        `);
        res.status(200).json({ data: results });
    } catch (err) {
        console.error("Error fetching products:", err);
        res.status(500).json({ message: "Database error" });
    }
};

exports.searchProducts = async (req, res) => {
    try {
        const searchTerm = req.query.query || "";
        const searchValue = `%${searchTerm}%`;

        const sql = `
            SELECT * FROM product 
            WHERE name LIKE ? OR category LIKE ?
            ORDER BY id DESC
        `;
        const [results] = await db.query(sql, [searchValue, searchValue]);
        res.status(200).json({ data: results });
    } catch (err) {
        console.error("Error searching products:", err);
        res.status(500).json({ message: "Error searching products" });
    }
};

exports.deleteProduct = async (req, res) => {
    try {
        const productId = req.params.id;
        const [result] = await db.query("DELETE FROM product WHERE id = ?", [productId]);

        if (result.affectedRows === 0) {
            return res.status(404).json({ message: "Product not found" });
        }

        res.status(200).json({ message: "Product deleted successfully" });
    } catch (err) {
        console.error("Error deleting product:", err);
        res.status(500).json({ message: "Error deleting product" });
    }
};

exports.updateProduct = async (req, res) => {
    try {
        const productId = req.params.id;
        const { name, startingPrice, auctionTime, category, description, highest_bid, highest_bidder_user } = req.body;


        const isBidUpdate = highest_bid !== undefined || highest_bidder_user !== undefined;
        const isNormalUpdate = name !== undefined || startingPrice !== undefined || auctionTime !== undefined ||
            category !== undefined || description !== undefined;



        const updates = [];
        const values = [];

        if (isNormalUpdate) {

            if (name !== undefined) {
                updates.push('name = ?');
                values.push(name);
            }
            if (startingPrice !== undefined) {
                updates.push('startingPrice = ?');
                values.push(parseFloat(startingPrice.toString().replace(/[^\d]/g, "")));
            }
            if (auctionTime !== undefined) {
                updates.push('auctionTime = ?');
                values.push(auctionTime);
            }
            if (category !== undefined) {
                updates.push('category = ?');
                values.push(category);
            }
            if (description !== undefined) {
                updates.push('description = ?');
                values.push(description);
            }
        } else {

            if (highest_bid !== undefined) {
                updates.push('highest_bid = ?');
                values.push(highest_bid);
            }
            if (highest_bidder_user !== undefined) {
                updates.push('highest_bidder_user = ?');
                values.push(highest_bidder_user);
            }
        }

        values.push(productId);
        const sql = `UPDATE product SET ${updates.join(', ')} WHERE id = ?`;
        const [result] = await db.query(sql, values);

        if (result.affectedRows === 0) {
            return res.status(404).json({ message: "Product not found" });
        }

        res.status(200).json({ message: "Product updated successfully" });
    } catch (err) {
        console.error("Error updating product:", err);
        res.status(500).json({ message: "Error updating product" });
    }
};
exports.getProductById = async (req, res) => {
    const id = req.params.id;
    const query = 'SELECT * FROM product WHERE id = ?';
    try {
        const [results] = await db.query(query, [id]);
        if (results.length === 0) {
            return res.status(404).json({ message: 'Product does not exist' });
        }
        console.log(`Return products:`, results[0]);
        res.status(200).json({ data: results[0] });
    } catch (err) {
        console.error(`Error getting product with id ${id}:`, err.message);
        res.status(500).json({ error: `Server error: ${err.message}` });
    }
};

exports.getBidder = async (req, res) => {
    const id = req.params.id;
    try {
        const [rows] = await db.query(`SELECT COUNT(DISTINCT user_id) as Bidder FROM bid_history where product_id = ?`, [id]);
        const totalBidder = rows[0].Bidder || 0;
        res.json(totalBidder);
    } catch (err) {
        console.log(err);
    }
};