const express = require('express');
const multer = require('multer');
const fs = require('fs');
const path = require('path');

const router = express.Router();

// Define the upload directory
const uploadDir = path.join(__dirname, '../public/uploads');

// Ensure the upload directory exists
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

// Set up multer for file storage
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, uploadDir);
  },
  filename: function (req, file, cb) {
    // Use original name, but you might want to sanitize it in a real app
    cb(null, file.originalname);
  }
});

const upload = multer({ 
  storage: storage,
  fileFilter: (req, file, cb) => {
    // Allow only .wav files
    if (path.extname(file.originalname).toLowerCase() !== '.wav') {
      return cb(new Error('WAV形式のファイルのみアップロードできます。'), false);
    }
    cb(null, true);
  }
});

// GET /api/sounds - Get a list of available sound files
router.get('/', (req, res) => {
  fs.readdir(uploadDir, (err, files) => {
    if (err) {
      return res.status(500).json({ message: 'サウンドファイルの読み込みに失敗しました。' });
    }
    // Filter for .wav files just in case
    const wavFiles = files.filter(file => path.extname(file).toLowerCase() === '.wav');
    res.status(200).json(wavFiles);
  });
});

// POST /api/sounds/upload - Upload a new sound file
router.post('/upload', upload.single('soundFile'), (req, res) => {
  if (!req.file) {
    return res.status(400).json({ message: 'ファイルが選択されていません。' });
  }
  res.status(201).json({ message: 'ファイルが正常にアップロードされました。', filename: req.file.filename });
}, (error, req, res, next) => {
  // This handles errors from multer's fileFilter
  res.status(400).json({ message: error.message });
});

module.exports = router;
