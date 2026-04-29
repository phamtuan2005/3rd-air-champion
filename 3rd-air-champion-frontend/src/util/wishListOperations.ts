import axios from "axios";

const BACKEND_ENDPOINT = import.meta.env.VITE_BACKEND_ENDPOINT || "";

export interface WishListEntry {
  id: string;
  guestPhone: string;
  guestName: string;
  dates: string[];
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