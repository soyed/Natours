const APIFeatures = require('../utils/apiFeatures');
const AppError = require('../utils/appError');
const catchAsync = require('../utils/catchAsync');

// a factory function is a function that returns another function => update, delete, read

/*===============================================*/
/**
 * A generic function for models to delete from the database for the specified model
 * @param {*} model => Tour | Review | User => All Schema Model
 * @returns void
 */
exports.deleteOne = (Model) =>
  catchAsync(async (req, res, next) => {
    // 1. delete the review by Id
    const doc = await Model.findByIdAndDelete(req.params.id);

    // 1. If no document throw error
    if (!doc) {
      return next(
        new AppError(`No document found with the ID: ${req.params.id}`, 404)
      );
    }

    // 3. send response
    res.status(204).json({ status: 'success', data: null });
  });

exports.updateOne = (Model) =>
  catchAsync(async (req, res, next) => {
    // NIT: Maybe parse the req.body extra security measure??

    // 1. update document by Id => update with new req.body and revalidate document
    const doc = await Model.findByIdAndUpdate(req.params.id, req.body, {
      // to return update document
      new: true,
      runValidators: true,
    });
    // 3. if no doc found throw error
    if (!doc) {
      return next(
        new AppError(`No Document found with the Id: ${req.params.id}`, 404)
      );
    }
    // 4. send response
    // TODO: refactor data: {doc} => data: {"MODEL_NAME": doc}
    res.status(201).json({
      status: 'success',
      data: { doc },
    });
  });

exports.createOne = (Model) =>
  catchAsync(async (req, res, next) => {
    // 1. Create new document
    const doc = await Model.create(req.body);
    // 2. Send Response
    res.status(201).json({
      status: 'success',
      data: { doc },
    });
  });

/**
 *
 * @param {*} Model
 * @param {*} populateOptions
 * @returns
 */
exports.getOne = (Model, populateOptions) =>
  catchAsync(async (req, res, next) => {
    // 1. Create query
    let query = Model.findById(req.params.id);

    // 2. if populate options => Add them
    if (populateOptions) query = query.populate(populateOptions);

    // 3. Get doc
    const doc = await query;
    // 2. if not found throw error
    if (!doc) {
      return next(
        new AppError(`No Document Found with the Id: ${req.params.id}`, 404)
      );
    }
    // 3. send response
    res.status(200).json({ status: 'success', data: { doc } });
  });

exports.getAll = (Model) =>
  catchAsync(async (req, res, next) => {
    // method 2
    // const tours = await Tour.find()
    //   .where('duration')
    //   .equals(5)
    //   .where('difficulty')
    //   .equals('easy');

    // both approaches are not ideal with implementation of pagination and limits and sort => instead perform the operations first then await

    // complex queries
    // {difficulty: 'easy', duration: {$gt: 'easy'}}
    // Instead of filtering like mongoDb you can pass the request body to find the corresponding data for the query
    // let query = Tour.find(queryStr);

    // Get all tours request does not need a guard for 404 => because it could have been a valid request but there just no matches for the requested filter

    //HACK: ALLOW NESTED ROUTES ON TOUR REVIEWS
    let filter = {};
    // fetching reviews from nested route
    if (req.params.tourId) {
      filter = { tour: req.params.tourId };
    }

    // EXECUTE QUERY
    const features = new APIFeatures(Model.find(filter), req.query)
      .filter()
      .sort()
      .limitFields()
      .paginate();

    // to get statistics on the query => explain() => measures query analytics
    const docs = await features.query;

    res.status(200).json({
      status: 'success',
      results: docs.length,
      data: { docs },
    });
  });
/*===============================================*/
