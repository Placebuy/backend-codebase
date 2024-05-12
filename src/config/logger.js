const winston = require('winston');
const config = require('./env');


const enumerateErrorFormat = winston.format((info) => {
    if (info instanceof Error) {
        Object.assign(info, { message: info.stack });
    }
    return info;
});

const logger = winston.createLogger({
    level: config.env === 'production' ? 'info' : 'debug',
    format: winston.format.combine(
        enumerateErrorFormat(),
        config.env === 'development'
            ? winston.format.colorize()
            : winston.format.uncolorize(),
        winston.format.splat(),
        winston.format.printf(({ level, message }) => `${level}: ${message}`),
    ),
    transports: [
        new winston.transports.Console({
            stderrLevels: ['error'],
        }),
        config.env === 'production' ? new winston.transports.File({ filename: 'placebuy/logs/error.log', level: 'error' }) : null,
        config.env === 'production' ? new winston.transports.File({ filename: 'placebuy/logs/info.log', level: 'info' }) : null,
    ].filter(transport => transport !== null), // Filter out null transports
});

module.exports = logger;


/**const enumerateErrorFormat = winston.format((info) => {
	if (info instanceof Error) {
		Object.assign(info, { message: info.stack });
	}
	return info;
});

const logger = winston.createLogger({
	level: config.env === 'development' ? 'debug' : 'info',
	format: winston.format.combine(
		enumerateErrorFormat(),
		config.env === 'development'
			? winston.format.colorize()
			: winston.format.uncolorize(),
		winston.format.splat(),
		winston.format.printf(({ level, message }) => `${level}: ${message}`),
	),
	transports: [
		new winston.transports.Console({
			stderrLevels: ['error'],
		}),
	],
});

module.exports = logger;*/
