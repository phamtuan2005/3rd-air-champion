import { format, parseISO } from "date-fns";

export const formatDate = (dateString: string) => {
  const date = parseISO(dateString);
  return format(date, "MMM d, yyyy");
};

export const formatDateToMonthYear = (dateString: string) => {
  const date = parseISO(dateString);
  return format(date, "MMM yyyy");
};