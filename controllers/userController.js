// Popular middleware that allows users to upload files with post | patch requests to the backend
const multer = require('multer');
// Image processing library for nodejs => works best with image resizing
const sharp = require('sharp');
const User = require('../models/userModel');
const catchAsync = require('../utils/catchAsync');
const AppError = require('../utils/appError');
const { deleteOne, updateOne, getOne, getAll } = require('./handlerFactory');

// Setting multer storage location => set a location and customized desired file name
// const multerStorage = multer.diskStorage({
//   destination: (req, file, cb) => {
//     // set destination
//     cb(null, 'public/img/users');
//   },
//   filename: (req, file, cb) => {
//     // file format => user-7367233233232.jpeg
//     // 1. Extract extension => it exist in req.file as property field => mimetype
//     const ext = file.mimetype.split('/')[1];
//     cb(null, `user-${req.user.id}-${Date.now()}.${ext}`);
//   },
// });
// Store image in memory as a buffer instead => more efficient eliminates having to write file to the disk and read from it again
const multerStorage = multer.memoryStorage();

/**
 * Testing that the file to the uploaded is indeed a file type
 * @param {*} req
 * @param {*} file
 * @param {*} cb
 */
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

/**
 * Allow uploading user photos
 */
exports.uploadUserPhoto = upload.single('photo');

// helper methods
/**
 * @brief - Filters for specific properties in a request body sent
 * @param {*} body
 * @param  {...any} properties
 *
 * @return an object of all fields in the properties specified
 */
const userDataParser = (body, ...properties) => {
  const newBody = {};
  Object.keys(body).forEach((item) => {
    if (properties.includes(item)) {
      newBody[item] = body[item];
    }
  });

  return newBody;
};

/**
 * Good practice to have a route to get the current users information
 */
exports.getMe = (req, res, next) => {
  req.params.id = req.user.id;
  next();
};

// middleware to resize the images upload for a user
exports.resizeUserPhoto = async (req, res, next) => {
  // guard against no file upload
  if (!req.file) {
    return next();
  }
  // 1. set the file name format => jpeg => because we have set the file type to that
  req.file.filename = `user-${req.user.id}-${Date.now()}.jpeg`;

  // Image processing => resize and reduce the image size in jpeg format => async since it takes time
  await sharp(req.file.buffer)
    .resize(500, 500)
    .toFormat('jpeg')
    .jpeg({ quality: 90 })
    .toFile(`public/img/users/${req.file.filename}`);

  next();
};

// This is update the user information =>
// this is done with a separate route when => update user information
// just like how changing password is done on another route
// make sure a separate route is made to update information for the current user as well
exports.updateMe = catchAsync(async (req, res, next) => {
  // 1. Create error is user POSTs password data
  if (req.body.password || req.body.passwordConfirm) {
    return next(
      new AppError(
        'Password Update cannot be done on this route. Use route /updateMyPassword',
        400
      )
    );
  }

  // 1b. All Parse Response body when saving to database
  const parsedBody = userDataParser(req.body, 'name', 'email');

  // 1c. Adding photos when updated current user
  if (req.file) {
    parsedBody.photo = req.file.filename;
  }

  // 2. Update the user document
  // NOTE: In this case findByIdAndUpdate can be used because no sensitive data and involved
  // therefore no validation is done before saving
  // if validation was involved => using findByIdAndUpdate would not consider those validation steps when updating the document
  const updatedUser = await User.findByIdAndUpdate(req.user.id, parsedBody, {
    new: true,
    runValidators: true,
  });

  res.status(200).json({ status: 'success', data: { user: updatedUser } });
});

// NOTE: Deleting Current User
// A deleted user is never actually deleted
// Instead their document is set as inactive
// why?
// in case the user decides to join the application again
// in production => there is usually some fallback for this example
// twitter accounts only gets deleted after a month permanently after which the user must sign up again
exports.deleteMe = catchAsync(async (req, res, next) => {
  // 1. Update user's status
  await User.findByIdAndUpdate(req.user.id, { active: false });

  // 204 => No Content
  res.status(204).json({ status: 'success', data: null });
});

exports.createUser = (req, res) => {
  res.status(500).json({
    status: 'error',
    message: 'This route is not defined! Use /signup instead',
  });
};

exports.getAllUsers = getAll(User);
exports.getUser = getOne(User);
// NOTE: DO NOT UPDATE PASSWORD WITH THIS ROUTE
exports.updateUser = updateOne(User);
exports.deleteUser = deleteOne(User);

// Evil regular expressions are expressions that take exponential time for non matching inputs
// can bring the application down

// NO-SQL Query Inject
//  complex queries that can be sent on endpoint and can be written to default to true
// mongoose prevent this because of the required schema
// NOTE: Even though noSQL requires no Schema => best practice is always have a structure you expect on your Database => can prevent forseeable attacks on database

// always use HTTPS => a non secure http request can be breached and sensitive data can be accessed e.g JWT Token
// csurf => to prevent CORS => Cross Site Scripting =>

// prevent parameter pollution => this happens when searching for two fields at the same time
// this can crash the application as there is no guard for this
