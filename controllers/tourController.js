const multer = require('multer');
const sharp = require('sharp');
const Tour = require('../models/tourModel');
const AppError = require('../utils/appError');

const catchAsync = require('../utils/catchAsync');
const {
  deleteOne,
  updateOne,
  createOne,
  getOne,
  getAll,
} = require('./handlerFactory');

const multerStorage = multer.memoryStorage();

const multerFilter = (req, file, cb) => {
  if (file.mimetype.startsWith('image')) {
    cb(null, true);
  } else {
    // x is an app error => indicating the file type is not image
    cb(new AppError('Not an image! Please upload only images.', 400), false);
  }
};

// location for storing all uploaded images
const upload = multer({ storage: multerStorage, fileFilter: multerFilter });

// Uploading multiple images and resizing for tours
// .fields => for mixed properties
// .single => single file upload
// .array => array of the same type || property
exports.uploadTourImages = upload.fields([
  { name: 'imageCover', maxCount: 1 },
  { name: 'images', maxCount: 3 },
]);

exports.resizeTourImages = async (req, res, next) => {
  if (!req.files.imageCover || !req.files.images) return next();

  // Image processing => resize and reduce the image size in jpeg format => async since it takes time
  // 1. Process cover image
  // attach the imageCover name to the req.body => so it can be update in the database
  req.body.imageCover = `tour-${req.params.id}-${Date.now()}-cover.jpeg`;
  await sharp(req.files.imageCover[0].buffer)
    .resize(2000, 1333)
    .toFormat('jpeg')
    .jpeg({ quality: 90 })
    .toFile(`public/img/tours/${req.body.imageCover}`);

  // 2. process tour images

  // not calling async in the forEach does not make it async => the next middleware will still be called which will trigger an error because => by the time next is called the req.body.images is still processing therefore empty
  // to fix use promise.all => so it executes all the images in the array and returns the result as a promise which can now be await
  req.body.images = [];

  await Promise.all(
    req.files.images.map(async (image, index) => {
      // file name need in this case because images in an array and therefore needs to be pushed to the array
      const fileName = `tour-${req.params.id}-${Date.now()}-${index + 1}.jpeg`;

      await sharp(image.buffer)
        .resize(2000, 1333)
        .toFormat('jpeg')
        .jpeg({ quality: 90 })
        .toFile(`public/img/tours/${fileName}`);

      // push fileName to req.body.images
      req.body.images.push(fileName);
    })
  );

  next();
};
// ALIASING AN ENDPOINT
// middleware function to pre-fill req query params with the needed params
exports.aliasTopTours = (req, res, next) => {
  req.query.limit = '5';
  req.query.sort = '-ratingsAverage,price';
  req.query.fields = 'name,price,ratingsAverage,summary,difficulty';

  next();
};

exports.getAllTours = getAll(Tour);
exports.createTour = createOne(Tour);
exports.getTour = getOne(Tour, { path: 'reviews' });
exports.updateTour = updateOne(Tour);
// Using HandlerFactory to delete tour
exports.deleteTour = deleteOne(Tour);

/*=============================================*/

// Using Aggregation pipeline with mongoose
// purely a mongoDB feature
exports.getTourStats = catchAsync(async (req, res, next) => {
  // aggregation pipeline has different stages see doc
  // match is a preliminary for the next stage
  // group => is used for cumulation => add, sum, divide etc
  const stats = await Tour.aggregate([
    { $match: { ratingsAverage: { $gte: 4.5 } } },
    {
      $group: {
        // is use to define how they are grouped => can be any props
        _id: { $toUpper: '$difficulty' },
        averageRating: { $avg: '$ratingsAverage' },
        averagePrice: { $avg: '$price' },
        minPrice: { $min: '$price' },
        maxPrice: { $max: '$price' },
        numberRatings: { $sum: '$ratingsQuantity' },
        numberTours: { $sum: 1 },
      },
    },
    // once data has been mutated => the new key should be used to mutated in another pipeline stage
    { $sort: { averagePrice: 1 } },
    // nest pipeline stages
    // { $match: { _id: { $ne: 'EASY' } } },
  ]);

  res.status(200).json({
    status: 'success',
    data: { stats },
  });
});

exports.getMonthlyPlan = catchAsync(async (req, res, next) => {
  const year = Number(req.params.year);

  const plan = await Tour.aggregate([
    // destructure an array and output one doc from each element
    { $unwind: '$startDates' },
    // match tours within a year range
    {
      $match: {
        startDates: {
          $gte: new Date(`${year}-01-01`),
          $lte: new Date(`${year}-12-31`),
        },
      },
    },
    // group tours according to month
    {
      $group: {
        _id: { $month: '$startDates' },
        numTourStarts: { $sum: 1 },
        tours: { $push: '$name' },
      },
    },
    // add Field for the dates
    { $addFields: { month: '$_id' } },
    // project is used to hide property on payload
    { $project: { _id: 0 } },
    { $sort: { numTourStarts: -1 } },
    // limit display
    { $limit: 12 },
  ]);

  res.status(200).json({ status: 'success', data: { plan } });
});

// geo-spatial tours
exports.getToursWithin = catchAsync(async (req, res, next) => {
  // 1. extract tours information from request params
  const { distance, latlng, unit } = req.params;
  // 2. Extract and Set Latitude and Longitude
  const [latitude, longitude] = latlng.split(',');

  // create radius for distance => must convert distance to radians
  // geo-location radium from center => distance / radius of the earth
  const radius = unit === 'mi' ? distance / 3963.2 : distance / 6378.1;
  // 3. guard against empty lat and lng
  if (!latitude || !longitude) {
    next(
      new AppError('Provide Latitude and Longitude in format lat,lng ', 400)
    );
  }

  // 4. Find tours meeting search criteria
  // $geoWithin => builtin mongodb operator for find geo locations with specified range
  // $centerSphere => takes in the geolocation parameters => coordinates and radius
  const tours = await Tour.find({
    startLocation: {
      $geoWithin: { $centerSphere: [[longitude, latitude], radius] },
    },
  });

  // 5. Send response
  res
    .status(200)
    .json({ status: 'success', results: tours.length, data: { tours } });
});

// calculate the distance from a specific tour to other tours
exports.getTourDistances = catchAsync(async (req, res, next) => {
  // 1. extract tours information from request params
  const { latlng, unit } = req.params;
  // 2. Extract and Set Latitude and Longitude
  const [latitude, longitude] = latlng.split(',');

  // 2B => create a multiplier for the distance
  const UNIT_MULTIPLIER = unit === 'mi' ? 0.000621371 : 0.001;

  // 3. guard against empty lat and lng
  if (!latitude || !longitude) {
    next(
      new AppError('Provide Latitude and Longitude in format lat,lng ', 400)
    );
  }
  // For aggregating geo-spatial values => first property in the pipeline is $geoNear
  const tourDistances = await Tour.aggregate([
    // 1. provide geoNear => requires one of the fields must have a geo-spatial index
    {
      $geoNear: {
        // A. Distance to calculate each Tour
        // near => must be specified as Geo-JSON
        near: {
          type: 'Point',
          coordinates: [Number(longitude), Number(latitude)],
        },
        // set a field to store the calculated distance
        distanceField: 'distance',
        // convert the returning value to kilometers
        distanceMultiplier: UNIT_MULTIPLIER,
      },
    },
    {
      // next filter out other properties but keep the distance property,
      $project: { distance: 1, name: 1 },
    },
  ]);

  // Send response
  res.status(200).json({
    status: 'success',
    data: tourDistances,
  });
});
/*=============================================*/
