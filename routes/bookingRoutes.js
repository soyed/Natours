const express = require('express');
const { protect, restrictTo } = require('../controllers/authController');
const {
  getCheckoutSession,
  createBooking,
  getBooking,
  getBookings,
  updateBooking,
  deleteBooking,
} = require('../controllers/bookingController');

const bookingRouter = express.Router();

bookingRouter.use(protect);
bookingRouter.get('/checkout-session/:tourId', getCheckoutSession);

bookingRouter.use(restrictTo('admin', 'lead-guide'));

bookingRouter.route('/').get(getBookings).post(createBooking);

bookingRouter
  .route('/:id')
  .get(getBooking)
  .patch(updateBooking)
  .delete(deleteBooking);

module.exports = bookingRouter;
