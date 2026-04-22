import { addDays } from "date-fns";
import { toZonedTime } from "date-fns-tz";

export const parseLocalDate = (isoString: string): Date => {
  const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone;
  return toZonedTime(isoString.split("T")[0], timeZone);
};

export const buildDateRange = (start: Date, duration: number): Date[] => {
  return Array.from({ length: duration }, (_, i) => addDays(start, i));
};