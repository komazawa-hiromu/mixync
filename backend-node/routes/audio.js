const express = require('express');
const multer = require('multer');
const fs = require('fs');
const path = require('path');
const { authenticateToken } = require('../middleware/auth');

const router = express.Router();

// Apply JWT authentication to all routes
router.use(authenticateToken);

// The target directory in the Python backend
const audioDir = path.join(__dirname, '..', '..', 'backend-python', 'audio_files');

// Ensure the directory exists
if (!fs.existsSync(audioDir)) {
  fs.mkdirSync(audioDir, { recursive: true });
}

// --- Multer Configuration for file uploads ---
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, audioDir);
  },
  filename: function (req, file, cb) {
    // Use the original filename, ensuring it's a .wav file
    const filename = file.originalname.endsWith('.wav') ? file.originalname : `${file.originalname}.wav`;
    cb(null, filename);
  }
});

const upload = multer({
  storage: storage,
  fileFilter: (req, file, cb) => {
    if (file.mimetype === 'audio/wav' || file.mimetype === 'audio/x-wav') {
      cb(null, true);
    } else {
      cb(new Error('Invalid file type. Only .wav files are allowed.'), false);
    }
  }
});

// --- API Endpoints ---

// GET /api/audio/files - Get a list of available audio files
router.get('/files', (req, res) => {
  fs.readdir(audioDir, (err, files) => {
    if (err) {
      return res.status(500).json({ message: 'Failed to read audio directory.', error: err.message });
    }
    // Filter for .wav files only
    const wavFiles = files.filter(file => file.endsWith('.wav'));
    res.status(200).json(wavFiles);
  });
});

// POST /api/audio/upload - Upload a new audio file
router.post('/upload', upload.single('audioFile'), (req, res) => {
  if (!req.file) {
    return res.status(400).json({ message: 'No file uploaded.' });
  }
  res.status(201).json({ message: `File '${req.file.filename}' uploaded successfully.` });
}, (error, req, res, next) => {
  // This handles errors from multer's fileFilter
  res.status(400).json({ message: error.message });
});

// DELETE /api/audio/files/:filename - Delete an audio file
router.delete('/files/:filename', (req, res) => {
  const { filename } = req.params;

  // Basic security check to prevent path traversal
  if (filename.includes('..')) {
    return res.status(400).json({ message: 'Invalid filename.' });
  }

  const filePath = path.join(audioDir, filename);

  fs.unlink(filePath, (err) => {
    if (err) {
      if (err.code === 'ENOENT') {
        return res.status(404).json({ message: 'File not found.' });
      }
      return res.status(500).json({ message: 'Failed to delete file.', error: err.message });
    }
    res.status(200).json({ message: `File '${filename}' deleted successfully.` });
  });
});

module.exports = router;