const httpStatus = require('http-status');
const Waitlist = require('../models/waitlist');
const { waitlistSchema } = require('../validation/waitlistValidation');
const sendEmail = require('../../src/helpers/sendMail');
const Asyncly = require('../utils/Asyncly');
const ApiError = require('../utils/ApiError');

const createWaitList = Asyncly(async (req, res) => {
  const waitlist = waitlistSchema.parse(req.body);

  const existingEmail = await Waitlist.findOne({ email: waitlist.email });
  if (existingEmail) {
    throw new ApiError(httpStatus.BAD_REQUEST, 'Email already exists');
  }
  const newWaitList = new Waitlist(waitlist);
  await newWaitList.save();

  const emailContent = `
  Dear ${waitlist.fullName},

  Thank you for joining the PlaceBuy waitlist! We're excited to have you on board.

  PlaceBuy is your gateway to exclusive deals and early access to the best products within your campus. As a member of our waitlist, you'll be among the first to know when we launch and gain access to special promotions.

  Stay tuned for updates on our progress. In the meantime, feel free to reach out to us with any questions or feedback you may have. We value your input!

  Best regards,


  PlaceBuy Team
`;

  await sendEmail({
    to: waitlist.email,
    subject: 'Thanks for joining Placebuy waitlist',
    text: emailContent,
  });

  return res.status(httpStatus.CREATED).json({
    data: newWaitList,
    message: 'You have successfully joined the waitlist',
  });
});

module.exports = createWaitList;
