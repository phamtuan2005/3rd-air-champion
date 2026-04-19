import axios from "axios";

const BACKEND_ENDPOINT = import.meta.env.VITE_BACKEND_ENDPOINT || "";

export const fetchDays = async (calendarId: string, token: string) => {
  return axios

    .post(
      `${BACKEND_ENDPOINT}/day/get/host`,
      { calendarId: calendarId },
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

export const fetchAirBnBBookingCount = async (guest: string, token: string) => {
  return axios
    .post(
      `${BACKEND_ENDPOINT}/day/get/airbnb/count`,
      { guest },
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

export const blockDay = async (
  calendarId: string,
  date: string,
  token: string
) => {
  return axios

    .post(
      `${BACKEND_ENDPOINT}/day/block/one`,
      { calendar: calendarId, date },
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

export const unblockDay = async (
  calendarId: string,
  date: string,
  token: string
) => {
  return axios

    .post(
      `${BACKEND_ENDPOINT}/day/unblock/one`,
      { calendar: calendarId, date },
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

export const blockRoom = async (
  calendarId: string,
  roomId: string,
  date: string,
  duration: number,
  token: string
) => {
  return axios
    .post(
      `${BACKEND_ENDPOINT}/day/block/room`,
      { calendar: calendarId, room: roomId, date, duration },
      { headers: { Authorization: `Bearer ${token}` } }
    )
    .then((result) => result.data)
    .catch((err) => {
      if (err.response && err.response.data && err.response.data.errors) {
        throw err.response.data.errors;
      }
      throw "An unexpected error occurred. Please try again.";
    });
};

export const unblockRoom = async (
  calendarId: string,
  roomId: string,
  date: string,
  duration: number,
  token: string
) => {
  return axios
    .post(
      `${BACKEND_ENDPOINT}/day/unblock/room`,
      { calendar: calendarId, room: roomId, date, duration },
      { headers: { Authorization: `Bearer ${token}` } }
    )
    .then((result) => result.data)
    .catch((err) => {
      if (err.response && err.response.data && err.response.data.errors) {
        throw err.response.data.errors;
      }
      throw "An unexpected error occurred. Please try again.";
    });
};
