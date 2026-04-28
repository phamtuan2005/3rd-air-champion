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
  roomObject: { id: string; name: string; price: number; roomCode: string; color?: string; active: boolean; photos?: string[] },
  token: string
) => {
  const { color, photos, ...rest } = roomObject;
  const body = { ...rest, ...(color !== undefined && { color }), ...(photos !== undefined && { photos }) };
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

export const uploadRoomPhoto = async (file: File, roomName: string, token: string): Promise<string> => {
  const formData = new FormData();
  formData.append("photo", file);
  return axios
    .post(`${BACKEND_ENDPOINT}/room/photos/upload?roomName=${encodeURIComponent(roomName)}`, formData, {
      headers: { Authorization: `Bearer ${token}` },
    })
    .then((result) => result.data.url)
    .catch((err) => {
      if (err.response && err.response.data && err.response.data.error) {
        throw err.response.data.error;
      }
      throw "Failed to upload photo. Please try again.";
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