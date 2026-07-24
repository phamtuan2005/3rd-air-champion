import axios from "axios";

const BACKEND_ENDPOINT = import.meta.env.VITE_BACKEND_ENDPOINT || "";

export interface CleanerType {
  id: string;
  name: string;
  phone: string;
  payRate: number; // $/hour
  photo?: string; // explicit image (owner jpg / data URL); overrides the generated avatar
  character?: string; // free-text note the illustrated avatar is generated from
  availableDays?: number[]; // weekdays they can work (0=Sun…6=Sat); empty = infer from history
  paused?: boolean; // temporarily out (vacation/leave) — skipped by the auto-planner
  baselineHours: number; // pre-tracking hours counted toward baselineMonth only
  baselineMonth: string; // "yyyy-MM"
}

export interface CleaningAssignmentType {
  id: string;
  date: string; // yyyy-MM-dd cleaning morning
  room: { id: string; name: string } | null;
  cleaner: CleanerType | null;
  hours: number | null; // recorded after the cleaning; pay = hours × payRate
}

const auth = (token: string) => ({ headers: { Authorization: `Bearer ${token}` } });

export const fetchCleaners = async (hostId: string, token: string): Promise<CleanerType[]> => {
  const response = await axios.get(`${BACKEND_ENDPOINT}/cleaner/list`, {
    params: { hostId },
    ...auth(token),
  });
  return response.data;
};

export const createCleaner = async (
  data: { host: string; name: string; phone: string; payRate: number; photo?: string; character?: string; availableDays?: number[] },
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
    photo?: string;
    character?: string;
    availableDays?: number[];
    paused?: boolean;
    baselineHours?: number;
    baselineMonth?: string;
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
  balance: number; // earned − paid: what the host owes right now
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
): Promise<void> => {
  await axios.post(`${BACKEND_ENDPOINT}/cleaner/pay`, { id, amount }, auth(token));
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
  data: { host: string; targets: { date: string; room: string }[] },
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
