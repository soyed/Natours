const mongoose = require('mongoose');
const Tour = require('./tourModel');

const reviewSchema = new mongoose.Schema(
  {
    review: {
      type: String,
      required: [true, 'A Review must be provided'],
      trim: true,
    },
    rating: {
      type: Number,
      required: true,
      min: [1, 'Rating must be above 1.0'],
      max: [5, 'Rating must be below 5.0'],
    },
    createdAt: {
      type: Date,
      default: Date.now(),
      // hid review data of creation => sensitive information
      select: false,
    },
    // parent-child referencing => selected because we are not sur`e how much the reviews can grow therefore => safe option is to consider growth
    tour: {
      type: mongoose.Schema.ObjectId,
      ref: 'Tour',
      required: [true, 'A Review must belong to a Tour.'],
    },
    user: {
      type: mongoose.Schema.ObjectId,
      ref: 'User',
      required: [true, 'A Review must belong to a User.'],
    },
  }, // to show virtual props => not stored in the database or likely calculated
  {
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

// Prevent duplicate reviews on a tour by the same user
reviewSchema.index({ tour: 1, user: 1 }, { unique: true });
/*=======================================*/
// issue => chaining of populate bad for performance
// reviewSchema.pre(/^find/, function (next) {
//   // 1. populate the document with user and tour content
//   // since that is concatenated => it actually does two queries to filter query result in the background
//   this.populate({ path: 'tour', select: 'name' }).populate({
//     path: 'user',
//     select: 'name photo',
//   });

//   next();
// });

reviewSchema.pre(/^find/, function (next) {
  // 1. populate the document with user and tour content
  // since that is concatenated => it actually does two queries to filter query result in the background
  this.populate({
    path: 'user',
    select: 'name photo',
  });

  next();
});

// 1. Calculating Average Rating on Tours => using reviews
// static method => points directly to the model => therefore instance access to the document
reviewSchema.statics.calculateAverageRatings = async function (tourId) {
  // Aggregate pipeline
  const stats = await this.aggregate([
    // 1. match the property to aggregate
    { $match: { tour: tourId } },
    // 2. Group properties to mutate
    {
      $group: {
        _id: '$tour',
        numRating: { $sum: 1 },
        averageRating: { $avg: '$rating' },
      },
    },
  ]);

  if (stats.length > 0) {
    await Tour.findByIdAndUpdate(tourId, {
      ratingsQuantity: stats[0].numRating,
      ratingsAverage: stats[0].averageRating,
    });
  } else {
    // reset to default
    await Tour.findByIdAndUpdate(tourId, {
      ratingsQuantity: 0,
      ratingsAverage: 4.5,
    });
  }
};

// Calculating averageRating and Rating each time a new review is added
// use a post save here because at pre save the database does not have the reviews created yet
reviewSchema.post('save', function () {
  // this => pointer to current review
  // this would not work => hoisting for variables in javascript => const cannot be used before they are declared
  // Review.calculateAverageRatings(this.tour);
  // A work around this.constructor => reference the creator of the model in this case => Review
  this.constructor.calculateAverageRatings(this.tour);
});

// 2. Update the numberRating and Average when a tour rating is added or deleted
// NOTE: A bit hard since we are using update and delete which has new document we can access so a little harder for sure
// instead use findOne hook to get access to the document
// In query middleware => we only have access to the query

reviewSchema.pre(/^findOneAnd/, async function (next) {
  // Gives access to the document being reviewed => this does not have the newly updated doc => instead it has the old document that was edited
  // main goal here =>  is it extract the id of the tour that was updated
  this.updatedDoc = await this.findOne();

  next();
});

// after extracting the updated doc => then perform the calculation
reviewSchema.post(/^findOneAnd/, async function () {
  // post => would not help in this situation because we have no access to the query after execution
  // get the tour id from the middleware that extract the tour that was mutated
  await this.updatedDoc.constructor.calculateAverageRatings(
    this.updatedDoc.tour
  );
});
/*=======================================*/

const Review = mongoose.model('Review', reviewSchema);

module.exports = Review;
