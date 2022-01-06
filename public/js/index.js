/* eslint-disable */
import '@babel/polyfill';
import { displayMap } from './mapbox';
import { bookTour } from './stripe';
import { updateUserInfo } from './updateSettings';
const { loginUser, logoutUser } = require('./login');

// DOM Elements
const mapBox = document.getElementById('map');
const loginForm = document.querySelector('.form--login');
const logoutBtn = document.querySelector('.nav__el--logout');
const updateUserForm = document.querySelector('.form-user-data');
const updatePasswordForm = document.querySelector('.form-user-settings');
const bookBtn = document.getElementById('book-tour');

// VALUES

/*========================================================================*/
// 1. Extract location FROM => map dataset => revert back to JSON
if (mapBox) {
  const locations = JSON.parse(
    document.getElementById('map').dataset.locations
  );
  displayMap(locations);
}

/*========================================================================*/
// 2. Login users
if (loginForm) {
  // 1. Login users on the client side
  loginForm.addEventListener('submit', (event) => {
    // 1. prevent default
    event.preventDefault();
    // 2. extract user email and password
    const email = document.getElementById('email').value;
    const password = document.getElementById('password').value;

    // 3. send a request to login the user
    loginUser(email, password);
  });
}

// 3. Logout Current User
if (logoutBtn) {
  logoutBtn.addEventListener('click', logoutUser);
}

// 4. Update User Information
if (updateUserForm) {
  updateUserForm.addEventListener('submit', (event) => {
    event.preventDefault();
    // 1. Create form data to update current user
    // Recreate => multipart/form-data why?
    //
    const form = new FormData();
    form.append('name', document.getElementById('name').value);
    form.append('email', document.getElementById('email').value);
    form.append('photo', document.getElementById('photo').files[0]);

    // 2. send request to the backend to update user information
    updateUserInfo(form, 'data');
  });
}

// 5. Update password form
if (updatePasswordForm) {
  updatePasswordForm.addEventListener('submit', async (event) => {
    event.preventDefault();

    document.querySelector('.btn--save-password').textContent = 'updating..';

    // 1. extract the password fields
    const passwordCurrent = document.getElementById('password-current').value;
    const password = document.getElementById('password').value;
    const passwordConfirm = document.getElementById('password-confirm').value;
    // 2. send request to update password
    await updateUserInfo(
      { passwordCurrent, password, passwordConfirm },
      'password'
    );

    // reset password fields
    document.querySelector('.btn--save-password').textContent = 'Save Password';
    document.getElementById('password-current').value =
      document.getElementById('password').value =
      document.getElementById('password-confirm').value =
        null;
  });
}

if (bookBtn) {
  bookBtn.addEventListener('click', (event) => {
    // 1. Change button content to processing
    event.target.textContent = 'Processing...';
    const { tourId } = event.target.dataset;

    bookTour(tourId);
  });
}
/*========================================================================*/
