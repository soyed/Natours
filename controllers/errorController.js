const AppError = require('../utils/appError');
/*********Helper Methods *****************/

const DUPLICATE_REGEX = /(["'])(\\?.)*?\1/;
//Handling Database Errors

/**
 *
 * @param {*} error
 */
const handleDBCastError = (err) => {
  const message = `Invalid ${err.path}: ${err.value}.`;
  // 400 => invalid request
  return new AppError(message, 400);
};

/**
 *
 * @param {*} err
 * @returns
 */
const handleDBDuplicateFields = (err) => {
  const duplicateValue = err.errmsg.match(DUPLICATE_REGEX)[0];
  const message = `Duplicate Field Value: ${duplicateValue}. Please use another value! `;

  return new AppError(message, 400);
};

/**
 *
 * @param {*} err
 * @returns
 */
const handleDBValidationError = (err) => {
  // filter for the error messages in the array of errors
  const errors = Object.values(err.errors).map((error) => error.message);

  const message = `Invalid Input Data: ${errors.join('. ')}`;

  return new AppError(message, 400);
};

/**
 * Error message to production with more properties for easier debugging
 * @param {*} err
 * @param {*} res
 */
const sendErrorDev = (err, req, res) => {
  //req.originalUrl => entire url =>
  if (req.originalUrl.startsWith('/api')) {
    res.status(err.statusCode).json({
      status: err.status,
      message: err.message,
      error: err,
      stack: err.stack,
    });
  } else {
    // in the case of view => error that is view related => /overview || /tour/:tourId || /login || /logout
    console.error('🧨 Error - ', err);
    res.status(err.statusCode).render('error', {
      title: 'Something went wrong!',
      message: err.message,
    });
  }
};

/**
 * Error response on production => more human ready but less information on cause of the error
 * @param {*} err: AppError
 * @param {*} res: Response
 */

const sendErrorProd = (err, req, res) => {
  if (req.originalUrl.startsWith('/api')) {
    // Operational : trusted error
    if (err.isOperational) {
      return res.status(err.statusCode).json({
        status: err.status,
        message: err.message,
      });
    }
    // Unknown cause of error => Dev Bug, third-party library
    // 1) Log Error => keeping errors in log
    console.error('🧨 Error - ', err);

    // 2) Send Generic Response
    return res
      .status(500)
      .json({ status: 'error', message: 'Something went wrong' });
  }
  // Error related to rendered website
  // Operational : trusted error

  if (err.isOperational) {
    console.error('🧨 Error - ', err);
    return res.status(err.statusCode).render('error', {
      title: 'Something went wrong!',
      message: err.message,
    });
  }

  // 2) Send Generic Response
  console.error('🧨 Error - ', err);
  return res.status(err.statusCode).render('error', {
    title: 'Something went wrong!',
    message: 'Invalid. Please Try Again later.',
  });
};

/**
 * Catches invalid login | authentication token
 */

const handleJWTInvalidTokenError = () =>
  new AppError('Invalid token. Login Again.', 401);

/**
 * Catches expired token and give users appropriate error message
 */

const handleJWTExpiredTokenError = () =>
  new AppError('Expired Token. Try Logging again.', 401);

/**
 * Errors in production and development should defer as expected just like how endpoint or sensitive information are hidden on the frontend
 * @param {*} err
 * @param {*} req
 * @param {*} res
 * @param {*} next
 */

const globalErrorHandler = (err, req, res, next) => {
  // 500 => internal service error
  err.statusCode = err.statusCode || 500;
  err.status = err.status || 'error';

  if (process.env.NODE_ENV === 'development') {
    sendErrorDev(err, req, res);
  }

  // Error message on prod has to be meaningful has expected
  if (process.env.NODE_ENV === 'production') {
    // clone the err => destructing it will omit the constructor => therefore properties will be missing
    let error = Object.assign(err);
    // mongodb errors

    // 1. Invalid ID => Object_Id cannot convert the id
    if (error.name === 'CastError') {
      error = handleDBCastError(error);
    }
    // 2. Duplicate Key Errors
    if (error.code === 11000) {
      error = handleDBDuplicateFields(error);
    }
    // 3. Validation Error
    if (error.name === 'ValidationError') {
      error = handleDBValidationError(error);
    }

    // handling Token Errors
    // 4. Invalid Token Error
    if (error.name === 'JsonWebTokenError') {
      error = handleJWTInvalidTokenError();
    }
    // 5. Expired Token Signature
    if (error.name === 'TokenExpiredError') {
      error = handleJWTExpiredTokenError();
    }

    sendErrorProd(error, req, res);
  }
};

module.exports = globalErrorHandler;
