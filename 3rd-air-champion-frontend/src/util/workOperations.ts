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
  character: string; // the illustrated avatar the host assigned
  photo: string;
  paidAmount: number;
  payments: { amount: number; paidOn: string; note: string }[];
  host: string;
}

// One VISIT on a cleaner's rota — a day and the rooms done that day. Hours are
// claimed per visit, not per room: several rooms are cleaned in one trip and the
// business pays for the trip.
export interface WorkShift {
  date: string;
  // guests = how many people arrive in that room after the clean (the next
  // check-in, same rule as TiMag's Plan tab). null when nothing is booked yet.
  rooms: { name: string; color: string; guests?: number | null; sofaBed?: boolean }[];
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

// WHY a sign-in failed, not merely that it did.
//
// Three outcomes need three different responses and TiWork could not tell them
// apart, because unwrap() flattens everything to a string and the status code is
// lost:
//
//   401 — the server answered and refused. The saved code is genuinely dead.
//   403 — answered, code fine, but the account is ended or on leave. Nothing to
//         re-enter; the server's own sentence is the only useful thing to say.
//   anything else, or no response at all — the server was never reached. The
//         saved code is almost certainly still good.
//
// Treating the last case like the first is expensive here. Anh-Tuan changes the
// access code RARELY, so a failed sign-in is far more often a phone with no
// signal than a rotation — and TiWork installs to the home screen and precaches
// its shell, so its icon opens instantly inside a house with no bars. The app
// was discarding a working code at exactly the moment it was least likely to be
// the problem, then sending the worker to ask for a replacement that did not
// exist.
export interface WorkSignInFailure {
  message: string;
  // The server replied and said no. False means we never got an answer, which
  // is not evidence about the code at all.
  refused: boolean;
  // A refusal of the CODE specifically (401), as opposed to an account that is
  // closed or paused (403). Only this one means "ask for the new code".
  codeRejected: boolean;
}

export const workSignIn = async (creds: WorkCreds): Promise<WorkMe> => {
  try {
    const res = await axios.post(`${BACKEND_ENDPOINT}/work/signin`, creds);
    return res.data;
  } catch (err: any) {
    const status = err?.response?.status;
    // A 5xx is the server falling over, not a judgement on the credentials.
    const refused = status === 401 || status === 403;
    const failure: WorkSignInFailure = {
      message:
        err?.response?.data?.error ??
        (status
          ? "Couldn't sign you in."
          : "Can't reach TiWork right now — check your connection and try again."),
      refused,
      codeRejected: status === 401,
    };
    throw failure;
  }
};

export const fetchMyEntries = async (creds: WorkCreds): Promise<WorkEntryType[]> => {
  try {
    const res = await axios.post(`${BACKEND_ENDPOINT}/work/entries`, creds);
    return res.data;
  } catch (err) {
    throw unwrap(err, "Couldn't load your hours.");
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
    throw unwrap(err, "Couldn't load your schedule.");
  }
};

// The same shape the host's Pay tab works from, for one person.
export interface PaySummary {
  year: string;
  owed: number;
  unpaidHours: number;
  unpaidSince: string | null;
  monthLabel: string; // yyyy-MM
  days: { date: string; hours: number; earned: number }[];
  monthGross: number;
  paid: number; // all-time, the basis of the balance
  openingPaid: number; // paid before itemised records began
  payments: { id: string; amount: number; paidOn: string; note: string }[];
  hours: number; // year to date
  earned: number; // year to date
  paidThisYear: number;
}

export const fetchMyPay = async (creds: WorkCreds): Promise<PaySummary> => {
  try {
    const res = await axios.post(`${BACKEND_ENDPOINT}/work/pay-summary`, creds);
    return res.data;
  } catch (err) {
    throw unwrap(err, "Couldn't load your pay.");
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
    throw unwrap(err, "Couldn't save that.");
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
    throw unwrap(err, "Couldn't save that change.");
  }
};

export const deleteMyEntry = async (creds: WorkCreds, id: string) => {
  try {
    const res = await axios.delete(`${BACKEND_ENDPOINT}/work/entry`, {
      data: { ...creds, id },
    });
    return res.data;
  } catch (err) {
    throw unwrap(err, "Couldn't remove that.");
  }
};
