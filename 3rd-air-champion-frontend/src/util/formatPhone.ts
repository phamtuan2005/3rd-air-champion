// "+1 408 306 2219" is "408 306 2219" (host, 2026-10-20). Every phone box in
// TiMag, TiBook and TiWork drops a typed +1 the moment the number after it is
// complete, so the +1 never reaches the server — where every lookup compares
// digits, and "14083062219" made a returning guest a stranger. The server drops
// it too (backend util/usPhone.ts, the same rule), for anything sent another way.
//
// Only a typed "+1". A bare "1408…" is left alone: eleven digits starting with
// 1 is also a Chinese mobile typed without its +86. Every other country code
// is kept as typed.
export const dropUsCountryCode = (raw: string): string => {
  const text = raw ?? "";
  const m = text.match(/^\s*\+\s*1[\s.-]*(.*)$/s);
  if (!m) return text;
  // Only once ten digits follow — "+1 408" mid-typing stays as it is.
  return m[1].replace(/\D/g, "").length === 10 ? m[1].trim() : text;
};

// For a phone box: hands the field's own onChange the number without its +1.
// Works for a react-hook-form register() spread and a plain handler alike.
export const withUsCodeDropped = <E extends { target: { value: string } }>(onChange: (e: E) => unknown) =>
  (e: E) => {
    const v = dropUsCountryCode(e.target.value);
    if (v !== e.target.value) e.target.value = v;
    return onChange(e);
  };

// Normalize any entered phone form — "4085551234", "408-555-1234",
// "(408) 555 1234", "+1 408 555 1234" — to one consistent display format.
// Falls back to the raw string for anything that isn't a US 10/11-digit number.
export const formatPhone = (raw: string): string => {
  const digits = (raw ?? "").replace(/\D/g, "");
  if (digits.length === 10)
    return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`;
  // A typed +1 is shown without it, as it is stored (dropUsCountryCode). A
  // bare eleven digits keeps its old look: it may not be American at all.
  if (digits.length === 11 && digits[0] === "1" && (raw ?? "").trim().startsWith("+"))
    return `(${digits.slice(1, 4)}) ${digits.slice(4, 7)}-${digits.slice(7)}`;
  if (digits.length === 11 && digits[0] === "1")
    return `+1 (${digits.slice(1, 4)}) ${digits.slice(4, 7)}-${digits.slice(7)}`;
  return raw;
};

// What gets SENT to the backend. Formatting goes, but a typed "+" stays: it is
// the only thing that says this number is not American, and stripping it turned
// a German +49 into a 13-digit US number the server then refused. The backend
// re-formats from here, so this only has to preserve the country code.
export const toStoredPhone = (raw: string): string => {
  const trimmed = dropUsCountryCode(raw ?? "").trim();
  const digits = trimmed.replace(/\D/g, "");
  return trimmed.startsWith("+") ? `+${digits}` : digits;
};
