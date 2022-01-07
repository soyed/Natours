const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
const Tour = require('../models/tourModel');
const catchAsync = require('../utils/catchAsync');
const Booking = require('../models/bookingModel');
const {
  createOne,
  getOne,
  updateOne,
  deleteOne,
  getAll,
} = require('./handlerFactory');
const User = require('../models/userModel');

exports.getCheckoutSession = catchAsync(async (req, res, next) => {
  // 1. get the tour from database
  const tour = await Tour.findById(req.params.tourId);
  // 2. Create a checkout session
  const session = await stripe.checkout.sessions.create({
    //   provides information on the checkout session
    payment_method_types: ['card'],
    // not secure temporary => work around for now
    // LEGACY STRIPE CHECKOUT WITHOUT WEBHOOK
    // success_url: `${req.protocol}://${req.get('host')}/?tour=${
    //   req.params.tourId
    // }&user=${req.user.id}&price=${tour.price}`,
    success_url: `${req.protocol}://${req.get('host')}/my-tours`,
    cancel_url: `${req.protocol}://${req.get('host')}/tour/${tour.slug}`,
    customer_email: req.user.email,
    // Reference to the current user booking a tour => send their id to the client
    client_reference_id: req.params.tourId,
    //provides information on the product to purchase
    line_items: [
      {
        name: `${tour.name} Tour`,
        description: tour.summary,
        // images are only expected to be live links => no locals stored images as stripe stores this image on its server
        images: [`https://www.natours.dev/img/tours/${tour.imageCover}`],
        // price by default is in cents
        amount: tour.price * 100,
        currency: 'usd',
        quantity: 1,
      },
    ],
  });

  // 4. create new booking document when the success route is accessed

  // 4. Create session as response
  res.status(200).json({ status: 'success', session });
});

// LEGACY HACK: GETTING STRIPE TO WORK WITHOUT WEBHOOK
exports.createBookingCheckout = catchAsync(async (req, res, next) => {
  // Temporary fix => will be using => a more secure approach => Stripe webhook
  // 1. extract query params from stripe successful checkout
  const { tour, user, price } = req.query;

  if (!tour && !user && !price) {
    return next();
  }
  // 1. create booking document
  await Booking.create({ tour, user, price });

  // 2. format the request url => remove query string => to redirect to landing page
  // create new request to the root route => /
  res.redirect(req.originalUrl.split('?')[0]);

  next();
});

const createBooking = async (session) => {
  // Get the tour booked
  const tour = session.client_reference_id;
  // get user id using the customer email provided
  const user = await User.findOne({ email: session.customer_email }).id;

  const price = session.line_items[0].amount / 100;
  await Booking.create({ tour, user, price });
};

exports.webhookCheckout = (req, res, next) => {
  // 1. Read Stripe Signature
  const signature = req.headers('stripe-headers');
  let event;
  try {
    event = stripe.webhooks.constructEvent(
      req.body,
      signature,
      process.env.STRIP_WEBHOOK_SECRET
    );
  } catch (error) {
    // Send error back to stripe
    res.status(400).send(`Webhook error: ${err.message}`);
  }

  // using event and guard to double check the event type
  if (event.type === 'checkout.session.complete') {
    //1. use event to create database booking
    createBooking(event.data.object);
  }

  res.status(200).json({ received: true });
};

exports.getBookings = getAll(Booking);
exports.createBooking = createOne(Booking);
exports.getBooking = getOne(Booking);
exports.updateBooking = updateOne(Booking);
exports.deleteBooking = deleteOne(Booking);
