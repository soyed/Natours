const Booking = require('../models/bookingModel');
const Tour = require('../models/tourModel');
const User = require('../models/userModel');
const AppError = require('../utils/appError');
const catchAsync = require('../utils/catchAsync');

exports.getOverview = catchAsync(async (req, res, next) => {
  // 1. Get Tour Data from collection
  const tours = await Tour.find();

  // 2. Build template => pug file

  // 3. Render template with Tour data from Step 1.
  res.status(200).render('overview', { title: 'All Tours', tours });
});

exports.getTours = catchAsync(async (req, res, next) => {
  // Extract tour id to read from data-base
  const { slug } = req.params;

  // 1. Get data for requested Tour, (include reviews and tour guides)
  // use populate to display the user reviews as well
  const tour = await Tour.findOne({ slug: slug }).populate({
    path: 'reviews',
    fields: 'review rating user',
  });

  // guard against null tour
  if (!tour) {
    // operational error => defined route related
    return next(new AppError('No tour with the name.', 404));
  }

  // 2. Build Template

  // 3. Render template using the data
  res.status(200).render('tour', { title: `${tour.name} Tour`, tour });
});

exports.getLoginView = async (req, res) => {
  res.status(200).render('login', { title: 'Log into your account' });
};

exports.getAccount = async (req, res) => {
  res.status(200).render('account', { title: 'Account Overview' });
};

exports.getMyTours = catchAsync(async (req, res, next) => {
  // 1. Find all bookings
  const bookings = await Booking.find({ user: req.user.id });
  // 2. Find tours returned Ids

  const tourIds = bookings.map((element) => element.tour);
  // what does this mean? => $in => find all id in the tourIds
  const tours = await Tour.find({ _id: { $in: tourIds } });

  res.status(200).render('overview', { title: 'My Tours', tours });
});

exports.updateUserInformation = catchAsync(async (req, res, next) => {
  const updatedUser = await User.findByIdAndUpdate(
    req.user.id,
    {
      name: req.body.name,
      email: req.body.email,
    },
    { new: true, runValidators: true }
  );
  // guard

  res.status(200).render('account', { user: updatedUser });
});

exports.alert = (req, res, next) => {
  const { alert } = req.query;

  if (alert === 'booking') {
    res.locals.alert =
      'Booking successful! Please check you email for booking confirmation. If you booking does not show up immediately, please come back later.';
  }
  next();
};
