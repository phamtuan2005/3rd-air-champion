import axios from "axios";

const BACKEND_ENDPOINT = import.meta.env.VITE_BACKEND_ENDPOINT || "";

export type PayType = "hourly" | "biweekly";

export interface StaffReviewType {
  id: string;
  date: string; // yyyy-MM-dd
  rating: number; // 1–5
  note: string;
}

export interface StaffPaymentType {
  id: string;
  amount: number;
  paidOn: string; // yyyy-MM-dd
  note: string;
}

export interface StaffType {
  id: string;
  name: string;
  title: string;
  phone: string;
  email: string;
  character: string;
  hiredOn: string; // yyyy-MM-dd
  endedOn: string; // "" while still with us
  payType: PayType;
  accessCode: string; // TiWork sign-in secret; "" = they cannot sign in yet
  payRate: number; // per hour, or per two-week period
  rateHistory: { rate: number; effectiveFrom: string }[];
  reviews: StaffReviewType[];
  paidAmount: number;
  payments: StaffPaymentType[];
  note: string;
}

const auth = (token: string) => ({ headers: { Authorization: `Bearer ${token}` } });

export const fetchStaff = async (hostId: string, token: string): Promise<StaffType[]> => {
  const response = await axios.get(`${BACKEND_ENDPOINT}/staff/list`, {
    params: { hostId },
    ...auth(token),
  });
  return response.data;
};

export const createStaff = async (
  data: {
    host: string;
    name: string;
    title?: string;
    phone?: string;
    email?: string;
    character?: string;
    hiredOn: string;
    payType?: PayType;
    payRate?: number;
    note?: string;
  },
  token: string,
): Promise<StaffType> => {
  const response = await axios.post(`${BACKEND_ENDPOINT}/staff/create`, data, auth(token));
  return response.data;
};

export const updateStaff = async (
  data: {
    id: string;
    name?: string;
    title?: string;
    phone?: string;
    email?: string;
    character?: string;
    hiredOn?: string;
    endedOn?: string;
    payType?: PayType;
    payRate?: number;
    rateHistory?: { rate: number; effectiveFrom: string }[];
    accessCode?: string;
    note?: string;
  },
  token: string,
): Promise<StaffType> => {
  const response = await axios.patch(`${BACKEND_ENDPOINT}/staff/update`, data, auth(token));
  return response.data;
};

export const addStaffReview = async (
  data: { id: string; date: string; rating: number; note?: string },
  token: string,
): Promise<StaffType> => {
  const response = await axios.post(`${BACKEND_ENDPOINT}/staff/review`, data, auth(token));
  return response.data;
};

export const deleteStaffReview = async (
  data: { id: string; reviewId: string },
  token: string,
): Promise<StaffType> => {
  const response = await axios.delete(`${BACKEND_ENDPOINT}/staff/review`, {
    data,
    ...auth(token),
  });
  return response.data;
};

export const payStaff = async (
  data: { id: string; amount: number; paidOn: string; note?: string },
  token: string,
): Promise<StaffType> => {
  const response = await axios.post(`${BACKEND_ENDPOINT}/staff/pay`, data, auth(token));
  return response.data;
};

export const deleteStaff = async (id: string, token: string) => {
  const response = await axios.delete(`${BACKEND_ENDPOINT}/staff/${id}`, auth(token));
  return response.data;
};

// The rate in effect on a date — a raise must never re-price work already done.
// Same rule and shape as the cleaners' rateOn.
export const rateOn = (staff: StaffType, dateKey: string): number => {
  const history = [...(staff.rateHistory ?? [])]
    .filter((r) => r.effectiveFrom <= dateKey)
    .sort((a, b) => a.effectiveFrom.localeCompare(b.effectiveFrom));
  return history.length > 0 ? history[history.length - 1].rate : (staff.payRate ?? 0);
};

// What a biweekly staffer costs per month, on average.
//
// Biweekly is NOT twice-monthly: 26 periods a year, not 24, so a month costs
// rate × 26 / 12. Treating it as two payments a month understates the year by a
// fortnight — the classic payroll off-by-two-weeks.
export const MONTHLY_FROM_BIWEEKLY = 26 / 12;

// Monthly run-rate for the whole team, for the operating-cost picture.
//
// Hourly staff are deliberately EXCLUDED and reported separately: their cost is
// rate × hours, and hours arrive from TiWork, which does not exist yet. Folding
// them in at zero would report a payroll that is quietly too small, which is
// worse than reporting it as not yet known.
export const monthlyRunRate = (staff: StaffType[], todayKey: string) => {
  let biweeklyMonthly = 0;
  const hourly: StaffType[] = [];
  for (const s of staff) {
    if (s.endedOn && s.endedOn < todayKey) continue; // already left
    if (s.hiredOn > todayKey) continue; // not started
    if (s.payType === "biweekly") biweeklyMonthly += rateOn(s, todayKey) * MONTHLY_FROM_BIWEEKLY;
    else hourly.push(s);
  }
  return { biweeklyMonthly, hourly };
};

// ── Work entries, host side ────────────────────────────────────────────────

export interface HostWorkEntry {
  id: string;
  staffId: string;
  staffName: string;
  staffTitle: string;
  date: string;
  hours: number;
  report: string;
  status: "submitted" | "approved" | "rejected";
  approvedRate: number;
  approvedOn: string;
  hostNote: string;
}

export const fetchWorkEntries = async (
  hostId: string,
  token: string,
  status?: "submitted" | "approved" | "rejected",
): Promise<HostWorkEntry[]> => {
  const res = await axios.get(`${BACKEND_ENDPOINT}/staff/hours`, {
    params: { hostId, ...(status ? { status } : {}) },
    ...auth(token),
  });
  return res.data;
};

export const reviewWorkEntry = async (
  data: {
    id: string;
    status: "approved" | "rejected" | "submitted";
    hostNote?: string;
    reviewedOn?: string;
  },
  token: string,
) => {
  const res = await axios.patch(`${BACKEND_ENDPOINT}/staff/hours/review`, data, auth(token));
  return res.data;
};

// What approved hours have earned, at the rate frozen when each was approved.
// Only approved entries count: a submitted one is a claim, and a rejected one
// was seen and declined.
export const approvedEarnings = (entries: HostWorkEntry[]) =>
  entries
    .filter((e) => e.status === "approved")
    .reduce((sum, e) => sum + e.hours * (e.approvedRate || 0), 0);
