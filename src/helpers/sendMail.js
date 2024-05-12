const { createTransport } = require('nodemailer');
const util = require('util');
const logger = require('../config/logger');

const transporter = createTransport({
	service: process.env.EMAIL_SERVICE,
	//port: 465,
	secure: true,
	auth: {
		user: process.env.EMAIL_USERNAME,
		pass: process.env.EMAIL_PASSWORD,
	},
});

const sendMailAsync = util.promisify(transporter.sendMail).bind(transporter);

const sendEmail = async (options) => {
	const mailOptions = {
		from: process.env.EMAIL_FROM,
		to: options.to,
		subject: options.subject,
		text: options.text,
	};

	try {
		const info = await sendMailAsync(mailOptions);
		logger.info(`Email sent: ${info.response}`);
	} catch (error) {
		logger.error('Error sending email:', error.message);
		throw error; // Re-throw the error to propagate it to the caller
	}
};

module.exports = sendEmail;
