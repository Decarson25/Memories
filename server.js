const express = require('express');
const { google } = require('googleapis');
const multer = require('multer');
const path = require('path');
const { Readable } = require('stream');
require('dotenv').config(); // Load environment variables from .env file

const app = express();
const upload = multer({ storage: multer.memoryStorage() });

// Load credentials from environment variables
const credentials = {
    type: process.env.GOOGLE_CREDENTIALS_TYPE,
    project_id: process.env.GOOGLE_CREDENTIALS_PROJECT_ID,
    private_key_id: process.env.GOOGLE_CREDENTIALS_PRIVATE_KEY_ID,
    private_key: process.env.GOOGLE_CREDENTIALS_PRIVATE_KEY ? process.env.GOOGLE_CREDENTIALS_PRIVATE_KEY.replace(/\\n/g, '\n') : undefined,
    client_email: process.env.GOOGLE_CREDENTIALS_CLIENT_EMAIL,
    client_id: process.env.GOOGLE_CREDENTIALS_CLIENT_ID,
    auth_uri: process.env.GOOGLE_CREDENTIALS_AUTH_URI,
    token_uri: process.env.GOOGLE_CREDENTIALS_TOKEN_URI,
    auth_provider_x509_cert_url: process.env.GOOGLE_CREDENTIALS_AUTH_PROVIDER_X509_CERT_URL,
    client_x509_cert_url: process.env.GOOGLE_CREDENTIALS_CLIENT_X509_CERT_URL,
    universe_domain: process.env.GOOGLE_CREDENTIALS_UNIVERSE_DOMAIN,
};

// Google Drive API setup
const auth = new google.auth.GoogleAuth({
    credentials: credentials,
    scopes: ['https://www.googleapis.com/auth/drive.file'],
});

const drive = google.drive({ version: 'v3', auth });

// Middleware to serve static files
app.use(express.static(path.join(__dirname, 'public')));

// File upload route
app.post('/api/upload', upload.single('file'), async (req, res) => {
    try {
        const fileMetadata = {
            name: req.file.originalname,
            mimeType: req.file.mimetype,
            parents: [process.env.GOOGLE_DRIVE_FOLDER_ID], // Use environment variable for folder ID
        };

        // Convert Buffer to ReadableStream
        const stream = new Readable();
        stream.push(req.file.buffer);
        stream.push(null); // End the stream

        const media = {
            mimeType: req.file.mimetype,
            body: stream,
        };

        // Use resumable upload
        const response = await drive.files.create({
            resource: fileMetadata,
            media: media,
            uploadType: 'resumable',
            fields: 'id',
        }, {
            onUploadProgress: (progress) => {
                console.log(`Upload progress: ${progress.bytesRead} bytes`);
            },
        });

        res.status(200).json({ message: 'File uploaded successfully', fileId: response.data.id });
    } catch (err) {
        console.error('Upload error:', err);
        res.status(500).json({ error: 'Failed to upload file' });
    }
});

// Start server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});