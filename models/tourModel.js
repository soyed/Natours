/* eslint-disable prefer-arrow-callback */
const mongoose = require('mongoose');
const slugify = require('slugify');
//const User = require('./userModel');
// third-party validator
// const validator = require('validator');
// mongoose is all about models => models built using schema for the database
// models are like javascript classes => blueprint for creating Models

// Building Schema
// required property can take a validation message => lookup validators in mongodb
// data validation and sanitation => standard never accept data as it is sanitization is a must

const tourSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'A tour must have a name'],
      // unique not a validation
      unique: true,
      trim: true,
      // validators
      maxlength: [
        40,
        'A tour name must have less than or equal to 40 characters',
      ],
      minlength: [
        10,
        'A tour name must have more than or equal to 10 characters',
      ],
      // validate: [validator.isAlpha, 'Tour name must only contain characters'],
    },
    slug: String,
    duration: { type: Number, required: [true, 'A tour must have a duration'] },
    maxGroupSize: {
      type: Number,
      required: [true, 'A tour must have a group size'],
    },
    difficulty: {
      type: String,
      required: [true, 'A tour must have a difficulty'],
      // enumerator validators => only works on strings
      enum: {
        values: ['easy', 'medium', 'difficult'],
        message: 'Difficulty is either: easy, medium, difficult ',
      },
    },
    price: { type: Number, required: [true, 'A tour must have a price'] },
    priceDiscount: {
      type: Number,
      validate: {
        validator: function (val) {
          // must return true or false =>ensure priceDiscount is lower than actual price

          // HACKY: THIS Keyword would not work on an update => only valid on current doc for new document creation
          return val < this.price;
        },
        message: 'Discount price ({VALUE}) must be below regular price',
      },
    },
    summary: {
      type: String,
      // only works for strings - removes whitespace in the beginning and end
      trim: true,
      required: [true, 'a tour must have a summary'],
    },
    description: {
      type: String,
      trim: true,
    },
    // image is not kept in the database just the filepath
    imageCover: {
      type: String,
      required: [true, 'A tour must have a cover image'],
    },
    images: [String],
    createdAt: {
      type: Date,
      default: Date.now(),
      // hiding sensitive information from clients
      select: false,
    },
    startDates: [Date],
    // this properties are not required because they are handled on the backend
    ratingsAverage: {
      type: Number,
      default: 4.5,
      // validators on numbers and Dates
      min: [1, 'Rating must be above 1.0'],
      max: [5, 'Rating must be below 5.0'],
      // round up average => can be done on the frontend tbh
      set: (value) => Math.round(value * 10) / 10,
    },
    ratingsQuantity: {
      type: Number,
      default: 0,
    },
    secretTour: {
      type: Boolean,
      default: false,
    },
    startLocation: {
      // geo-spatial describes places on earth using longitude and latitude, supported out of box by mongodb
      // GEO-JSON used by mongodb
      type: {
        type: String,
        // can specify polygon, lines etc => look up on mongodb
        default: 'Point',
        enum: ['Point'],
      },
      // array of coordinates
      coordinates: [Number],
      address: String,
      description: String,
    },
    // to embed locations into Tours model => embedded data model
    // this is used to insert brand now documents inside a parent document => in this case nest locations into Tour
    locations: [
      {
        type: {
          type: String,
          // can specify polygon, lines etc => look up on mongodb
          default: 'Point',
          enum: ['Point'],
        },
        // array of coordinates
        coordinates: [Number],
        address: String,
        description: String,
        // day of tour
        day: Number,
      },
    ],
    // assign guides to tours
    //guides: Array,
    // child referencing with mongodb
    guides: [
      {
        type: mongoose.Schema.ObjectId,
        ref: 'User',
      },
    ],
  },
  // to show virtual props => not stored in the database or likely calculated
  {
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

// get indexes on queries
// indexes are used to optimize the speed of queries
// an example in mongodb => _id is an index that is pre-built therefore instead of searching through all documents when a request is sent => it simply generates its response from the list of queries => extract only data of meaning ids
// 1 => ascending order => -1 => descending order
// other types of indexes as well
// unique properties in a schema also get assigned an index in mongoDB automatically => example "name" property in Tour Schema is set as unqiue => there it creates an automatically index and assigns the unique property

// this is a single index
// tourSchema.index({ price: 1 });
// compound index is very effective as well => better option as it covers two properties at once and can also cover single queries of any of the group properties

// indexes can be quite costly => beware of how much resources are allocated and make sure indexes are not randomly set without a high use for it
// => low read/high write => def needs no index => useless
tourSchema.index({ price: 1, ratingsAverage: -1 });
tourSchema.index({ slug: 1 });

// create index for startLocation => for geo-spatial queries within a specified distance of a location
// 2d used to let mongodb know this is a => 2 dimensional index
tourSchema.index({ startLocation: '2dsphere' });

// virtual properties are props defined that dont get saved to db
// function used because arrow function does not have its own keyword
// can't be used in query

// note => to set indexes => ensure we know what properties are the most requested or searched for and based on that set indexes which optimizes the waiting time for a response
tourSchema.virtual('durationWeeks').get(function () {
  return this.duration / 7;
});

// what does virtual populate do?
// currently references tour and user but these two do not know if its existing relationship with review therefore => when a tour or user is queried no review shows up
// ideally solution
// 1. extra query to get reviews for each tour => overhead
// 2. reference the reviews in the user or tour => not ideally as reviews might exceed total data threshold of 60MB

// 3. virtual populate by mongo => way of referencing reviews in tour and user without persisting to database

// virtual populate reviews into tour
tourSchema.virtual('reviews', {
  ref: 'Review',
  // the name of property that reference the parent => tour => which has the tour Id
  foreignField: 'tour',
  // local field Id
  localField: '_id',
});

// document middleware => there are 4 => query,document, aggregate and model
// mongo middleware => allows pre and post hooks

// doc middleware => runs before save() and create()
tourSchema.pre('save', function (next) {
  // this middle is used to create a slug => string that can be put in a url
  this.slug = slugify(this.name, { lower: true });
  next();
});

// // there can be multiple middle wares as well
// tourSchema.pre('save', function (next) {
//   console.log('Will save document...');
//   next();
// });

// // post middle ware
// tourSchema.post('save', function (doc, next) {
//   console.log(doc);
//   next();
// });

// QUERY MIDDLEWARE => runs before and after query execution
// this would works for types of find command now
tourSchema.pre(/^find/, function (next) {
  // points to the current query
  this.find({ secretTour: { $ne: true } });
  this.start = Date.now();
  // secretTour
  next();
});

/**
 * This middleware is responsible for embedding the user guides with the tours
 * Find the tour guides from User database by Id and embeds tour guides information in tour's response
 * This works for creating new document and not updating them => to attach the tour guides when updating as well
 * a work around can be introduced
 */
// tourSchema.pre('save', async function (next) {
//   const guidesPromises = this.guides.map(async (id) => await User.findById(id));
//   this.guides = await Promise.all(guidesPromises);
//   next();
// });

/**
 * This a query middleware that automatically populates all tour queries with the guides documents
 */
tourSchema.pre(/^find/, function (next) {
  // populate is used to display the content || documents that has been referenced => child referencing
  // in this case display the document content of guides => A form of Users
  this.populate({
    path: 'guides',
    select: '-__v -passwordChangedAt',
  });
  next();
});

tourSchema.post(/^find/, function (docs, next) {
  console.log(`Query took ${Date.now() - this.start} milliseconds!`);
  next();
});

// AGGREGATION MIDDLEWARE => add hooks before and after aggregation
// tourSchema.pre('aggregate', function (next) {
//   // points to the current aggregation object => therefore to filter out simply do another match stage
//   // add match to beginning of the pipeline
//   this.pipeline().unshift({ $match: { secretTour: { $ne: true } } });

//   next();
// });

// tourSchema.post('aggregate', function (docs, next) {
//   next();
// });

// MODEL MIDDLEWARE SKIPPED

// Building mongoose models => mongodb automatically created the connection name made it plural from the tour model
const Tour = mongoose.model('Tour', tourSchema);

module.exports = Tour;
