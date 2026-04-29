import axios from "axios";

const BACKEND_ENDPOINT = import.meta.env.VITE_BACKEND_ENDPOINT || "";

export type WishListStatus = "waiting" | "notified" | "booked";

export interface WishListEntry {
  id: string;
  guestPhone: string;
  guestName: string;
  dates: string[];
  status: WishListStatus;
  createdAt: string;
  updatedAt: string;
}

export const toggleWishListDate = async (data: {
  host: string;
  guestPhone: string;
  guestName: string;
  date: string;
}): Promise<{ dates: string[] }> => {
  const response = await axios.post(`${BACKEND_ENDPOINT}/wish-list/toggle`, data);
  return response.data;
};

export const getGuestWishList = async (
  host: string,
  guestPhone: string,
): Promise<{ dates: string[] }> => {
  const response = await axios.post(`${BACKEND_ENDPOINT}/wish-list/get/guest`, {
    host,
    guestPhone,
  });
  return response.data;
};

export const getHostWishLists = async (
  hostId: string,
  token: string,
): Promise<WishListEntry[]> => {
  const response = await axios.get(`${BACKEND_ENDPOINT}/wish-list/get/host`, {
    params: { hostId },
    headers: { Authorization: `Bearer ${token}` },
  });
  return response.data;
};

export const updateWishListStatus = async (
  id: string,
  status: WishListStatus,
  token: string,
): Promise<void> => {
  await axios.patch(
    `${BACKEND_ENDPOINT}/wish-list/status`,
    { id, status },
    { headers: { Authorization: `Bearer ${token}` } },
  );
};

export const deleteWishListEntry = async (id: string, token: string): Promise<void> => {
  await axios.delete(`${BACKEND_ENDPOINT}/wish-list/${id}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
};