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

// What gets SENT to the backend. Formatting goes, but a typed "+" stays: it is
// the only thing that says this number is not American, and stripping it turned
// a German +49 into a 13-digit US number the server then refused. The backend
// re-formats from here, so this only has to preserve the country code.
export const toStoredPhone = (raw: string): string => {
  const trimmed = (raw ?? "").trim();
  const digits = trimmed.replace(/\D/g, "");
  return trimmed.startsWith("+") ? `+${digits}` : digits;
};
