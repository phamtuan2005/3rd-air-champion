// TiBook as one guest sees it, opened by the host from TiMag's TT box.
//
// The guest goes in the address's #hash, not its ?query. A hash never leaves
// the browser: it is not sent to the server, not written to a CDN log, and not
// passed on as a Referer. It is still a guest's phone in an address bar, so
// TiBook takes it off the moment it has read it.

export interface HostView {
  phone: string;
  name: string;
}

/** Where TiMag sends the host to see TiBook as this guest. */
export const tibookHostViewHref = (phone: string, name: string): string => {
  const params = new URLSearchParams({ as: phone.replace(/\D/g, "") });
  if (name.trim()) params.set("name", name.trim());
  return `/book#${params.toString()}`;
};

/**
 * The guest a TiBook address asks to be seen as, or null.
 *
 * Null unless TiMag is signed in on this browser. This is not a lock: a phone
 * number on its own already opens a guest's bookings in TiBook (Your bookings
 * asks for nothing else). What it stops is a link that opens somebody else's
 * stays doing so for whoever it was forwarded to — on a guest's phone it is
 * plain TiBook.
 */
export const readHostView = (hash: string, signedInToTiMag: boolean): HostView | null => {
  if (!signedInToTiMag) return null;
  const params = new URLSearchParams(hash.replace(/^#/, ""));
  const phone = (params.get("as") ?? "").replace(/\D/g, "");
  // The fewest digits any lookup in TiBook accepts as a phone.
  if (phone.length < 7) return null;
  return { phone, name: (params.get("name") ?? "").trim() };
};
