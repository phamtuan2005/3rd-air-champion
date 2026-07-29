import axios from "axios";

const BACKEND_ENDPOINT = import.meta.env.VITE_BACKEND_ENDPOINT || "";

export type MiscCategory = "Supplies" | "Utilities" | "Maintenance" | "Other";

export interface MiscExpenseType {
  id: string;
  category: MiscCategory | string;
  label: string;
  amount: number;
  date: string; // yyyy-MM-dd (first occurrence for recurring)
  recurring: boolean; // repeats every month from `date`'s month
  endMonth: string; // yyyy-MM last month (inclusive) or "" = ongoing
  note: string;
}

const auth = (token: string) => ({ headers: { Authorization: `Bearer ${token}` } });

export const fetchMiscExpenses = async (
  hostId: string,
  token: string,
): Promise<MiscExpenseType[]> => {
  const response = await axios.get(`${BACKEND_ENDPOINT}/misc/list`, {
    params: { hostId },
    ...auth(token),
  });
  return response.data;
};

export const createMiscExpense = async (
  data: {
    host: string;
    category: string;
    label?: string;
    amount: number;
    date: string;
    recurring?: boolean;
    endMonth?: string;
    note?: string;
  },
  token: string,
): Promise<MiscExpenseType> => {
  const response = await axios.post(`${BACKEND_ENDPOINT}/misc/create`, data, auth(token));
  return response.data;
};

export const updateMiscExpense = async (
  data: {
    id: string;
    category?: string;
    label?: string;
    amount?: number;
    date?: string;
    recurring?: boolean;
    endMonth?: string;
    note?: string;
  },
  token: string,
): Promise<MiscExpenseType> => {
  const response = await axios.patch(`${BACKEND_ENDPOINT}/misc/update`, data, auth(token));
  return response.data;
};

export const deleteMiscExpense = async (id: string, token: string): Promise<void> => {
  await axios.delete(`${BACKEND_ENDPOINT}/misc/${id}`, auth(token));
};

// A recurring expense applies to every month from its start month through
// endMonth (inclusive), or forever when endMonth is "". One-offs apply only to
// their own month. `monthKey` is "yyyy-MM". String comparison is safe on
// zero-padded yyyy-MM keys.
export const isExpenseInMonth = (e: MiscExpenseType, monthKey: string): boolean => {
  const startMonth = e.date.slice(0, 7);
  if (!e.recurring) return startMonth === monthKey;
  if (monthKey < startMonth) return false;
  if (e.endMonth && monthKey > e.endMonth) return false;
  return true;
};
