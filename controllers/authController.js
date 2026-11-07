const pool = require('../config/db');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

const publicUserFields = 'id, full_name, email, role, institution';

function getDatabaseErrorMessage(error) {
    switch (error.code) {
        case 'ER_ACCESS_DENIED_ERROR':
            return 'Cannot log in to MySQL. Update DB_USER and DB_PASSWORD in .env with your MySQL credentials, then restart the server.';
        case 'ECONNREFUSED':
        case 'ETIMEDOUT':
            return 'Cannot connect to MySQL. Make sure the MySQL service is running and DB_HOST in .env is correct.';
        case 'ER_BAD_DB_ERROR':
            return 'The configured database does not exist. Create it by importing database\\schema.sql.';
        case 'ER_NO_SUCH_TABLE':
            return 'The required database tables are missing. Import database\\schema.sql into MySQL.';
        default:
            return null;
    }
}

function createToken(user) {
    return jwt.sign(
        { id: user.id, role: user.role, email: user.email },
        process.env.JWT_SECRET,
        { expiresIn: '24h' }
    );
}

function sendAuthenticatedUser(res, user, status = 200) {
    res.status(status).json({
        success: true,
        token: createToken(user),
        user: {
            id: user.id,
            full_name: user.full_name,
            email: user.email,
            role: user.role,
            institution: user.institution
        }
    });
}

exports.register = async (req, res) => {
    const fullName = typeof req.body.full_name === 'string' ? req.body.full_name.trim() : '';
    const email = typeof req.body.email === 'string' ? req.body.email.trim().toLowerCase() : '';
    const phoneNumber = typeof req.body.phone_number === 'string' ? req.body.phone_number.trim() : '';
    const password = typeof req.body.password === 'string' ? req.body.password : '';
    const institution = typeof req.body.institution === 'string'
        ? req.body.institution.trim()
        : 'MUST';

    if (!fullName || !email || !phoneNumber || !password) {
        return res.status(400).json({ success: false, message: 'Please provide all required fields.' });
    }

    if (fullName.length > 100 || email.length > 254 || phoneNumber.length > 30 || institution.length > 100) {
        return res.status(400).json({ success: false, message: 'One or more fields exceed the allowed length.' });
    }

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        return res.status(400).json({ success: false, message: 'Please provide a valid email address.' });
    }

    if (password.length < 8 || Buffer.byteLength(password, 'utf8') > 72) {
        return res.status(400).json({ success: false, message: 'Password must be 8-72 bytes long.' });
    }

    try {
        const passwordHash = await bcrypt.hash(password, 12);
        const [result] = await pool.query(
            'INSERT INTO users (full_name, email, phone_number, password_hash, role, institution) VALUES (?, ?, ?, ?, ?, ?)',
            [fullName, email, phoneNumber, passwordHash, 'STUDENT', institution || 'MUST']
        );
        const user = {
            id: result.insertId,
            full_name: fullName,
            email,
            role: 'STUDENT',
            institution: institution || 'MUST'
        };

        sendAuthenticatedUser(res, user, 201);
    } catch (error) {
        if (error.code === 'ER_DUP_ENTRY') {
            return res.status(409).json({ success: false, message: 'Email is already registered.' });
        }

        console.error('User registration failed:', error);
        const message = getDatabaseErrorMessage(error);
        res.status(message ? 503 : 500).json({
            success: false,
            message: message || 'Unable to create account right now.'
        });
    }
};

exports.login = async (req, res) => {
    const email = typeof req.body.email === 'string' ? req.body.email.trim().toLowerCase() : '';
    const password = typeof req.body.password === 'string' ? req.body.password : '';

    if (!email || !password) {
        return res.status(400).json({ success: false, message: 'Please provide email and password.' });
    }

    try {
        const [users] = await pool.query(
            `SELECT ${publicUserFields}, password_hash FROM users WHERE email = ?`,
            [email]
        );
        const user = users[0];
        if (!user || !(await bcrypt.compare(password, user.password_hash))) {
            return res.status(401).json({ success: false, message: 'Invalid email or password.' });
        }

        sendAuthenticatedUser(res, user);
    } catch (error) {
        console.error('User login failed:', error);
        const message = getDatabaseErrorMessage(error);
        res.status(message ? 503 : 500).json({
            success: false,
            message: message || 'Unable to sign in right now.'
        });
    }
};

exports.me = async (req, res) => {
    try {
        const [users] = await pool.query(
            `SELECT ${publicUserFields} FROM users WHERE id = ?`,
            [req.user.id]
        );
        if (users.length === 0) {
            return res.status(401).json({ success: false, message: 'Account no longer exists.' });
        }

        res.json({ success: true, user: users[0] });
    } catch (error) {
        console.error('Session lookup failed:', error);
        const message = getDatabaseErrorMessage(error);
        res.status(message ? 503 : 500).json({
            success: false,
            message: message || 'Unable to verify your session right now.'
        });
    }
};
