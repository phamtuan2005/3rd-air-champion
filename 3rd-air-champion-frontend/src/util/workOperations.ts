import axios from "axios";

const BACKEND_ENDPOINT = import.meta.env.VITE_BACKEND_ENDPOINT || "";

export type WorkStatus = "submitted" | "approved" | "rejected";

export interface WorkMe {
  id: string;
  name: string;
  title: string;
  hiredOn: string;
  payType: "hourly" | "biweekly";
  payRate: number;
  host: string;
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

export const addMyEntry = async (
  creds: WorkCreds,
  entry: { date: string; hours: number; report: string },
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
