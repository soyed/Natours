const express = require('express');
const {
  getAllReviews,
  createReview,
  getReview,
  updateReview,
  deleteReview,
  setTourAndUserId,
} = require('../controllers/reviewController');

const { protect, restrictTo } = require('../controllers/authController');
// Separating reviews route and tour route
// mergeParams => preserves the params from parent route => Tour and child route inherits those params.
// Exception => if there are conflicting params name => child route takes precedence
const reviewRouter = express.Router({ mergeParams: true });

// reroute =>POST /tours/tourId/reviews => to POST reviews/
// 1. POST /tour/tourId/reviews => nested routes => access reviews on for the tourId on the tour resource
// 2. GET /tour/tourId/reviews

// protect all reviews route
reviewRouter.use(protect);

reviewRouter
  .route('/')
  .get(getAllReviews)
  .post(restrictTo('user'), setTourAndUserId, createReview);

reviewRouter
  .route('/:id')
  .get(getReview)
  .patch(restrictTo('user', 'admin'), updateReview)
  .delete(restrictTo('user', 'admin'), deleteReview);

module.exports = reviewRouter;
