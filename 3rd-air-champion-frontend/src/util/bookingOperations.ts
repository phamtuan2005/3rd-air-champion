import axios from "axios";
const BACKEND_ENDPOINT = import.meta.env.VITE_BACKEND_ENDPOINT || "";

export const postBooking = async (
  request: {
    calendar: string;
    date: string;
    guest: string;
    isAirBnB: boolean;
    numberOfGuests: number;
    room: string;
    duration: number;
  },
  token: string
) => {
  return axios
    .post(`${BACKEND_ENDPOINT}/day/book/range`, request, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    })
    .then((result) => result.data)
    .catch((err) => {
      if (err.response && err.response.data && err.response.data.errors) {
        throw err.response.data.errors;
      }
      // Default error message if no backend message is available
      throw "An unexpected error occurred. Please try again.";
    });
};

export const updateBookingGuest = async (
  request: {
    id: string;
    notes?: string;
    earlyCheckin?: boolean;
    lateCheckout?: boolean;
    numberOfGuests?: number;
    alias?: string;
  },
  token: string
) => {
  return axios
    .post(`${BACKEND_ENDPOINT}/day/update/booking/guest`, request, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    })
    .then((result) => result.data)
    .catch((err) => {
      if (err.response && err.response.data && err.response.data.errors) {
        throw err.response.data.errors;
      }
      // Default error message if no backend message is available
      throw "An unexpected error occurred. Please try again.";
    });
};

export const updateBookingAirbnbPrice = async (
  request: {
    id: string;
    airbnbPrice: number;
  },
  token: string
) => {
  return axios
    .post(`${BACKEND_ENDPOINT}/day/update/booking/airbnb-price`, request, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    })
    .then((result) => result.data)
    .catch((err) => {
      if (err.response && err.response.data && err.response.data.errors) {
        throw err.response.data.errors;
      }
      throw "An unexpected error occurred. Please try again.";
    });
};

export const updateUnbookGuest = async (id: string, token: string) => {
  return axios
    .post(
      `${BACKEND_ENDPOINT}/day/update/unbook/guest`,
      { id },
      {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      }
    )
    .then((result) => result.data)
    .catch((err) => {
      if (err.response && err.response.data && err.response.data.errors) {
        throw err.response.data.errors;
      }
      // Default error message if no backend message is available
      throw "An unexpected error occurred. Please try again.";
    });
};
