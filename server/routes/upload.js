// module.exports = router;
const express = require('express');
const router = express.Router();
const { upload } = require('../config/cloudinary');
const auth = require('../middleware/authMiddleware');

// Upload a file (accessible at /api/upload)
router.post('/upload', auth, upload.single('file'), async (req, res) => {
  try {
    if (!req.file || !req.file.path) {
      return res.status(400).json({ message: 'No file uploaded or file path missing.' });
    }

    res.status(200).json({
      message: 'File uploaded successfully',
      fileUrl: req.file.path, // Returns the Cloudinary URL
    });
  } catch (err) {
    // Check if the error is due to file size limit
    if (err && err.code === 'LIMIT_FILE_SIZE') {
      return res.status(413).json({ message: 'File is too large.' });
    }

    console.error('Upload error:', err); // Optional: log for debugging
    res.status(500).json({ message: 'Error uploading file', error: err.message });
  }
});

module.exports = router;
