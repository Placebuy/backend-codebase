const { z } = require('zod');

const createMenuSchema = z.object({
	name: z.string().min(1).max(50),
	image: z.string().url(),
	price: z.number().min(0),
});

const editMenuSchema = z.object({
	name: z.string().max(50),
	price: z.number().min(0),
}); 

module.exports = {
	createMenuSchema,
	editMenuSchema,
}; 
 