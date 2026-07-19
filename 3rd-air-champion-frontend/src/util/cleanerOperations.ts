import axios from "axios";

const BACKEND_ENDPOINT = import.meta.env.VITE_BACKEND_ENDPOINT || "";

export interface CleanerType {
  id: string;
  name: string;
  phone: string;
  payRate: number; // $/hour
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
  data: { host: string; name: string; phone: string; payRate: number },
  token: string,
): Promise<CleanerType> => {
  const response = await axios.post(`${BACKEND_ENDPOINT}/cleaner/create`, data, auth(token));
  return response.data;
};

export const updateCleaner = async (
  data: { id: string; name?: string; phone?: string; payRate?: number },
  token: string,
): Promise<CleanerType> => {
  const response = await axios.patch(`${BACKEND_ENDPOINT}/cleaner/update`, data, auth(token));
  return response.data;
};

export const deleteCleaner = async (id: string, token: string): Promise<void> => {
  await axios.delete(`${BACKEND_ENDPOINT}/cleaner/${id}`, auth(token));
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

export const unassignCleaner = async (
  data: { host: string; date: string; room: string },
  token: string,
): Promise<void> => {
  await axios.post(`${BACKEND_ENDPOINT}/cleaner/unassign`, data, auth(token));
};

export const updateAssignmentHours = async (
  id: string,
  hours: number,
  token: string,
): Promise<CleaningAssignmentType> => {
  const response = await axios.patch(`${BACKEND_ENDPOINT}/cleaner/hours`, { id, hours }, auth(token));
  return response.data;
};
