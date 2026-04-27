import axios from "axios";

const BACKEND_ENDPOINT = import.meta.env.VITE_BACKEND_ENDPOINT || "";

export const fetchGuest = async (id: string, token: string) => {
  return axios
    .post(
      `${BACKEND_ENDPOINT}/guest/get/one`,
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

export const fetchGuests = async (host: string, token: string) => {
  return axios
    .post(
      `${BACKEND_ENDPOINT}/guest/get/host`,
      { host },
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

export const createGuest = async (
  guestObject: { name: string; phone: string },
  token: string
) => {
  return axios
    .post(
      `${BACKEND_ENDPOINT}/guest/create`,
      { ...guestObject },
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

export const updateGuest = async (
  guest: { id: string; name: string; phone: string; email?: string; notes?: string; returning?: boolean },
  token: string
) => {
  return axios
    .put(
      `${BACKEND_ENDPOINT}/guest/update`,
      { ...guest },
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

export const deleteGuest = async (guestId: string, token: string) => {
  return axios
    .post(
      `${BACKEND_ENDPOINT}/guest/remove`,
      { guestIds: [guestId] },
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


export const fetchGuestByPhone = async (phone: string, host: string) => {
  return axios
    .post(`${BACKEND_ENDPOINT}/booking-request/guest-by-phone`, { phone, host })
    .then((result) => result.data as { id: string; name: string; phone: string; pricing: { id?: string; room: string; price: number }[] } | null)
    .catch(() => null);
};

export const updateGuestPricing = async (
  body: { guest: string; room: string; price: number },
  token: string
) => {
  return axios
    .post(`${BACKEND_ENDPOINT}/guest/update/pricing`, body, {
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
