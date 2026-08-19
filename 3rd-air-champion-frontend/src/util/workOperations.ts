import axios from "axios";

const BACKEND_ENDPOINT = import.meta.env.VITE_BACKEND_ENDPOINT || "";

export type WorkStatus = "submitted" | "approved" | "rejected";

export interface WorkMe {
  id: string;
  // Which kind of worker signed in. Cleaners get a schedule; office staff log
  // free-standing days. Everything else about the screen is the same.
  kind: "staff" | "cleaner";
  name: string;
  title: string;
  hiredOn: string;
  payType: "hourly" | "biweekly";
  payRate: number;
  paidAmount: number;
  payments: { amount: number; paidOn: string; note: string }[];
  host: string;
}

// One VISIT on a cleaner's rota — a day and the rooms done that day. Hours are
// claimed per visit, not per room: several rooms are cleaned in one trip and the
// business pays for the trip.
export interface WorkShift {
  date: string;
  rooms: { name: string; color: string }[];
  recordedHours: number | null;
  claim: {
    id: string;
    hours: number;
    status: WorkStatus;
    report: string;
    hostNote: string;
  } | null;
}

export interface WorkEntryType {
  id: string;
  date: string; // yyyy-MM-dd
  hours: number;
  report: string;
  status: WorkStatus;
  approvedRate: number;
  approvedOn: string;
  hostNote: string;
}

// Credentials travel with every call. TiWork has no session: staff have no TiMag
// login, so identity is proved per request rather than assumed — the same reason
// the routes sit outside the JWT gate.
export interface WorkCreds {
  identifier: string; // email or phone, whichever they have
  code: string;
}

const unwrap = (err: any, fallback: string) =>
  err?.response?.data?.error ?? fallback;

export const workSignIn = async (creds: WorkCreds): Promise<WorkMe> => {
  try {
    const res = await axios.post(`${BACKEND_ENDPOINT}/work/signin`, creds);
    return res.data;
  } catch (err) {
    throw unwrap(err, "Could not sign in.");
  }
};

export const fetchMyEntries = async (creds: WorkCreds): Promise<WorkEntryType[]> => {
  try {
    const res = await axios.post(`${BACKEND_ENDPOINT}/work/entries`, creds);
    return res.data;
  } catch (err) {
    throw unwrap(err, "Could not load your hours.");
  }
};

export const fetchMySchedule = async (
  creds: WorkCreds,
  range: { from: string; to: string },
): Promise<WorkShift[]> => {
  try {
    const res = await axios.post(`${BACKEND_ENDPOINT}/work/schedule`, { ...creds, ...range });
    return res.data;
  } catch (err) {
    throw unwrap(err, "Could not load your schedule.");
  }
};

export interface PaySummary {
  hours: number;
  earned: number;
  paid: number;
  owed: number;
}

export const fetchMyPay = async (creds: WorkCreds): Promise<PaySummary> => {
  try {
    const res = await axios.post(`${BACKEND_ENDPOINT}/work/pay-summary`, creds);
    return res.data;
  } catch (err) {
    throw unwrap(err, "Could not load your pay.");
  }
};

export const addMyEntry = async (
  creds: WorkCreds,
  entry: { date: string; hours: number; report: string; rooms?: string[] },
): Promise<WorkEntryType> => {
  try {
    const res = await axios.post(`${BACKEND_ENDPOINT}/work/entry`, { ...creds, ...entry });
    return res.data;
  } catch (err) {
    throw unwrap(err, "Could not save that.");
  }
};

export const editMyEntry = async (
  creds: WorkCreds,
  entry: { id: string; date?: string; hours?: number; report?: string },
): Promise<WorkEntryType> => {
  try {
    const res = await axios.patch(`${BACKEND_ENDPOINT}/work/entry`, { ...creds, ...entry });
    return res.data;
  } catch (err) {
    throw unwrap(err, "Could not save that change.");
  }
};

export const deleteMyEntry = async (creds: WorkCreds, id: string) => {
  try {
    const res = await axios.delete(`${BACKEND_ENDPOINT}/work/entry`, {
      data: { ...creds, id },
    });
    return res.data;
  } catch (err) {
    throw unwrap(err, "Could not remove that.");
  }
};
