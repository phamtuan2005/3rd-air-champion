import axios from "axios";
const BACKEND_ENDPOINT = import.meta.env.VITE_BACKEND_ENDPOINT || "";

export const createBookingRequest = async (request: {
  host: string;
  guestName: string;
  guestPhone: string;
  date: string;
  room: string;
  duration: number;
  numberOfGuests: number;
  notes?: string;
}) => {
  const response = await axios.post(
    `${BACKEND_ENDPOINT}/booking-request/create`,
    request,
  );
  return response.data;
};

export const fetchBookingRequestsByHost = async (
  hostId: string,
  token: string,
) => {
  const response = await axios.post(
    `${BACKEND_ENDPOINT}/booking-request/get/host`,
    { hostId },
    { headers: { Authorization: `Bearer ${token}` } },
  );
  return response.data;
};

export const deleteBookingRequest = async (id: string, token: string) => {
  const response = await axios.post(
    `${BACKEND_ENDPOINT}/booking-request/delete`,
    { id },
    { headers: { Authorization: `Bearer ${token}` } },
  );
  return response.data;
};

export const fetchBookingRequestsByGuest = async (
  hostId: string,
  phone: string,
) => {
  const response = await axios.post(
    `${BACKEND_ENDPOINT}/booking-request/get/guest`,
    { hostId, phone },
  );
  return response.data;
};

export const fetchCalendarBookingsByGuest = async (
  calendarId: string,
  phone: string,
) => {
  const response = await axios.post(
    `${BACKEND_ENDPOINT}/booking-request/get/guest/calendar`,
    { calendarId, phone },
  );
  return response.data;
};

export const updateBookingRequestStatus = async (
  id: string,
  status: string,
  token: string,
) => {
  console.log(id, status, token);
  const response = await axios.put(
    `${BACKEND_ENDPOINT}/booking-request/update/status`,
    { id, status },
    { headers: { Authorization: `Bearer ${token}` } },
  );
  return response.data;
};