// Which AirBnB reservation a booking belongs to.
//
// The feed's description is "Reservation URL: …/details/<CODE>\nPhone Number
// (Last 4 Digits): <NNNN>". Only the code is identity — the phone line changes
// when the guest updates their number. Dejah's King night, Oct 9 2026, was
// matched on the whole text: her number changed from …2275 to …3444, the 10pm
// sync no longer recognised the night it had written at 9:34, and added the
// same stay a second time.
const CODE = /reservations\/details\/([A-Z0-9]+)/i;

export const reservationCode = (description: string | null | undefined): string => {
  const text = description ?? "";
  const m = text.match(CODE);
  // No code (a hand-entered booking, or a feed format we have not seen): fall
  // back to the whole text, which is what was matched before.
  return m ? m[1].toUpperCase() : text;
};

export const sameReservation = (a: string | null | undefined, b: string | null | undefined) =>
  reservationCode(a) === reservationCode(b);

// A Mongo condition on a booking's `description` that matches every booking
// of the same reservation, whatever its phone line says.
export const reservationMatch = (description: string) => {
  const code = reservationCode(description);
  if (code === (description ?? "")) return description;
  return { $regex: `reservations/details/${code}(?![A-Za-z0-9])`, $options: "i" };
};
