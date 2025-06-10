const express = require('express');
const router = express.Router();
const crypto = require('crypto');
const qs = require('qs');
const db = require("../config/db");

function sortObject(obj) {
    const sorted = {};
    const keys = Object.keys(obj).sort();
    for (const key of keys) {
        sorted[key] = obj[key];
    }
    return sorted;
}

function generateAlphaNumericTxnRef(length = 10) {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let result = '';
    for (let i = 0; i < length; i++) {
        result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return result;
}

function createSignData(params) {
    return Object.keys(params)
        .sort()
        .map(key => `${key}=${encodeURIComponent(params[key]).replace(/%20/g, '+')}`)
        .join('&');
}

router.post('/', async (req, res) => {
    console.log('Incoming payment request:', req.body);
    try {
        const { amount, description, user_id } = req.body;

        if (!amount || isNaN(amount) || amount <= 0) {
            return res.status(400).json({ error: 'Invalid amount' });
        }
        if (!user_id) {
            return res.status(400).json({ error: 'Missing user_id' });
        }

        const tmnCode = 'BV75DJC9';
        const secretKey = '6XYUKVL08K6M4TLLF7LC64A8X1EI8U92';
        const vnpUrl = 'https://sandbox.vnpayment.vn/paymentv2/vpcpay.html';
        const returnUrl = 'http://localhost:5000/api/v1/vnpay/return';

        const date = new Date();
        const createDate = date.getFullYear().toString() +
            ('0' + (date.getMonth() + 1)).slice(-2) +
            ('0' + date.getDate()).slice(-2) +
            ('0' + date.getHours()).slice(-2) +
            ('0' + date.getMinutes()).slice(-2) +
            ('0' + date.getSeconds()).slice(-2);

        const ipAddr = req.headers['x-forwarded-for'] || req.socket.remoteAddress.replace('::1', '127.0.0.1') || '127.0.0.1';

        const orderInfo = description || 'Top-up to wallet';

        const vnp_Params = {
            vnp_Version: '2.1.0',
            vnp_Command: 'pay',
            vnp_TmnCode: tmnCode,
            vnp_Locale: 'vn',
            vnp_CurrCode: 'VND',
            vnp_TxnRef: generateAlphaNumericTxnRef(),
            vnp_OrderInfo: orderInfo,
            vnp_OrderType: 'other',
            vnp_Amount: Math.round(amount * 100).toString(),
            vnp_ReturnUrl: returnUrl,
            vnp_IpAddr: ipAddr,
            vnp_CreateDate: createDate,
        };

        await db.execute('INSERT INTO transactions (txn_ref, createdate, infor) VALUES (?, ?, ?)', [vnp_Params.vnp_TxnRef, createDate, orderInfo]);

        const sortedParams = sortObject(vnp_Params);
        const signData = createSignData(sortedParams);
        console.log('Signing data string:', signData);
        const hmac = crypto.createHmac('sha512', secretKey);
        const signed = hmac.update(Buffer.from(signData, 'utf-8')).digest('hex');
        console.log('Generated vnp_SecureHash:', signed);

        sortedParams.vnp_SecureHash = signed;
        const paymentUrl = vnpUrl + '?' + qs.stringify(sortedParams, { encode: true });

        res.json({ qr_url: paymentUrl, payment_url: paymentUrl, vnp_TxnRef: vnp_Params.vnp_TxnRef });
    } catch (error) {
        console.error('Failed to generate payment URL:', error);
        res.status(500).json({ error: 'Failed to generate payment URL' });
    }
});

router.get('/return', (req, res) => {
    const vnp_Params = { ...req.query };
    const secureHash = vnp_Params['vnp_SecureHash'];
    delete vnp_Params['vnp_SecureHash'];
    delete vnp_Params['vnp_SecureHashType'];

    const secretKey = '6XYUKVL08K6M4TLLF7LC64A8X1EI8U92';
    const sortedParams = sortObject(vnp_Params);
    const signData = createSignData(sortedParams);
    const hmac = crypto.createHmac('sha512', secretKey);
    const signed = hmac.update(Buffer.from(signData, 'utf-8')).digest('hex');

    if (secureHash === signed) {
        const responseCode = vnp_Params['vnp_ResponseCode'];
        console.log('VNP Response Code:', responseCode);
        const payDate = vnp_Params['vnp_PayDate'];
        const formattedPayDate = payDate.replace(/\//g, '').replace(/ /g, '').replace(/:/g, '');
        db.execute('UPDATE transactions SET paydate = ? WHERE txn_ref = ?', [formattedPayDate, vnp_Params['vnp_TxnRef']]);

        if (responseCode === '00') {
            return res.send(`
                <html>
                    <head><title>Payment Successful</title></head>
                    <body>
                        <h3>Payment successful!</h3>
                        <script>
                            setTimeout(() => {
                                window.opener.postMessage({ status: 'success' }, '*');
                                window.close();
                            }, 3000);
                        </script>
                    </body>
                </html>
            `);
        } else {
            return res.send(`
                <html>
                    <head><title>Payment Failed</title></head>
                    <body>
                        <h3>Payment failed! Error code: ${responseCode}</h3>
                        <script>
                            setTimeout(() => {
                                window.opener.postMessage({ status: 'failed', code: '${responseCode}' }, '*');
                                window.close();
                            }, 3000);
                        </script>
                    </body>
                </html>
            `);
        }
    } else {
        console.log('Checksum validation failed');
        return res.status(400).send('Checksum validation failed!');
    }
});

router.get('/transaction_status/:txnRef', async (req, res) => {
    const { txnRef } = req.params;

    try {
        const [rows] = await db.execute('SELECT createdate, paydate, infor FROM transactions WHERE txn_ref = ?', [txnRef]);
        if (rows.length === 0) {
            return res.status(404).json({ error: 'Transaction not found' });
        }

        const transaction = rows[0];
        const isSuccessful = !!transaction.paydate;

        if (isSuccessful) {
            return res.json({
                vnp_ResponseCode: '00',
                vnp_Message: 'Transaction successful',
                vnp_TxnRef: txnRef,
                vnp_TransDate: transaction.paydate || transaction.createdate,
                vnp_OrderInfo: transaction.infor || 'Top-up to wallet'
            });
        } else {
            return res.json({
                vnp_ResponseCode: '99',
                vnp_Message: 'Transaction not completed',
                vnp_TxnRef: txnRef
            });
        }

    } catch (error) {
        console.error('Transaction status check failed:', error);
        return res.status(500).json({
            error: 'Unable to check transaction status',
            details: error.message
        });
    }
});

module.exports = router;
