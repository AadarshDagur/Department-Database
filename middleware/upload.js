const multer = require('multer');
const path = require('path');
const crypto = require('crypto');

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    // Vercel serverless has a read-only filesystem except for /tmp
    const destFolder = process.env.NODE_ENV === 'production' 
      ? '/tmp' 
      : path.join(__dirname, '..', 'uploads');
    cb(null, destFolder);
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    cb(null, `${Date.now()}-${crypto.randomBytes(6).toString('hex')}${ext}`);
  }
});

const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const allowed = /jpeg|jpg|png|gif|webp|csv|xlsx/;
    const ext = allowed.test(path.extname(file.originalname).toLowerCase());
    const mime = allowed.test(file.mimetype);
    if (ext || mime || file.mimetype === 'text/csv' || file.mimetype === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet') {
      return cb(null, true);
    }
    cb(new Error('Only images, CSV, and Excel files are allowed'));
  }
});

module.exports = upload;
