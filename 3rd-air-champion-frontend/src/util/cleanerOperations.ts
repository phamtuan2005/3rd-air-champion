import axios from "axios";

const BACKEND_ENDPOINT = import.meta.env.VITE_BACKEND_ENDPOINT || "";

export interface RateChange {
  rate: number;
  effectiveFrom: string; // yyyy-MM-dd
}

export interface CleanerType {
  id: string;
  name: string;
  phone: string;
  payRate: number; // $/hour — BASE rate (before any scheduled change)
  rateHistory?: RateChange[]; // scheduled raises; rate on a date resolved by rateOn
  photo?: string; // explicit image (owner jpg / data URL); overrides the generated avatar
  character?: string; // free-text note the illustrated avatar is generated from
  availableDays?: number[]; // weekdays they can work (0=Sun…6=Sat); empty = infer from history
  paused?: boolean; // temporarily out (vacation/leave) — skipped by the auto-planner
  priority?: number; // favorability 1–5 (3 = normal); auto-planner prefers higher
  isOwner?: boolean; // the host themselves — auto-plan uses them only as last resort
  minRooms?: number; // fewest rooms worth a trip (won't come for fewer); default 1
  maxRooms?: number; // most rooms they'll take in a day; 0 = no cap (planner derives)
  baselineHours: number; // pre-tracking hours counted toward baselineMonth only
  baselineMonth: string; // "yyyy-MM"
  accessCode?: string; // TiWork sign-in secret; "" = they cannot sign in yet
  paidAmount?: number; // running total paid out
}

export interface CleaningAssignmentType {
  id: string;
  date: string; // yyyy-MM-dd cleaning morning
  room: { id: string; name: string } | null;
  cleaner: CleanerType | null;
  hours: number | null; // recorded after the cleaning; pay = hours × payRate
}

const auth = (token: string) => ({ headers: { Authorization: `Bearer ${token}` } });

// The hourly rate in effect for a cleaner ON a given date (yyyy-MM-dd). Dates
// before any scheduled change use the base payRate; each rateHistory entry takes
// effect on its effectiveFrom. So a cleaning is billed at its historical rate —
// a raise never re-prices past work. Pass today's date to get the current rate.
export const rateOn = (
  cleaner: { payRate: number; rateHistory?: RateChange[] },
  dateStr: string,
): number => {
  let rate = cleaner.payRate ?? 0;
  const hist = [...(cleaner.rateHistory ?? [])].sort((a, b) =>
    a.effectiveFrom < b.effectiveFrom ? -1 : 1,
  );
  for (const h of hist) {
    if (h.effectiveFrom <= dateStr) rate = h.rate;
    else break;
  }
  return rate;
};

export const fetchCleaners = async (hostId: string, token: string): Promise<CleanerType[]> => {
  const response = await axios.get(`${BACKEND_ENDPOINT}/cleaner/list`, {
    params: { hostId },
    ...auth(token),
  });
  return response.data;
};

export const createCleaner = async (
  data: { host: string; name: string; phone: string; payRate: number; rateHistory?: RateChange[]; photo?: string; character?: string; availableDays?: number[]; priority?: number; isOwner?: boolean; minRooms?: number; maxRooms?: number },
  token: string,
): Promise<CleanerType> => {
  const response = await axios.post(`${BACKEND_ENDPOINT}/cleaner/create`, data, auth(token));
  return response.data;
};

export const updateCleaner = async (
  data: {
    id: string;
    name?: string;
    phone?: string;
    payRate?: number;
    rateHistory?: RateChange[];
    photo?: string;
    character?: string;
    availableDays?: number[];
    paused?: boolean;
    priority?: number;
    isOwner?: boolean;
    minRooms?: number;
    maxRooms?: number;
    baselineHours?: number;
    baselineMonth?: string;
    accessCode?: string;
  },
  token: string,
): Promise<CleanerType> => {
  const response = await axios.patch(`${BACKEND_ENDPOINT}/cleaner/update`, data, auth(token));
  return response.data;
};

export const deleteCleaner = async (id: string, token: string): Promise<void> => {
  await axios.delete(`${BACKEND_ENDPOINT}/cleaner/${id}`, auth(token));
};

export interface CleanerSummaryType {
  id: string;
  name: string;
  hours: number; // all-time recorded + baseline
  earned: number; // hours × rate
  paid: number; // running payouts
  balance: number; // earned − WAGES paid: what the host owes right now
  // Tips, kept apart from wages. They are real money out, but they settle
  // nothing — see the note in the backend's cleanerPay.
  tips?: number;
  wagesPaid?: number;
  // Work not yet covered by payments — what the host and cleaner actually
  // discuss. Lifetime totals answer a question nobody asked.
  unpaidHours?: number;
  unpaidSince?: string | null; // yyyy-MM-dd of the first unpaid day
  // Itemised payouts, newest first, so a duplicate is visible and removable.
  payments?: { id: string; amount: number; paidOn: string; note: string; tip?: boolean }[];
  // Paid before logging existed — one opening figure, not individually undoable.
  openingPaid?: number;
}

export const fetchCleanerSummary = async (
  hostId: string,
  token: string,
): Promise<CleanerSummaryType[]> => {
  const response = await axios.get(`${BACKEND_ENDPOINT}/cleaner/summary`, {
    params: { hostId },
    ...auth(token),
  });
  return response.data;
};

export const recordCleanerPayment = async (
  id: string,
  amount: number,
  token: string,
  paidOn?: string, // host's LOCAL date — the server runs UTC and would misdate an evening payout
  // A tip is money on TOP of wages. Sent as an ordinary payment it settles the
  // balance, so tipping somebody quietly reduces their next wage packet.
  tip?: boolean,
): Promise<void> => {
  await axios.post(`${BACKEND_ENDPOINT}/cleaner/pay`, { id, amount, paidOn, tip }, auth(token));
};

// Undo one logged payout rather than posting an offsetting negative, which
// would leave both the mistake and the correction in the history.
export const removeCleanerPayment = async (
  id: string,
  paymentId: string,
  token: string,
): Promise<void> => {
  await axios.post(`${BACKEND_ENDPOINT}/cleaner/pay/remove`, { id, paymentId }, auth(token));
};

export interface SentScheduleType {
  cleaner: string; // cleaner id
  weekMonday: string; // yyyy-MM-dd
  signature: string;
  sentAt: string;
}

// The schedule last texted to each cleaner per week (shared across host + cohosts).
export const fetchSentSchedules = async (
  hostId: string,
  token: string,
): Promise<SentScheduleType[]> => {
  const response = await axios.get(`${BACKEND_ENDPOINT}/cleaner/schedule-sent`, {
    params: { hostId },
    ...auth(token),
  });
  return response.data;
};

// Record what was just texted (upsert per cleaner + week).
export const recordScheduleSent = async (
  data: { host: string; cleaner: string; weekMonday: string; signature: string },
  token: string,
): Promise<SentScheduleType> => {
  const response = await axios.post(`${BACKEND_ENDPOINT}/cleaner/schedule-sent`, data, auth(token));
  return response.data;
};

export const fetchAssignments = async (
  hostId: string,
  start: string,
  end: string,
  token: string,
): Promise<CleaningAssignmentType[]> => {
  const response = await axios.get(`${BACKEND_ENDPOINT}/cleaner/assignments`, {
    params: { hostId, start, end },
    ...auth(token),
  });
  return response.data;
};

export const assignCleaner = async (
  data: { host: string; date: string; room: string; cleaner: string },
  token: string,
): Promise<CleaningAssignmentType> => {
  const response = await axios.post(`${BACKEND_ENDPOINT}/cleaner/assign`, data, auth(token));
  return response.data;
};

// Draft a cleaner for each unassigned room from history (frequency + recency +
// weekday, workload-balanced). Returns the assignments it created.
export const autoPlanCleanings = async (
  data: { host: string; targets: { date: string; room: string; critical?: boolean }[] },
  token: string,
): Promise<CleaningAssignmentType[]> => {
  const response = await axios.post(`${BACKEND_ENDPOINT}/cleaner/autoplan`, data, auth(token));
  return response.data;
};

export const unassignCleaner = async (
  data: { host: string; date: string; room: string },
  token: string,
): Promise<void> => {
  await axios.post(`${BACKEND_ENDPOINT}/cleaner/unassign`, data, auth(token));
};

export const updateAssignmentHours = async (
  id: string,
  hours: number | null, // null clears the recording back to unrecorded/pending
  token: string,
): Promise<CleaningAssignmentType> => {
  const response = await axios.patch(`${BACKEND_ENDPOINT}/cleaner/hours`, { id, hours }, auth(token));
  return response.data;
};
