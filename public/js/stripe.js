/* eslint-disable */
import axios from 'axios';
import { showAlert } from './alerts';
const stripe = Stripe(
  'pk_test_51JvqF4EQ1brAT2zcygAQXB8s5Lke8hIg3mJflOuFvDpmN6njiZIA6Kxg7h0tlQHCNQP2wwxQmk3IDKmVIkGoux1q00b2bzJGRd'
);

export const bookTour = async (tourId) => {
  try {
    // 1. Get Checkout session from API
    const session = await axios(`/api/v1/bookings/checkout-session/${tourId}`);

    // 2. Create Checkout form + charge credit card
    await stripe.redirectToCheckout({ sessionId: session.data.session.id });
  } catch (error) {
    console.error(error);
    showAlert('error', error);
  }
};
