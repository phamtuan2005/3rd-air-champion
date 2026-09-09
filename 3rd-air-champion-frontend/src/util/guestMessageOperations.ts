import axios from "axios";
const BACKEND_ENDPOINT = import.meta.env.VITE_BACKEND_ENDPOINT || "";

export interface GuestMessage {
  id: string;
  guestName: string;
  guestPhone: string;
  sender: "guest" | "host";
  body: string;
  readByHost?: boolean;
  readByGuest?: boolean;
  createdAt: string;
}

export interface GuestMessageThread {
  guestName: string;
  guestPhone: string;
  lastBody: string;
  lastSender: "guest" | "host";
  lastAt: string;
  unreadForHost: number;
  total: number;
}

// Timestamps arrive from this GraphQL layer as epoch milliseconds in a String
// ("1788973785273"), not as ISO — the schema types createdAt as String! and a
// Mongoose Date serializes that way. parseISO on that returns Invalid Date and
// the message silently shows no time at all, so every reader goes through here.
// The ISO branch is kept because the REST shape is not guaranteed to stay ms,
// and BookingRequestManagerModal already hedges the same way.
export const messageDate = (ts: string): Date => {
  const ms = Number(ts);
  return Number.isNaN(ms) ? new Date(ts) : new Date(ms);
};

/* ---- Guest side (TiBook). No token: a guest has no login. ---- */

export const sendGuestMessage = async (message: {
  host: string;
  guestName: string;
  guestPhone: string;
  body: string;
}): Promise<GuestMessage> => {
  const response = await axios.post(`${BACKEND_ENDPOINT}/message/send`, message);
  return response.data;
};

export const fetchGuestThread = async (
  hostId: string,
  phone: string,
): Promise<GuestMessage[]> => {
  const response = await axios.post(`${BACKEND_ENDPOINT}/message/thread`, {
    hostId,
    phone,
  });
  return response.data;
};

export const markGuestThreadRead = async (hostId: string, phone: string) => {
  const response = await axios.post(`${BACKEND_ENDPOINT}/message/read`, {
    hostId,
    phone,
  });
  return response.data;
};

export interface TypingState {
  guestTyping: boolean;
  hostTyping: boolean;
}

// Says whether the guest is typing and answers with what BOTH sides are doing.
// One call rather than a ping plus a poll: this runs every couple of seconds
// while the sheet is open, and the answer wanted is always "is he writing back".
export const pingGuestTyping = async (
  host: string,
  guestPhone: string,
  typing: boolean,
): Promise<TypingState> => {
  const response = await axios.post(`${BACKEND_ENDPOINT}/message/typing`, {
    host,
    guestPhone,
    typing,
  });
  return response.data;
};

/* ---- Host side (TiMag). Behind the JWT gate. ---- */

export const fetchHostThreads = async (
  hostId: string,
  token: string,
): Promise<GuestMessageThread[]> => {
  const response = await axios.post(
    `${BACKEND_ENDPOINT}/inbox/threads`,
    { hostId },
    { headers: { Authorization: `Bearer ${token}` } },
  );
  return response.data;
};

export const fetchHostThread = async (
  hostId: string,
  phone: string,
  token: string,
): Promise<GuestMessage[]> => {
  const response = await axios.post(
    `${BACKEND_ENDPOINT}/inbox/thread`,
    { hostId, phone },
    { headers: { Authorization: `Bearer ${token}` } },
  );
  return response.data;
};

export const replyToGuest = async (
  reply: { host: string; guestName: string; guestPhone: string; body: string },
  token: string,
): Promise<GuestMessage> => {
  const response = await axios.post(`${BACKEND_ENDPOINT}/inbox/reply`, reply, {
    headers: { Authorization: `Bearer ${token}` },
  });
  return response.data;
};

// The host half of the same ping. Same one-round-trip shape as the guest's.
export const pingHostTyping = async (
  host: string,
  guestPhone: string,
  typing: boolean,
  token: string,
): Promise<TypingState> => {
  const response = await axios.post(
    `${BACKEND_ENDPOINT}/inbox/typing`,
    { host, guestPhone, typing },
    { headers: { Authorization: `Bearer ${token}` } },
  );
  return response.data;
};

// Host only. There is no guest-side counterpart: the guest half of this API is
// public, so a delete reachable from it would let anyone wipe the questions the
// host has not answered yet.
export const deleteHostThread = async (
  hostId: string,
  phone: string,
  token: string,
): Promise<{ deleted: number }> => {
  const response = await axios.post(
    `${BACKEND_ENDPOINT}/inbox/thread/delete`,
    { hostId, phone },
    { headers: { Authorization: `Bearer ${token}` } },
  );
  return response.data;
};

export const markHostThreadRead = async (
  hostId: string,
  phone: string,
  token: string,
) => {
  const response = await axios.post(
    `${BACKEND_ENDPOINT}/inbox/read`,
    { hostId, phone },
    { headers: { Authorization: `Bearer ${token}` } },
  );
  return response.data;
};
