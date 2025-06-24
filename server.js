const express = require("express");
const { google } = require("googleapis");
const multer = require("multer");
const fs = require("fs");
const path = require("path");
require("dotenv").config();

const app = express();

// Configure Multer for disk storage (like working version)
const upload = multer({
  dest: "uploads/", // Temporary directory for files
});

// Google Drive API setup
const SCOPE = ["https://www.googleapis.com/auth/drive.file"];

async function authorize() {
  const clientEmail = process.env.GOOGLE_CREDENTIALS_CLIENT_EMAIL;
  const privateKey = process.env.GOOGLE_CREDENTIALS_PRIVATE_KEY?.replace(/\\n/g, "\n");

  if (!clientEmail || !privateKey) {
    throw new Error("Google Cloud credentials must be set in environment variables.");
  }

  const jwtClient = new google.auth.JWT(
    clientEmail,
    null,
    privateKey,
    SCOPE
  );

  await jwtClient.authorize();
  return jwtClient;
}

// Upload file to Google Drive (like working version)
async function uploadFile(authClient, filePath, fileName) {
  return new Promise((resolve, reject) => {
    const drive = google.drive({ version: "v3", auth: authClient });

    const fileMetaData = {
      name: fileName,
      parents: [process.env.GOOGLE_DRIVE_FOLDER_ID], // Your folder ID
    };

    drive.files.create({
      resource: fileMetaData,
      media: {
        body: fs.createReadStream(filePath),
        mimeType: "application/octet-stream",
      },
      fields: "id",
    }, (error, file) => {
      if (error) {
        return reject(error);
      }
      resolve(file);
    });
  });
}

// Middleware to serve static files
app.use(express.static(path.join(__dirname, "public")));

// File upload route
app.post("/api/upload", upload.array("file", 15), async (req, res) => {
  try {
    const authClient = await authorize();
    const files = req.files;

    if (!files || files.length === 0) {
      return res.status(400).json({ success: false, message: "No files uploaded" });
    }

    // Upload each file to Google Drive
    const uploadPromises = files.map(file => {
      return uploadFile(authClient, file.path, file.originalname)
        .then(() => {
          // Delete temporary file
          fs.unlinkSync(file.path);
        });
    });

    await Promise.all(uploadPromises);
    res.status(200).json({
      success: true,
      message: `Successfully uploaded ${files.length} file(s)`,
    });
  } catch (err) {
    console.error("Upload error:", err);
    res.status(500).json({ success: false, message: `Error: ${err.message}` });
  }
});

// Start server
const PORT = process.env.PORT || 8080;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
