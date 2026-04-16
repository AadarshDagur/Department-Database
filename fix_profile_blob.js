const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, 'routes', 'profile.js');
let code = fs.readFileSync(filePath, 'utf8');

code = code.replace(
  "const upload = require('../middleware/upload');",
  "const uploadBlob = require('../middleware/uploadBlob');\nconst { put } = require('@vercel/blob');\nconst fsContent = require('fs');\nconst pathExt = require('path');\nconst crypto = require('crypto');"
);

const oldPut = `// Update profile
router.put('/:id', isLoggedIn, upload.single('profile_image'), async (req, res) => {
  try {
    if (parseInt(req.params.id) !== req.session.user.id) {
      req.flash('error', 'Not authorized');
      return res.redirect(\`/profile/\${req.params.id}\`);
    }
    const { first_name, last_name, get_otp_email, get_email_notification, get_email_broadcast } = req.body;
    const profileImage = req.file ? \`/uploads/\${req.file.filename}\` : undefined;`;

const newPut = `// Update profile
router.put('/:id', isLoggedIn, uploadBlob.single('profile_image'), async (req, res) => {
  try {
    if (parseInt(req.params.id) !== req.session.user.id) {
      req.flash('error', 'Not authorized');
      return res.redirect(\`/profile/\${req.params.id}\`);
    }
    const { first_name, last_name, get_otp_email, get_email_notification, get_email_broadcast } = req.body;
    let profileImage = undefined;

    if (req.file) {
      const ext = pathExt.extname(req.file.originalname);
      const filename = \`\${Date.now()}-\${crypto.randomBytes(6).toString('hex')}\${ext}\`;
      
      if (process.env.BLOB_READ_WRITE_TOKEN) {
        const blob = await put(\`profile_images/\${filename}\`, req.file.buffer, {
          access: 'public',
        });
        profileImage = blob.url;
      } else {
        const uploadPath = pathExt.join(__dirname, '..', 'uploads', filename);
        fsContent.writeFileSync(uploadPath, req.file.buffer);
        profileImage = \`/uploads/\${filename}\`;
      }
    }`;

code = code.replace(oldPut, newPut);

fs.writeFileSync(filePath, code);
console.log("Updated profile.js correctly.");
