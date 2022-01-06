const Review = require('../models/reviewModel');
const {
  deleteOne,
  updateOne,
  createOne,
  getOne,
  getAll,
} = require('./handlerFactory');

exports.getAllReviews = getAll(Review);

exports.setTourAndUserId = (req, res, next) => {
  // Fetching nested routes => POST /tour/tourId/reviews
  // if the review had not tour and user associated => extract the user and tourId from the query params
  if (!req.body.tour) {
    req.body.tour = req.params.tourId;
  }
  if (!req.body.user) {
    // the user is known from the protect middleware since the user is authenticated
    req.body.user = req.user.id;
  }

  next();
};

exports.createReview = createOne(Review);
exports.getReview = getOne(Review);

exports.updateReview = updateOne(Review);
exports.deleteReview = deleteOne(Review);
