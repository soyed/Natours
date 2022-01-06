const crypto = require('crypto');
const mongoose = require('mongoose');
const validator = require('validator');
const bcrypt = require('bcryptjs');

const userSchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, 'A user must have a name'],
    unique: true,
    trim: true,
  },
  email: {
    type: String,
    required: [true, 'A user must have an email'],
    unique: true,
    lowercase: true,
    validate: [validator.isEmail, 'Provide a valid email address'],
  },
  photo: {
    type: String,
    default: 'default.jpg',
  },
  password: {
    type: String,
    required: [true, 'A user must have a password'],
    min: [8, 'A password must have at least 8 characters'],
    // do not show password on payload
    select: false,
  },
  passwordConfirm: {
    type: String,
    required: [true, 'A user must have a password'],
    min: [8, 'A password must have at least 8 characters'],
    // VALIDATE THE PASSWORD
    validate: {
      // This only works on CREATE AND SAVE!
      validator: function (el) {
        return this.password === el;
      },
      message: 'Password and passwordConfirm must match',
    },
  },
  passwordChangedAt: { type: Date },
  role: {
    type: String,
    enum: ['user', 'guide', 'lead-guide', 'admin'],
    default: 'user',
  },
  passwordResetToken: { type: String },
  passwordResetExpires: { type: Date },
  // create an active property => to track status of user account
  // must be hidden from user
  active: { type: Boolean, default: true, select: false },
});

/*=============================================================*/
// Middle Wares
// Never store plain passwords in the database =>
//best to be done in the model => password encryption

/**
 * encrypt in the middleware once the data has been received and before it is persisted
 * Encrypt password when it is created or new
 */
userSchema.pre('save', async function (next) {
  if (!this.isModified('password')) {
    // do not encrypt password if it is not modified
    return next();
  }

  // hashing => encrypt - brute force attack can be used to hack weak type or store or encrypted passwords
  // the 12 - stands for salt - for how CPU intensive the encryption would be
  this.password = await bcrypt.hash(this.password, 12);
  // delete passwordConfirm not needed on the backend
  this.passwordConfirm = undefined;
  next();
});

/**
 * This middleware updates the passwordChangedAt property
 * This is very important to also ensure token remains valid on re-authentication
 * The token and passwordChangedAt are used to test the validity of a token in database
 */
userSchema.pre('save', function (next) {
  // update the passwordChangedAt property
  // if document is new || password was not change forward to next pipeline
  if (!this.isModified('password') || this.isNew) {
    return next();
  }
  // why? - because sometimes tokens are created before the passwordChangedAt property gets a timestamp => so make up for this anomaly
  // HACKY: severity - 3;
  this.passwordChangedAt = Date.now() - 1000;
  next();
});

/**
 * This is a middleware created to hide the active property from all queries
 * Active property => tracks a current users status
 */
userSchema.pre(/^find/, function (next) {
  // points to the current query
  // this means only return active users
  this.find({ active: { $ne: false } });
  next();
});
/*=============================================================*/
// Schema defined methods
/**
 * Decrypt password and compare with the req.password sent when a user logins in
 * in this case req.password is encrypted then compared with the encrypted password stored in the db
 * This is done in the model since it is model related
 * Instance method => method available on all document of a collection
 * @param {*} candidatePassword => password from the login request
 * @param {*} userPassword => password stored in the database for the user
 * @returns boolean
 */
userSchema.methods.correctPassword = async function (
  candidatePassword,
  userPassword
) {
  // userPassword is required since it has been removed from end point
  return await bcrypt.compare(candidatePassword, userPassword);
};

/**
 * Checks if password has been changed be comparing the token and last time password was changed
 * if the token creation time is less than the last time password was changed
 * that is an invalid token and a 401 must be sent as a response
 * @param {*} JWTTimeStamp => token time stamp
 * @returns boolean
 * Check if password has been changed since token creation
 */
userSchema.methods.hasPasswordBeenChanged = function (JWTTimeStamp) {
  // only valid if password has been changed
  if (this.passwordChangedAt) {
    const parsedTimeStamp = parseInt(
      this.passwordChangedAt.getTime() / 1000,
      10
    );
    // this means the time of creation for the token is less than the changed password time => a change has been made
    return JWTTimeStamp < parsedTimeStamp;
  }
  // return false by default => PASSWORD WAS NOT CHANGED
  return false;
};

/***
 * This function creates a random Password reset token.
 * The created token does not need to be as strong as the encryption for the password
 * Note: This does not save to the document instead it only modifies the document
 * @returns String => the reset token password change
 */
userSchema.methods.createPasswordResetToken = function () {
  // this created token is a temporary access for the user and it is used to create a new password
  // there is usually an expiring date on this tokens
  // this are never stored in the database
  const resetToken = crypto.randomBytes(32).toString('hex');
  // encrypt the password => this is the password saved token saved in the db => must be encrypted
  this.passwordResetToken = crypto
    .createHash('sha256')
    .update(resetToken)
    .digest('hex');

  // set a timer for token to expire => usually a time mins range
  this.passwordResetExpires = Date.now() + 10 * 60 * 1000;

  // users only get a plain text to reset password
  return resetToken;
};
/*=============================================================*/

const User = mongoose.model('User', userSchema);

module.exports = User;
