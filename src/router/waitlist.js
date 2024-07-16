const express = require('express');
const validate = require('../utils/validate');
const createWaitlist = require('../controllers/waitlist');
const waitlistValidation = require('../validation/waitlistValidation');

const router = express.Router();

router.post('/create', validate(waitlistValidation.waitlistSchema), createWaitlist);

module.exports = router;
