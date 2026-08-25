import axios from "axios";

const BACKEND_ENDPOINT = import.meta.env.VITE_BACKEND_ENDPOINT || "";

// Money a guest owes that no longer has a stay to hang off — a cancellation fee
// above all. Unbooking deletes every night of a stay, taking `bookings[].fees`
// with it, so a fee charged for cancelling could not survive on the booking that
// was being cancelled. See chargeSchema for the full reasoning.
export const CHARGE_LABELS = ["Cancellation", "Damage", "Late checkout", "Other"] as const;

export interface ChargeType {
  id: string;
  guest: { id: string; name: string; phone: string };
  label: string;
  amount: number;
  date: string; // yyyy-MM-dd — which month's money this is
  note: string;
  paid: boolean;
  // Copied from the stay at cancellation time, because the stay itself is gone.
  roomName: string;
  stayStart: string;
  stayNights: number;
}

const auth = (token: string) => ({ headers: { Authorization: `Bearer ${token}` } });

export const fetchCharges = async (
  hostId: string,
  token: string,
  range?: { start: string; end: string },
): Promise<ChargeType[]> => {
  const response = await axios.get(`${BACKEND_ENDPOINT}/charge/list`, {
    params: { hostId, ...(range ?? {}) },
    ...auth(token),
  });
  return response.data;
};

export const createCharge = async (
  data: {
    host: string;
    guest: string;
    label: string;
    amount: number;
    date: string;
    note?: string;
    paid?: boolean;
    roomName?: string;
    stayStart?: string;
    stayNights?: number;
  },
  token: string,
): Promise<ChargeType> => {
  const response = await axios.post(`${BACKEND_ENDPOINT}/charge/create`, data, auth(token));
  // CloudFront answers an unknown /api/* path with index.html and a 200, so a
  // missing route arrives looking like success ([[project-cloudfront-masks-api-errors]]).
  // Unbooking proceeds on the strength of this call, so an unchecked "success"
  // would delete the stay and drop the fee — the very thing charges exist to
  // stop. A real charge always comes back with an id.
  if (!response.data?.id) throw new Error("Charge was not saved");
  return response.data;
};

export const updateCharge = async (
  data: { id: string; label?: string; amount?: number; date?: string; note?: string; paid?: boolean },
  token: string,
): Promise<ChargeType> => {
  const response = await axios.patch(`${BACKEND_ENDPOINT}/charge/update`, data, auth(token));
  return response.data;
};

export const deleteCharge = async (id: string, token: string): Promise<void> => {
  await axios.delete(`${BACKEND_ENDPOINT}/charge/${id}`, auth(token));
};

// Charges landing in one month. Unlike a Misc expense a charge never recurs —
// it is one event, on one date.
export const isChargeInMonth = (c: ChargeType, monthKey: string): boolean =>
  c.date.slice(0, 7) === monthKey;
