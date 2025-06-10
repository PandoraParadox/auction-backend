const express = require('express');
const cors = require('cors');
const path = require('path');
const WebSocket = require('ws');
const http = require('http');
const pool = require('./config/db');

const app = express();
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });
const { verifyTokenWithParam } = require('./middleware/auth')
const { verifyTokenWS } = require('./middleware/auth')
app.use(cors());
app.use(express.json());
app.use('/uploads', express.static(path.join(__dirname, 'Uploads')));

const productRoutes = require('./routes/product.routes');
const protectedRoutes = require('./routes/protected.routes');
const wonitemRoutes = require('./routes/wonitems.routes');
const walletRoutes = require('./routes/wallet.routes')
const notificationRoutes = require('./routes/notification.routes')
const vnpayRouter = require('./routes/vnpay.routes');
const userRoutes = require('./routes/user.routes');
app.use('/api/v1', productRoutes);
app.use('/api/v1/protected', verifyTokenWithParam, protectedRoutes);
app.use('/won-items', wonitemRoutes);
app.use('/api/v1/wallet', walletRoutes);
app.use('/api/v1/notification', notificationRoutes);
app.use('/api/v1/vnpay', vnpayRouter);
app.use('/api/v1/user', userRoutes);


const clients = new Map();

const getAuctionStatus = (auctionTime) => {
    const start = new Date(auctionTime);
    if (isNaN(start.getTime())) {
        throw new Error('Invalid auctionTime');
    }
    const end = new Date(start.getTime() + 60 * 60 * 1000);
    const now = new Date();
    if (now < start) return 'Pending';
    if (now >= start && now <= end) return 'Active';
    return 'Ended';
};

const formatCurrency = (value) => {
    const number = typeof value === 'string' ? parseFloat(value) : value;
    return new Intl.NumberFormat('vi-VN').format(number);
};


async function checkAuctionEnd(auctionId) {
    try {
        const [products] = await pool.query(
            'SELECT id, name, highest_bidder_user, highest_bid, auctionTime FROM product WHERE id = ?',
            [auctionId]
        );
        if (products.length === 0) {
            console.log(`No product found for product ${auctionId}`);
            return;
        }
        const product = products[0];
        let status;
        try {
            status = getAuctionStatus(product.auctionTime);
        } catch (error) {
            console.error(`Error checking auction status for product ${auctionId}:`, error.message);
            return;
        }
        if (status !== 'Ended') {
            console.log(`Auction is going on`);
            return;
        }
        if (!product.highest_bidder_user) {
            console.log(`No winner for product ${auctionId}`);
            return;
        }
        const [existingWonItems] = await pool.query(
            'SELECT id FROM won_items WHERE product_id = ? AND user_id = ?',
            [product.id, product.highest_bidder_user]
        );
        if (existingWonItems.length > 0) {
            console.log(`Won item already exists for product ${auctionId} and user ${product.highest_bidder_user}`);
            return;
        }


        const finalPrice = product.highest_bid || 0;
        await pool.query(
            `INSERT INTO won_items (user_id, product_id, final_price, status, won_at,created_at, payment_due)
             VALUES (?, ?, ?, 'Pending', NOW(),DATE_ADD(NOW(), INTERVAL 3 DAY) , DATE_ADD(NOW(), INTERVAL 5 DAY))`,
            [product.highest_bidder_user, product.id, finalPrice]
        );

        await recalculatePending(product.highest_bidder_user);
        await pool.query(`
            INSERT INTO notifications(user_id, message, type, is_read)
            VALUES (?, ?, 'auction', 0)
        `, [product.highest_bidder_user, `You won product "${product.name}" at price ${formatCurrency(finalPrice)} VND`, 0]);

        await pool.execute(
            'DELETE FROM reserved_bids WHERE user_id = ? AND product_id = ?',
            [product.highest_bidder_user, auctionId]
        );

        clients.forEach((clientAuctionId, client) => {
            if (client.readyState === WebSocket.OPEN && clientAuctionId === auctionId) {
                client.send(
                    JSON.stringify({
                        type: 'auction_ended',
                        productId: product.id,
                        productName: product.name,
                        winnerId: product.highest_bidder_user || null,
                        finalPrice: finalPrice,
                    })
                );
            }
        });
    } catch (error) {
        console.error(`Error in checkAuctionEnd for product ${auctionId}:`, error);
    }
}

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

wss.on('connection', (ws) => {
    ws.on('message', async (message) => {
        console.log('WebSocket message received:', message.toString());
        let data;
        try {
            data = JSON.parse(message);
        } catch (error) {
            ws.send(JSON.stringify({ type: 'error', message: 'Invalid message format' }));
            return;
        }

        const { type, auctionId, userId, bidAmount, token } = data;

        try {
            if (type === 'join') {
                const decodedToken = await verifyTokenWS(token);
                if (decodedToken.uid !== userId) {
                    ws.send(JSON.stringify({ type: 'error', message: 'Invalid token' }));
                    return;
                }
                ws.auctionId = auctionId;
                clients.set(ws, auctionId);

                const [products] = await pool.execute(
                    'SELECT * FROM product WHERE id = ?',
                    [auctionId]
                );
                const [bids] = await pool.execute(
                    'SELECT * FROM bid_history WHERE product_id = ? ORDER BY bid_time DESC',
                    [auctionId]
                );

                if (products.length) {
                    const product = products[0];
                    let status;
                    try {
                        status = getAuctionStatus(product.auctionTime);
                    } catch (error) {
                        ws.send(JSON.stringify({ type: 'error', message: error.message }));
                        return;
                    }
                    const startTime = new Date(product.auctionTime);
                    const endTime = new Date(startTime.getTime() + 60 * 60 * 1000);

                    ws.send(
                        JSON.stringify({
                            type: 'auction_data',
                            auction: {
                                id: product.id,
                                name: product.name,
                                images: product.images,
                                startingPrice: product.startingPrice,
                                highest_bid: product.highest_bid,
                                highest_bidder_user: product.highest_bidder_user || null,
                                auctionTime: startTime.toISOString(),
                                end_time: endTime.toISOString(),
                                status,
                                category: product.category,
                                description: product.description,
                            },
                            bidHistory: bids,
                        })
                    );
                    if (status === 'Ended') {
                        await checkAuctionEnd(auctionId);
                    }
                } else {
                    ws.send(JSON.stringify({ type: 'error', message: 'Product does not exist' }));
                }
            } else if (type === 'bid') {
                const decodedToken = await verifyTokenWS(token);
                if (decodedToken.uid !== userId) {
                    ws.send(JSON.stringify({ type: 'error', message: 'Invalid token' }));
                    return;
                }

                const [products] = await pool.execute('SELECT * FROM product WHERE id = ?', [auctionId]);
                if (!products.length) {
                    ws.send(JSON.stringify({ type: 'error', message: 'Product does not exist' }));
                    return;
                }

                const [[wallet]] = await pool.execute("SELECT * FROM wallets WHERE user_id = ?", [userId]);
                const [reserved] = await pool.execute(`SELECT SUM(reserved_amount) as total_reserved FROM reserved_bids WHERE user_id = ?`, [userId]);

                const totalReserved = reserved[0].total_reserved || 0;

                if ((wallet.balance - wallet.pending_bids - totalReserved) < bidAmount) {
                    ws.send(JSON.stringify({ type: 'error', message: 'Not enough balance for this bid.' }));
                    return;
                }


                const product = products[0];
                let status;
                try {
                    status = getAuctionStatus(product.auctionTime);
                } catch (error) {
                    ws.send(JSON.stringify({ type: 'error', message: error.message }));
                    return;
                }
                if (status !== 'Active') {
                    ws.send(JSON.stringify({ type: 'error', message: 'Auction not active' }));
                    return;
                }

                if (bidAmount <= (product.highest_bid || product.startingPrice)) {
                    ws.send(JSON.stringify({ type: 'error', message: 'The bid price must be higher than the current price.' }));
                    return;
                }

                const oldUserId = product.highest_bidder_user;

                await pool.execute(
                    'UPDATE product SET highest_bid = ?, highest_bidder_user = ? WHERE id = ?',
                    [bidAmount, userId, auctionId]
                );

                await pool.execute(
                    'INSERT INTO bid_history (product_id, user_id, bid_amount, bid_time) VALUES (?, ?, ?, ?)',
                    [auctionId, userId, bidAmount, new Date().toISOString()]
                );

                await pool.execute(
                    `INSERT INTO reserved_bids (user_id, product_id, reserved_amount)
                    VALUES (?, ?, ?)
                    ON DUPLICATE KEY UPDATE reserved_amount = ?
                    `, [userId, auctionId, bidAmount, bidAmount]
                );


                const [updatedProduct] = await pool.execute('SELECT * FROM product WHERE id = ?', [auctionId]);
                const [updatedBids] = await pool.execute(
                    'SELECT * FROM bid_history WHERE product_id = ? ORDER BY bid_time DESC',
                    [auctionId]
                );

                await recalculatePending(userId);

                if (oldUserId && oldUserId !== userId) {
                    await recalculatePending(oldUserId);
                    await pool.query(`INSERT INTO notifications(user_id, message, type, is_read) VALUES (?,?,?,0)`, [oldUserId, `Your price for product "${product.name}" has been exceeded`, "bid"]);
                    await pool.execute(
                        'DELETE FROM reserved_bids WHERE user_id = ? AND product_id = ?',
                        [oldUserId, auctionId]
                    );
                }


                clients.forEach((clientAuctionId, client) => {
                    if (client.readyState === WebSocket.OPEN && clientAuctionId === auctionId) {
                        client.send(
                            JSON.stringify({
                                type: 'update',
                                highestBid: updatedProduct[0].highest_bid,
                                highestBidderId: updatedProduct[0].highest_bidder_user || null,
                                bidHistory: updatedBids,
                            })
                        );
                    }
                });
            } else if (type === 'check_auction') {
                await checkAuctionEnd(auctionId);
            }
        } catch (error) {
            console.error('WebSocket error:', error.message);
            ws.send(JSON.stringify({ type: 'error', message: error.message }));
        }
    });

    ws.on('close', () => {
        console.log('WebSocket connection closed');
        clients.delete(ws);
    });

    ws.on('error', (error) => {
        console.error('WebSocket error:', error);
    });
});

const PORT = process.env.PORT || 5000;
server.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});