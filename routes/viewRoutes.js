const express = require('express');
const { isLoggedIn, protect } = require('../controllers/authController');
const {
  createBookingCheckout,
  getCheckoutSession,
} = require('../controllers/bookingController');
const {
  getTours,
  getOverview,
  getLoginView,
  getAccount,
  updateUserInformation,
  getMyTours,
  alert,
} = require('../controllers/viewController');

const viewRouter = express.Router();

// router to show success checkout
viewRouter.use(alert);

// ensure that all users accessing these routes are logged in
// viewRouter.use(isLoggedIn);

viewRouter.get('/', isLoggedIn, getOverview);

viewRouter.get('/tour/:slug', isLoggedIn, getTours);

viewRouter.get('/login', isLoggedIn, getLoginView);

// protected only authenticated users should have access => not need to check if logged in since the protect middleware already does that
viewRouter.get('/myaccount', protect, getAccount);

// updating user information using HTML form
viewRouter.post('/submit-user-data', protect, updateUserInformation);

viewRouter.get('/my-tours', protect, getMyTours);
// LEGACY STRIPE CHECKOUT ROUTE
// Temporary Fix
// Add the stripe middleware => why?
// the success url is nested with a request query on the parent route => /
//  therefore to validate and store the successful booking the middleware will handling the new document creation
// viewRouter.get('/my-tours', createBookingCheckout, protect, getMyTours);

module.exports = viewRouter;
