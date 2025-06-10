const admin = require('../config/firebase');
const verifyToken = async (req, res, next) => {
    const token = req.headers.authorization?.split('Bearer ')[1];
    if (!token) {
        return res.status(401).json({ error: 'No token provided' });
    }

    try {
        const decodedToken = await admin.auth().verifyIdToken(token);
        req.user = decodedToken;
        next();
    } catch (error) {
        console.error('Token verification failed:', error);
        return res.status(403).json({ error: 'Invalid token' });
    }
};

const verifyTokenWithParam = async (req, res, next) => {
    const token = req.headers.authorization?.split('Bearer ')[1];
    if (!token) {
        return res.status(401).json({ error: 'Unauthorized' });
    }

    try {
        const decodedToken = await admin.auth().verifyIdToken(token);
        req.user = decodedToken;
        if (req.user.uid !== req.params.userId) {
            return res.status(403).json({ error: 'Forbidden' });
        }
        next();
    } catch (error) {
        console.error('Token verification error:', error);
        res.status(401).json({ error: 'Invalid token' });
    }
};

const verifyTokenWS = async (token) => {
    if (!token) {
        throw new Error('No token provided');
    }
    try {
        const decodedToken = await admin.auth().verifyIdToken(token);
        return decodedToken;
    } catch (error) {
        console.error('Token verification failed:', error);
        throw new Error('Invalid token');
    }
};

module.exports = {
    verifyToken,
    verifyTokenWithParam,
    verifyTokenWS,
};
