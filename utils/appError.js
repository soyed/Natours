// error class => standard practice to have an error class => prevent redundant code across the app

// class inheritance
/**
 * This AppError Class handles all operation errors
 * Errors dealing with network or database connection,
 * User Errors from routes called
 */

class AppError extends Error {
  constructor(message, statusCode) {
    super(message);
    this.statusCode = statusCode;
    this.status = `${statusCode}`.startsWith('4') ? 'fail' : 'error';
    // no third-party error or dev caused error to be sent to client
    this.isOperational = true;
    // stack trace for the error
    Error.captureStackTrace(this, this.constructor);
  }
}

module.exports = AppError;
