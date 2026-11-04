import { guestSignoff } from "./cleanerMessage";

/*
 * The text a NEW guest is sent from TiMag right after the host adds them: a
 * welcome, the nightly rate agreed for each room, and where to book (host,
 * 2026-11-03: "a button to text them welcome message together with the room
 * rate set for them"). The rates were set on the way in so the first booking is
 * priced right; saying them to the guest in the same breath means the two
 * sides start from the same numbers.
 *
 * Rooms in the order given (the form's order), and only rooms with a rate. A
 * $0 rate is a deliberate comp — family — and is said as one, never as "$0".
 */
export const welcomeMessage = ({
  guestName,
  rates,
  bookUrl,
  sender,
}: {
  guestName: string;
  rates: { room: string; price: number }[];
  bookUrl: string;
  sender?: string;
}) => {
  const first = guestName.trim().split(/\s+/)[0] || "there";
  // The host's own words (2026-11-03). A guest is added to the list once they
  // are coming back, so the welcome greets them as a returning guest.
  const lines = [`Hi ${first}, welcome to TT House! I am so glad to have you as a loyal returning guest.`];
  if (rates.length > 0) {
    lines.push(
      "",
      `Your nightly ${rates.length === 1 ? "rate" : "rates"}:`,
      ...rates.map(({ room, price }) => `* ${room}: ${price > 0 ? `$${price}` : "on the house"}`),
    );
  }
  // Named as TiBook, the way the house calls it (host, 2026-11-03: "should be
  // 'at TiBook'"); the link sits on its own line under it, since a text
  // cannot make a word tappable and the guest still needs a way in.
  lines.push("", `You can see open nights and request a stay any time at TiBook:`, bookUrl, "", guestSignoff(sender));
  return lines.join("\n");
};
