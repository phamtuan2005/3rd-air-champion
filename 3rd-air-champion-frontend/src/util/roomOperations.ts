import axios from "axios";

const BACKEND_ENDPOINT = import.meta.env.VITE_BACKEND_ENDPOINT || "";

export const fetchRooms = async (host: string, token: string) => {
  return axios
    .post(
      `${BACKEND_ENDPOINT}/room/get/host`,
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
      throw "An unexpected error occurred. Please try again.";
    });
};

export const updateRoom = async (
  roomObject: { id: string; name: string; price: number; roomCode: string; color?: string; active: boolean },
  token: string
) => {
  const { color, ...rest } = roomObject;
  const body = color !== undefined ? { ...rest, color } : rest;
  return axios
    .put(
      `${BACKEND_ENDPOINT}/room/update`,
      body,
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
      throw "An unexpected error occurred. Please try again.";
    });
};

export const deleteRoom = async (roomId: string, token: string) => {
  return axios
    .post(
      `${BACKEND_ENDPOINT}/room/delete`,
      { roomIds: [roomId] },
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
      throw "An unexpected error occurred. Please try again.";
    });
};

export const createRoom = async (
  roomObject: { name: string; price: number; roomCode?: string; color?: string },
  token: string
) => {
  return axios
    .post(
      `${BACKEND_ENDPOINT}/room/create`,
      { ...roomObject },
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
      throw "An unexpected error occurred. Please try again.";
    });
};