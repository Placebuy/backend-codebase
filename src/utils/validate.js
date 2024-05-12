const { ValidationError } = require('zod');
const httpStatus = require('http-status');
const ApiError = require('./ApiError');

const validate = (schema) => (req, res, next) => {
	try {
		const validatedSchema = schema.pick({
			body: schema.body,
			query: schema.query,
			params: schema.params,
		});
		const object = { body: req.body, query: req.query, params: req.params };
		const value = validatedSchema.parse(object);
		Object.assign(req, value);
		return next();
	} catch (error) {
		if (error instanceof ValidationError) {
			const errorMessage = {};
			error.errors.forEach((err) => {
				if (!errorMessage[err.path[0]]) {
					errorMessage[err.path[0]] = {};
				}
				errorMessage[err.path[0]][err.path[1]] = err.message.replace(/"/g, "'");
			});
			return next(
				new ApiError(
					httpStatus.BAD_REQUEST,
					JSON.stringify(errorMessage),
					undefined,
					undefined,
					true,
				),
			);
		}
		return next(error);
	}
};

module.exports = validate;
