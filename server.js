const express = require("express");
const { google } = require("googleapis");
const multer = require("multer");
const fs = require("fs");
const path = require("path");
require("dotenv").config();

const app = express();
const port = process.env.PORT || 3000; //use renders port

// Google Drive API setup
const SCOPE = ["https://www.googleapis.com/auth/drive"];

// Configure Multer for disk storage (like working version)
const upload = multer({
  dest: "uploads/", // Temporary directory for files
});

// authorize drive with drive api
async function authorize() {
  const clientEmail = process.env.GOOGLE_CREDENTIALS_CLIENT_EMAIL;
  const privateKey = process.env.GOOGLE_CREDENTIALS_PRIVATE_KEY?.replace(
    /\\n/g,
    "\n"
  );

  if (!clientEmail || !privateKey) {
    throw new Error(
      "Google Cloud credentials (GOOGLE_CLIENT_EMAIL and GOOGLE_PRIVATE_KEY) must be set in environment variables."
    );
  }

  const jwtClient = new google.auth.JWT(clientEmail, null, privateKey, SCOPE);

  await jwtClient.authorize();
  return jwtClient;
}

// Upload file to Google Drive (like working version)
async function uploadFile(authClient, filePath, fileName) {
  return new Promise((resolve, reject) => {
    const drive = google.drive({ version: "v3", auth: authClient });

    const fileMetaData = {
      name: fileName,
      parents: ["1nBLjMuFhzvsUOFW1I0RcrZT5ZThiC-h9"], // Your folder ID
    };

    drive.files.create(
      {
        resource: fileMetaData,
        media: {
          body: fs.createReadStream(filePath),
          mimeType: "application/octet-stream",
        },
        fields: "id",
      },
      (error, file) => {
        if (error) {
          return reject(error);
        }
        resolve(file);
      }
    );
  });
}

// Middleware to serve static files
app.use(express.static(path.join(__dirname, "public")));

// File upload route
app.post("/upload", upload.array("myFile"), async (req, res) => {
  try {
    const authClient = await authorize();
    const files = req.files;

    if (!files || files.length === 0) {
      return res
        .status(400)
        .json({ success: false, message: "No files uploaded" });
    }

    // Upload each file to Google Drive
    const uploadPromises = files.map((file) => {
      return uploadFile(authClient, file.path, file.originalname).then(() => {
        // Delete temporary file
        fs.unlinkSync(file.path);
      });
    });

    await Promise.all(uploadPromises);
    res.json({
      success: true,
      message: ` file (s) Successfully uploaded`,
    });
  } catch (err) {
    console.error("Upload error:", err);
    res.status(500).json({ success: false, message: `Error: ${err.message}` });
  }
});

// Start server
app.listen(port, () => {
  console.log(`Server running at http://localhost:${port}`);
});
