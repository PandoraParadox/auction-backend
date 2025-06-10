const admin = require('../config/firebase');

exports.getUserInfo = async (req, res) => {
    const { uid } = req.params;

    try {
        const userRecord = await admin.auth().getUser(uid);

        res.status(200).json({
            uid: userRecord.uid,
            email: userRecord.email,
            displayName: userRecord.displayName,
            photoURL: userRecord.photoURL,
        });
    } catch (error) {
        console.error('Error fetching user data:', error);
        res.status(500).json({ message: 'Error fetching user data', error: error.message });
    }
};

exports.getAllUser = async (req, res) => {
    try {
        let users = [];
        let nextPageToken;

        do {
            const result = await admin.auth().listUsers(1000, nextPageToken);

            const transformedUsers = result.users.map((u) => {
                const userData = u.toJSON();
                userData.role = u.customClaims?.role || null;
                return userData;
            });

            users = users.concat(transformedUsers);
            nextPageToken = result.pageToken;
        } while (nextPageToken);

        res.status(200).json({ data: users });

    } catch (err) {
        console.error('Error fetching all users:', err);
        res.status(500).json({ message: 'Error fetching user list', error: err.message });
    }
};


exports.deleteUsers = async (req, res) => {
    const { uid } = req.params;

    try {
        await admin.auth().deleteUser(uid);
        res.status(200).json({ message: `User with UID ${uid} deleted successfully` });
    } catch (error) {
        console.error('Error deleting user:', error);
        res.status(500).json({ message: 'Error deleting user', error: error.message });
    }
};
exports.updateUser = async (req, res) => {
    const { uid } = req.params;
    const { email, displayName, role } = req.body;

    try {
        const userRecord = await admin.auth().updateUser(uid, {
            email,
            displayName,
        });
        if (role) {
            await admin.auth().setCustomUserClaims(uid, { role });
        }

        res.status(200).json({
            message: "User updated successfully",
            user: userRecord.toJSON(),
        });
    } catch (error) {
        console.error("Error updating user:", error);
        res.status(500).json({
            message: "Error updating user",
            error: error.message,
        });
    }
};

exports.authenrization = async (req, res) => {
    const { idToken } = req.params;
    try {
        const decodedToken = await admin.auth().verifyIdToken(idToken);
        const uid = decodedToken.uid;
        const role = decodedToken.role || decodedToken.claims?.role;

        if (role === "admin") {
            return res.status(200).json({ message: "Đăng nhập thành công", uid });
        } else {
            return res.status(403).json({ message: "Không có quyền truy cập. Chỉ Admin được phép." });
        }
    }
    catch (err) {
        return res.status(401).json({ message: "Token không hợp lệ" });
    }
};