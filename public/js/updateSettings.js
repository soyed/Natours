/* eslint-disable */
import axios from 'axios';
import { showAlert } from './alerts';
// function top update user information using API route

/**
 *
 * @param {*} param => data to update
 * @param {*} type => 'password' || 'data'
 */
export const updateUserInfo = async (data, type) => {
  try {
    // 1. change api route based on the type of request
    // this API routes do not require host path => only because it is hosted on the server
    const url =
      type === 'password'
        ? '/api/v1/users/updateMyPassword'
        : '/api/v1/users/updateMe';

    // 1. send request to backend to update user information
    const res = await axios({
      method: 'PATCH',
      url,
      data,
    });

    // 2. showAlert of new update and reload the page if successful
    if (res.data.status === 'success') {
      showAlert(res.data.status, 'Updated User Information Successfully!');
    }
  } catch (error) {
    // 3. Log error to the console
    console.error(error.response.data);
    const { message } = error.response.data;
    // alert the error message
    showAlert('error', message);
  }
};
