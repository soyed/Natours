const express = require('express');
const {
  getAllTours,
  getTour,
  createTour,
  updateTour,
  deleteTour,
  aliasTopTours,
  getTourStats,
  getMonthlyPlan,
  getToursWithin,
  getTourDistances,
  uploadTourImages,
  resizeTourImages,
} = require('../controllers/tourController');

const { protect, restrictTo } = require('../controllers/authController');
const reviewRouter = require('./reviewRoutes');

// using a custom router and middleware => a sub application
const tourRouter = express.Router();

// param middleware => each router is a sub app => changes or logic here does not apply to other routes
// tourRouter.param('id', checkTourId);

// chaining multiple middle ware
//  create a check body middle ware
// if invalid send 404 request

// Aliasing => simple route that combines a bunch of query params
// run middle ware to pre-fill the header

/*===========================================*/
// review functionality for a tour
// user reviews functionality
// Nested Routes => User id should be used in making reviews
// 1. POST /tour/tourId/reviews => nested routes => access reviews on for the tourId on the tour resource
// 2. GET /tour/tourId/reviews
// 3. GET /tour/tourId/reviews/reviewId
// NOTE: Creating review routes in tour routes is not ideal
// tourRouter
//   .route('/:tourId/reviews')
//   .post(protect, restrictTo('user'), createReview);
// FIX: Use Merge Route to resolve the issue
// De-coupling =>
tourRouter.use('/:tourId/reviews', reviewRouter);

tourRouter.route('/top-5-cheap').get(aliasTopTours, getAllTours);
// aggregating pipeline
tourRouter.route('/tour-stats').get(getTourStats);
tourRouter
  .route('/monthly-plan/:year')
  .get(protect, restrictTo('admin', 'lead-guide', 'guide'), getMonthlyPlan);

// Geo spatial routes
// requires tours distance,and expects users current latitude and longitude sent along with the request
// standard way to specify url with a lot of function => /functionName/:functionParameter
// or => /tours-distance?distance=345&center=40,45&unit=mi
tourRouter
  .route('/tours-within/:distance/center/:latlng/unit/:unit')
  .get(getToursWithin);

// find distance between tours
tourRouter.route('/distances/:latlng/:unit').get(getTourDistances);

// chaining routes
tourRouter
  .route('/')
  .get(getAllTours)
  .post(protect, restrictTo('admin', 'lead-guide'), createTour);

tourRouter
  .route('/:id')
  .get(getTour)
  .patch(
    protect,
    restrictTo('admin', 'lead-guide'),
    uploadTourImages,
    resizeTourImages,
    updateTour
  )
  .delete(protect, restrictTo('admin', 'lead-guide'), deleteTour);

module.exports = tourRouter;
