const { promisify } = require('util');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const User = require('../models/userModel');
const catchAsync = require('../utils/catchAsync');
const AppError = require('../utils/appError');
const Email = require('../utils/email');

/**
 * This controller is responsible for authenticating users across our app
 */

/**
 *  sign-in user after sign up
 * Create Token
 * Token header created automatically
 * (payload + header) + secret = JWT Token
 * set expiration data for login token
 * @params userId: String
 */
const signToken = (userId) =>
  jwt.sign({ id: userId }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRES_IN,
  });

//

/**
 * this method create and send token as response to authenticate users
 * @param {*} user: User
 * @param {*} statusCode: number
 * @param {*} res: Response
 * @return Response
 */
// what is a cookie?
// A cookie is a small piece of text the server can send to the client
// the client stores that cookie and all future requests will be directed to that server =>will will include that cookie

const createAndSendToken = (user, statusCode, res) => {
  // Store token
  const token = signToken(user._id);

  // create an expiration date
  const cookieExpirationDate =
    process.env.JWT_COOKIE_EXPIRES_IN * 24 * 60 * 60 * 1000;

  const cookieOptions = {
    expires: new Date(Date.now() + cookieExpirationDate),
    // to prevent cross browser attacks => XSS
    httpOnly: true,
  };

  // FIXME:set secure to true only on prod - is this a standard practice?
  // should we enforce security on all platforms?
  if (process.env.NODE_ENV === 'production') {
    //  only sent on secure connection => https
    cookieOptions.secure = true;
  }

  // Send a cookie
  res.cookie('jwt', token, cookieOptions);

  // hide user's password from payload
  // FIXME: is there a middleware that can automatically check this
  // logic is a bit redundant || error prone
  user.password = undefined;

  // 201 => Created response status
  res
    .status(statusCode)
    .json({ status: 'success', token, data: { user: user } });
};

exports.signup = catchAsync(async (req, res, next) => {
  // This is flawed anyone can create a role and have access to our application
  // instead only specific what you want to create
  //   const newUser = await User.create(req.body);

  //   this means special routes for admins to be created or manually adding role in the db
  const newUser = await User.create({
    name: req.body.name,
    email: req.body.email,
    password: req.body.password,
    passwordConfirm: req.body.passwordConfirm,
    passwordChangedAt: req.body.passwordChangedAt,
    role: req.body.role,
  });
  // req.protocol => http || https and req.get('host') => returns the current host of the website
  const url = `${req.protocol}:/${req.get('host')}/myaccount`;
  // 1. send a welcome email when a user signs up
  await new Email(newUser, url).sendWelcome();

  createAndSendToken(newUser, 201, res);
});

exports.login = catchAsync(async (req, res, next) => {
  const { email, password } = req.body;
  // Check if email and password exist
  if (!email || !password) {
    return next(new AppError('Email and Password must be provided.', 400));
  }
  // Check if user exist && password is correct => select password since it is no longer available on the payload
  const user = await User.findOne({ email }).select('+password');
  // current eslint version does not support optional chaining or nullish coalescing
  // const correctPassword = await user.correctPassword(password, user.password);

  if (!user || !(await user.correctPassword(password, user.password))) {
    // Status code 401 => UnAuthorized
    // Always go with vague response with authentication
    return next(new AppError('Invalid Email or Password.', 401));
  }

  // decrypting password and compare with the req.password
  // If Everything, is valid send JWT Token => token is the most important when user logins into the application
  createAndSendToken(user, 200, res);
});

/*=============================================================*/
/*********************** Protected Routes **********************/

/**
 * Protect routes and giving only authenticated users access to resources
 * JWT Token must be sent in a protected route to access protected resources
 */
exports.protect = catchAsync(async (req, res, next) => {
  // Get token and check if it exist
  let token;
  if (
    req.headers.authorization &&
    req.headers.authorization.startsWith('Bearer')
  ) {
    token = req.headers.authorization.split(' ')[1];
  } else if (req.cookies.jwt) {
    // Extracting  cookies from the req.cookies => which is handled by the cookie-parser package
    // in the case a request headers has not auth Token => this jwt Token is the authentication token
    token = req.cookies.jwt;
  }

  // Guard against null token
  if (!token) {
    return next(
      new AppError('Unauthorized Request. Login to get access.', 401)
    );
  }

  // Token Verification => this is async but can be promisified => look up promisify
  const decodedData = await promisify(jwt.verify)(
    token,
    process.env.JWT_SECRET
  );

  // this check is necessary because if a user is deleted the token remains valid
  // without this check anyone with a valid token can gain access through the deleted user's token
  // Therefore this validation is a must
  // Check if user still exist
  const validatedUser = await User.findById(decodedData.id);

  if (!validatedUser) {
    return next(new AppError('The user no longer exists for this token', 401));
  }

  // Check if password was changed after JWT Token was issued
  if (validatedUser.hasPasswordBeenChanged(decodedData.iat)) {
    return next(
      new AppError(
        'User password recently changed. User must login again.',
        401
      )
    );
  }
  // GRANT ACCESS TO PROTECTED ROUTE => only when all checks pass
  req.user = validatedUser;
  res.locals.user = validatedUser;
  next();
});

/**
 * This is used for render pages  => checks the current authentication status of user across the application
 * for every request = checks for user's authentication status
 *
 * Very similar to the protect route => but without any error being thrown
 */
exports.isLoggedIn = async (req, res, next) => {
  if (req.cookies.jwt) {
    // basically => instead of catching async errors => try and catch any error and if errors simply forward to the next middleware => not super sure why
    try {
      const token = req.cookies.jwt;

      const decodedData = await promisify(jwt.verify)(
        token,
        process.env.JWT_SECRET
      );

      const validatedUser = await User.findById(decodedData.id);

      if (!validatedUser) {
        return next();
      }

      // Check if password was changed after JWT Token was issued
      if (validatedUser.hasPasswordBeenChanged(decodedData.iat)) {
        return next();
      }
      // if all passes are valid => therefore there is a logged in user
      // added the validated user to locals => almost like a local storage for a Response
      res.locals.user = validatedUser;
      return next();
    } catch (error) {
      return next();
    }
  }
  next();
};

/**
 * since httpOnly cookie cannot be manipulated or destroyed
 * Work around would be =>
 * Create a new token => and set an expiration date and make it secure
 * That way an user without this 'loggedout' => token => implies user is no longer authenticated
 * Research better ways to handle user log out
 */
exports.logout = catchAsync(async (req, res, next) => {
  // After log out => jwt = 'loggedout' => therefore jwt malfunction error thrown
  res.cookie('jwt', 'loggedout', {
    expires: new Date(Date.now() + 10 * 1000),
    // secure token
    httpOnly: true,
  });

  res.status(200).json({ status: 'success' });
});

/**
 * Middle wares can't take parameters but just like in react => redux-thunk allows wrapper functions which allow parameters to be used with to the middleware function
 * @param {*} role
 */
exports.restrictTo =
  (...roles) =>
  (req, res, next) => {
    // this checks the validate user in the protected if the use role is not included
    // in the role passed to restricted to then the user has no permission

    if (!roles.includes(req.user.role)) {
      // 403 => forbidden => no permission
      return next(
        new AppError('You do not have permission to perform this action.', 403)
      );
    }
    // PERFORM ACTION - since the user role ie defined.
    next();
  };

// Password reset functionality
/**
 *
 * @param {*} req
 * @param {*} res
 * @param {*} next
 */
exports.forgotPassword = catchAsync(async (req, res, next) => {
  // 1) get user based on posted email
  const user = await User.findOne({ email: req.body.email });

  if (!user) {
    return next(new AppError('No user found with this Email Address', 404));
  }
  // 2. Generate a random token
  const resetToken = user.createPasswordResetToken();
  //save the user
  // deactivates all validators in the schema before saving => so only email can be accepted in the payload
  await user.save({ validateBeforeSave: false });

  try {
    // 3. Send to User's email
    const resetURL = `${req.protocol}://${req.get(
      'host'
    )}/api/v1/users/resetPassword/${resetToken}`;

    // 1. using the email class to send password Reset email
    await new Email(user, resetURL).sendPasswordReset();

    res.status(200).json({
      status: 'success',
      message: 'Password Reset Token sent to email',
    });
  } catch (error) {
    // in case of a failure
    // reset passwordToken and tokenExpires time
    user.passwordResetToken = undefined;
    user.passwordResetExpires = undefined;
    await user.save({ validateBeforeSave: false });

    // 500 => server error
    return next(
      new AppError('There was an error sending to the email. Try again Later'),
      500
    );
  }
});

/**
 *
 * @param {*} req
 * @param {*} res
 * @param {*} next
 */
exports.resetPassword = catchAsync(async (req, res, next) => {
  // 1. Get user based on token
  const hashedToken = crypto
    .createHash('sha256')
    .update(req.params.token)
    .digest('hex');
  // the token and compare with the saved token in the database
  const user = await User.findOne({
    passwordResetToken: hashedToken,
    passwordResetExpires: { $gt: Date.now() },
  });
  // 2. If token has not expired, and user exist, sey new password
  if (!user) {
    return next(new AppError('Token is Invalid or has Expired', 400));
  }

  user.password = req.body.password;
  user.passwordConfirm = req.body.passwordConfirm;
  // delete the token password and timer for the token password
  user.passwordResetToken = undefined;
  user.passwordResetExpires = undefined;
  // save and validate; in this case the passwordConfirm and password would be compared and throw appropriate errors needed
  await user.save();
  // 3. Update the changedPasswordAt property for user => done in the user model middleware

  // 4. Log the user in, send JWT
  createAndSendToken(user, 200, res);
});

/**
 * Allow logged in users to be able to update password without having to gor through the reset and forgot password route
 */
exports.updatePassword = catchAsync(async (req, res, next) => {
  // logged in user need to be validated using their current password
  // 1. Get the user from the collection
  const user = await User.findById(req.user._id).select('+password');
  // 2. Check if the posted current password is correct
  const validPassword = await user.correctPassword(
    req.body.passwordCurrent,
    user.password
  );

  // Guard against invalid users
  if (!validPassword) {
    // 403 => Forbidden - wrong information provided
    return next(new AppError('Invalid password provided. Try again!', 401));
  }

  // 3. If so, update the password
  user.password = req.body.password;
  user.passwordConfirm = req.body.passwordConfirm;
  await user.save();

  // Quick note why did we not do user.findByIdAndUpdate?
  // 1. the validation we have put in place for our schema will be passed
  // because behind the scenes mongo does not keep the object so this.whatever property would be invalid on update
  // the pre save middle wares would be by passed as well because update and save a re different event listeners

  // 4. Log user in, send JWT Token
  // const token = signToken(user._id);

  // res.status(200).json({
  //   status: 'success',
  //   token,
  // });

  createAndSendToken(user, 200, res);
});
/*=============================================================*/

/*=============================================================*/
// How JSON Web Token => JWT => Authentication
// REST API must be state
// a user sends a login request and a JWT Token is created to uniquely ID the user <== store on server
// this secret JWT is stored in local storage or cookies => meaning server has no idea who is actually login only the user gets the login feedback => in their browser

// to get access to sensitive information => use protectRoute and if valid Token the user gets protected Data
//  and all communication must be done over HTTPS only

// JWT TOKEN => HOW IT WORKS AND ITS FORMAT
// AN ENCODED JWT TOKEN HAS
// - Header => has algorithm = alg and type
// Payload => which has the token id
// Sensitive data is not store in the header and payload
// instead sensitive data is verify signature
// Verify Signature => HMACSHA256

// technically
// (header+payload) + secret = signature => JWT SECRET TOKEN => and sent to client
// the secret token must be verified =>
// JWT ORIGINAL TOKEN is compared against a test signature create from (header+payload) + secret
//  if there is a match user is authenticated else not authenticated

// SECRET is the CORE feature need to authenticate an JWT TOKEN

// RESEARCH ON BEST AUTHENTICATION PRACTICES
/*=============================================================*/
