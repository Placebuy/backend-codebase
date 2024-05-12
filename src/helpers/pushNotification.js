const admin = require('firebase-admin');
const serviceAccount = require('../config/privateKey.json');
const logger = require('../config/logger');

admin.initializeApp({
	credential: admin.credential.cert(serviceAccount),
});

const sendPushNotification = async (fcmToken, notification) => {
	try {
		const message = {
			token: fcmToken,
			notification: {
				title: notification.title,
				body: notification.body,
			},
		};
		const response = await admin.messaging().send(message);
		return response;
	} catch (err) {
		logger.error(`An error occured ${err}`);
		throw err;
	}
};

module.exports = sendPushNotification;
