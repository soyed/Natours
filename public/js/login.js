/* eslint-disable */

import axios from 'axios';
import { showAlert } from './alerts';

// Send request to the backend to authenticate users
export const loginUser = async (email, password) => {
  try {
    const res = await axios({
      method: 'POST',
      // never make url address => its IP address => this is error bound => REMEMBER
      url: '/api/v1/users/login',
      data: { email, password },
    });

    if (res.data.status === 'success') {
      showAlert(res.data.status, 'Logged In Successfully');
      // reload page after successful sign in
      window.setTimeout(() => {
        // redirect to the overview page
        location.assign('/');
      }, 1500);
    }
  } catch (error) {
    console.error(error.response.data);
    const { message, status } = error.response.data;
    // alert the error message
    showAlert('error', message);
  }
};

export const logoutUser = async () => {
  try {
    const res = await axios({
      method: 'GET',
      // never make url address => its IP address => this is error bound => REMEMBER
      url: '/api/v1/users/logout',
    });

    // if success => reload the page
    if (res.data.status === 'success') location.reload(true);
  } catch (error) {
    console.error(error.response.data);
    const { message, status } = error.response.data;
    // alert the error message
    showAlert('error', message);
  }
};
