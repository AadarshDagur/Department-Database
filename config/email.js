const nodemailer = require('nodemailer');

const transporter = nodemailer.createTransport({
	host: process.env.EMAIL_HOST || 'smtp.gmail.com',
	port: parseInt(process.env.EMAIL_PORT || '587'),
	secure: false,
	auth: {
		user: process.env.EMAIL_USER,
		pass: process.env.EMAIL_PASSWORD
	}
});

async function sendMail({ to, subject, html, bcc }) {
	if (!process.env.EMAIL_USER) {
		console.log('[EMAIL SKIPPED] No EMAIL_USER configured. Subject:', subject);
		return;
	}
	const mailOptions = {
		from: process.env.EMAIL_USER,
		to,
		bcc,
		subject,
		html
	};
	return transporter.sendMail(mailOptions);
}

module.exports = { sendMail };
