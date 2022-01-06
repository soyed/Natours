const express = require('express');
const {
  getAllUsers,
  getUser,
  deleteUser,
  updateUser,
  createUser,
  updateMe,
  deleteMe,
  getMe,
  uploadUserPhoto,
  resizeUserPhoto,
} = require('../controllers/userController');

const {
  signup,
  login,
  forgotPassword,
  resetPassword,
  updatePassword,
  protect,
  restrictTo,
  logout,
} = require('../controllers/authController');

const userRouter = express.Router();

/*===========================================*/
// Authentication
userRouter.post('/signup', signup);
userRouter.post('/login', login);
userRouter.get('/logout', logout);

// Password Reset Functionality
userRouter.post('/forgotPassword', forgotPassword);
userRouter.patch('/resetPassword/:token', resetPassword);

// protect all user routes => using middleware => All routes after these middleware are protected
userRouter.use(protect);

// query current user information
userRouter.get('/me', getMe, getUser);

userRouter.patch('/updateMyPassword', updatePassword);
// upload => multer function that allows uploading of files | photos allows a post || patch route
// single => allows only one file
userRouter.patch('/updateMe', uploadUserPhoto, resizeUserPhoto, updateMe);

userRouter.delete('/deleteMe', deleteMe);

// Routes for users
// Restrict all user information mutation to Admin
userRouter.use(restrictTo('admin'));
userRouter.route('/').get(getAllUsers).post(createUser);

userRouter.route('/:id').get(getUser).patch(updateUser).delete(deleteUser);
/*===========================================*/

module.exports = userRouter;
