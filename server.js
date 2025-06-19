const express = require("express");
const { google } = require("googleapis");
const multer = require("multer");
const path = require("path");
const { Readable } = require("stream");
require("dotenv").config(); // Load environment variables from .env file

const app = express();
const upload = multer({ storage: multer.memoryStorage() });

// Load credentials from environment variables
const credentials = {
  type: process.env.GOOGLE_CREDENTIALS_TYPE,
  project_id: process.env.GOOGLE_CREDENTIALS_PROJECT_ID,
  private_key_id: process.env.GOOGLE_CREDENTIALS_PRIVATE_KEY_ID,
  private_key: process.env.GOOGLE_CREDENTIALS_PRIVATE_KEY
    ? process.env.GOOGLE_CREDENTIALS_PRIVATE_KEY.replace(/\\n/g, "\n")
    : undefined,
  client_email: process.env.GOOGLE_CREDENTIALS_CLIENT_EMAIL,
  client_id: process.env.GOOGLE_CREDENTIALS_CLIENT_ID,
  auth_uri: process.env.GOOGLE_CREDENTIALS_AUTH_URI,
  token_uri: process.env.GOOGLE_CREDENTIALS_TOKEN_URI,
  auth_provider_x509_cert_url:
    process.env.GOOGLE_CREDENTIALS_AUTH_PROVIDER_X509_CERT_URL,
  client_x509_cert_url: process.env.GOOGLE_CREDENTIALS_CLIENT_X509_CERT_URL,
  universe_domain: process.env.GOOGLE_CREDENTIALS_UNIVERSE_DOMAIN,
};

// Google Drive API setup
const auth = new google.auth.GoogleAuth({
  credentials: credentials,
  scopes: ["https://www.googleapis.com/auth/drive.file"],
});

const drive = google.drive({ version: "v3", auth });

// Middleware to serve static files
app.use(express.static(path.join(__dirname, "public")));

// File upload route
app.post("/api/upload", upload.array("file", 15), async (req, res) => {
  try {
    if (!req.files || req.files.length === 0) {
      return res
        .status(400)
        .json({ success: false, message: "No files uploaded" });
    }

    // Process each file
    const uploadPromises = req.files.map(async (file) => {
      const fileMetadata = {
        name: file.originalname,
        mimeType: file.mimetype,
        parents: [process.env.GOOGLE_DRIVE_FOLDER_ID], // Use environment variable for folder ID
      };

      // Convert Buffer to ReadableStream
      const stream = new Readable();
      stream.push(file.buffer);
      stream.push(null); // End the stream

      const media = {
        mimeType: file.mimetype,
        body: stream,
      };

      // Use resumable upload
      const response = await drive.files.create(
        {
          resource: fileMetadata,
          media: media,
          uploadType: "resumable",
          fields: "id",
        },
        {
          onUploadProgress: (progress) => {
            console.log(
              `Upload progress for ${file.originalname}: ${progress.bytesRead} bytes`
            );
          },
        }
      );

      return { fileId: response.data.id, name: file.originalname };
    });

    // Wait for all uploads to complete
    const results = await Promise.all(uploadPromises);

    res.status(200).json({
      success: true,
      message: `Successfully uploaded ${results.length} file(s)`,
      fileIds: results.map((result) => result.fileId),
    });
  } catch (err) {
    console.error("Upload error:", err);
    res
      .status(500)
      .json({ success: false, message: "Failed to upload file(s)" });
  }
});

// Start server
const PORT = process.env.PORT || 8080;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
