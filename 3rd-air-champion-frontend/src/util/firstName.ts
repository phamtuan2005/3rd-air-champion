// TiMag shows a guest by their FIRST name.
//
// Guests type their own name into TiBook, and some give the whole of it:
// "Irina Vaysertreyger" filled the calendar's filter header and was cut to
// "Irina Vaysertrey…", and the calendar bars are narrower still (host,
// 2026-11-22). The host knows his guests by first name. The full name stays
// on record, and the search and the guest lists still show it, because that
// is where two guests with the same first name have to be told apart.
export const firstName = (name: string | null | undefined): string => {
  const t = String(name ?? "").trim();
  return t.split(/\s+/)[0] ?? "";
};
