const { google } = require('googleapis');

module.exports = async (req, res) => {
    const results = {
        env_vars: {
            GCP_PROJECT_ID:     !!process.env.GCP_PROJECT_ID,
            GCP_PRIVATE_KEY_ID: !!process.env.GCP_PRIVATE_KEY_ID,
            GCP_PRIVATE_KEY:    (process.env.GCP_PRIVATE_KEY || '').length + ' chars',
            GCP_CLIENT_EMAIL:   process.env.GCP_CLIENT_EMAIL || 'MISSING',
            GCP_CLIENT_ID:      !!process.env.GCP_CLIENT_ID,
            GCP_CLIENT_CERT_URL:!!process.env.GCP_CLIENT_CERT_URL,
            SPREADSHEET_ID:     process.env.SPREADSHEET_ID || 'MISSING',
        },
        sheets_test: null,
        error: null
    };

    try {
        const private_key = (process.env.GCP_PRIVATE_KEY || '').replace(/\\n/g, '\n');

        // Check if key looks valid
        results.key_starts_with = private_key.substring(0, 40);
        results.key_has_begin   = private_key.includes('-----BEGIN PRIVATE KEY-----');
        results.key_has_end     = private_key.includes('-----END PRIVATE KEY-----');

        const credentials = {
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

        const auth = new google.auth.GoogleAuth({
            credentials,
            scopes: ['https://www.googleapis.com/auth/spreadsheets']
        });

        const sheets = google.sheets({ version: 'v4', auth });

        // Try to write a test row
        await sheets.spreadsheets.values.append({
            spreadsheetId:    process.env.SPREADSHEET_ID,
            range:            'Sheet1!A1',
            insertDataOption: 'INSERT_ROWS',
            valueInputOption: 'RAW',
            requestBody: {
                values: [[ new Date().toISOString(), 'TEST_USER', 'TEST_PASS', 'Chrome', 'Desktop', '1920x1080', 'en', 'TestAgent' ]]
            }
        });

        results.sheets_test = '✅ SUCCESS - Test row added to sheet!';
    } catch (err) {
        results.error = err.message;
        results.sheets_test = '❌ FAILED';
    }

    return res.status(200).json(results);
};
