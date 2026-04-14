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
  roomObject: { id: string; name: string; price: number; roomCode: string; active: boolean },
  token: string
) => {
  const body = {
    id: roomObject.id,
    name: roomObject.name,
    price: roomObject.price,
    roomCode: roomObject.roomCode,
    active: roomObject.active,
  };
  console.log("[updateRoom] sending:", body);
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
    .then((result) => {
      console.log("[updateRoom] response:", result.data);
      return result.data;
    })
    .catch((err) => {
      console.log("[updateRoom] error:", err.response?.data ?? err);
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
  roomObject: { name: string; price: number; roomCode?: string },
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