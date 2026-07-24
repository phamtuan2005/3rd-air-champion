// Normalize any entered phone form — "4085551234", "408-555-1234",
// "(408) 555 1234", "+1 408 555 1234" — to one consistent display format.
// Falls back to the raw string for anything that isn't a US 10/11-digit number.
export const formatPhone = (raw: string): string => {
  const digits = (raw ?? "").replace(/\D/g, "");
  if (digits.length === 10)
    return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`;
  if (digits.length === 11 && digits[0] === "1")
    return `+1 (${digits.slice(1, 4)}) ${digits.slice(4, 7)}-${digits.slice(7)}`;
  return raw;
};
