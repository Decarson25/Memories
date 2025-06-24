const express = require("express");
const { google } = require("googleapis");
const multer = require("multer");
const fs = require("fs");
const path = require("path");
require("dotenv").config();

const app = express();

// Configure Multer for disk storage (no file limits)
const upload = multer({
  dest: "uploads/",
});

// Google Drive API setup
const SCOPE = ["https://www.googleapis.com/auth/drive.file"];

async function authorize() {
  const clientEmail = process.env.GOOGLE_CREDENTIALS_CLIENT_EMAIL;
  const privateKey = process.env.GOOGLE_CREDENTIALS_PRIVATE_KEY?.replace(/\\n/g, "\n");

  if (!clientEmail || !privateKey) {
    throw new Error("Google Cloud credentials must be set in environment variables.");
  }

  const jwtClient = new google.auth.JWT(clientEmail, null, privateKey, SCOPE);
  await jwtClient.authorize();
  console.log("Google Drive API authorized successfully");
  return jwtClient;
}

async function uploadFile(authClient, filePath, fileName, retryCount = 0, maxRetries = 3) {
  return new Promise((resolve, reject) => {
    const drive = google.drive({ version: "v3", auth: authClient });
    const fileMetaData = {
      name: fileName,
      parents: [process.env.GOOGLE_DRIVE_FOLDER_ID],
    };

    console.log(`Uploading file: ${fileName}, size: ${fs.statSync(filePath).size} bytes`);

    drive.files.create({
      resource: fileMetaData,
      media: {
        body: fs.createReadStream(filePath),
        mimeType: "application/octet-stream",
      },
      fields: "id",
    }, async (error, file) => {
      if (error) {
        console.error(`Upload error for ${fileName}:`, {
          code: error.code,
          message: error.message,
          details: error.errors,
          stack: error.stack,
        });

        // Retry on 500 or 503 errors with exponential backoff
        if ((error.code === 500 || error.code === 503) && retryCount < maxRetries) {
          const delay = Math.pow(2, retryCount) * 1000; // 1s, 2s, 4s
          console.log(`Retrying upload for ${fileName} (attempt ${retryCount + 1}/${maxRetries}) after ${delay}ms`);
          await new Promise(resolve => setTimeout(resolve, delay));
          return uploadFile(authClient, filePath, fileName, retryCount + 1, maxRetries)
            .then(resolve)
            .catch(reject);
        }

        return reject(error);
      }

      console.log(`Successfully uploaded ${fileName}, File ID: ${file.data.id}`);
      resolve(file);
    });
  });
}

app.use(express.static(path.join(__dirname, "public")));

// Error handling for Multer
app.use((err, req, res, next) => {
  if (err instanceof multer.MulterError) {
    console.error("Multer error:", {
      code: err.code,
      message: err.message,
      field: err.field,
    });
    return res.status(400).json({ success: false, message: `Multer error: ${err.message}` });
  }
  next(err);
});

app.post("/api/upload", upload.array("file"), async (req, res) => {
  try {
    console.log(`Received upload request with ${req.files?.length || 0} files`);
    const authClient = await authorize();
    const files = req.files;

    if (!files || files.length === 0) {
      console.log("No files uploaded in request");
      return res.status(400).json({ success: false, message: "No files uploaded" });
    }

    const uploadPromises = files.map(file => {
      return uploadFile(authClient, file.path, file.originalname)
        .then(() => {
          console.log(`Deleting temporary file: ${file.path}`);
          fs.unlinkSync(file.path);
        })
        .catch(error => {
          console.error(`Failed to upload ${file.originalname}:`, error);
          throw error;
        });
    });

    await Promise.all(uploadPromises);
    console.log(`Successfully uploaded ${files.length} file(s)`);
    res.status(200).json({
      success: true,
      message: `Successfully uploaded ${files.length} file(s)`,
    });
  } catch (err) {
    console.error("Upload endpoint error:", {
      message: err.message,
      stack: err.stack,
      code: err.code,
      details: err.errors,
    });
    res.status(500).json({ success: false, message: `Error: ${err.message}` });
  }
});

const PORT = process.env.PORT || 8080;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
