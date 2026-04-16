const multer = require('multer');

const storage = multer.memoryStorage();

const uploadBlob = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB limit
  fileFilter: (req, file, cb) => {
    const allowed = /jpeg|jpg|png|gif|webp/;
    const ext = allowed.test(file.originalname.toLowerCase());
    const mime = allowed.test(file.mimetype);
    if (ext || mime) {
      return cb(null, true);
    }
    cb(new Error('Only images are allowed for this upload'));
  }
});

module.exports = uploadBlob;
