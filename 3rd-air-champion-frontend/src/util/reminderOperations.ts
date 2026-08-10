import axios from "axios";

const BACKEND_ENDPOINT = import.meta.env.VITE_BACKEND_ENDPOINT || "";

export interface SentReminderType {
  taskId: string;
  sentBy: string;
  sentAt: string;
}

const auth = (token: string) => ({ headers: { Authorization: `Bearer ${token}` } });

// Which check-in reminders have already gone out, for the whole account.
//
// This used to live in one browser's localStorage, so Cindy could not see that
// Anh-Tuan had already texted a guest — each of them saw an unticked box for
// work the other had done. Whether a guest has been reminded is a fact about
// the house, not about a device.
export const fetchSentReminders = async (
  hostId: string,
  token: string,
): Promise<SentReminderType[]> => {
  const response = await axios.get(`${BACKEND_ENDPOINT}/reminder/list`, {
    params: { hostId },
    ...auth(token),
  });
  return response.data;
};

// Idempotent — the send button and the checkbox both call this, and pressing
// twice must not move the recorded time.
export const markReminderSent = async (
  data: { host: string; taskId: string; sentBy?: string },
  token: string,
): Promise<SentReminderType> => {
  const response = await axios.post(`${BACKEND_ENDPOINT}/reminder/mark`, data, auth(token));
  return response.data;
};

export const unmarkReminderSent = async (
  data: { host: string; taskId: string },
  token: string,
): Promise<void> => {
  await axios.post(`${BACKEND_ENDPOINT}/reminder/unmark`, data, auth(token));
};