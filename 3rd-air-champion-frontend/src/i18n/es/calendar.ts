// Spanish for TiBook's calendar screens — see index.ts.
// Neutral Latin American Spanish, "tú", the way Airbnb writes to its guests.
export const calendar: Record<string, string> = {
  // The bar over the calendar
  Today: "Hoy",
  Month: "Mes",
  List: "Lista",
  "Show the calendar as": "Ver el calendario como",
  "Show the calendar as a month": "Ver el calendario por mes",
  "Show the calendar as a list of days": "Ver el calendario como lista de días",
  "Request a Booking": "Solicitar una reserva",
  "All rooms": "Todas las habitaciones",

  // Weekday header. The three-letter keys are the wider form. The narrow
  // header on a phone is NOT the first letter here: Martes and Miércoles both
  // start with M, so the code picks those letters itself (D L M X J V S).
  // The full names are lowercase, as Spanish writes them mid-sentence ("tu
  // estadía del martes y miércoles"), and they are mostly read mid-sentence.
  Sunday: "domingo",
  Monday: "lunes",
  Tuesday: "martes",
  Wednesday: "miércoles",
  Thursday: "jueves",
  Friday: "viernes",
  Saturday: "sábado",
  Sun: "Dom",
  Mon: "Lun",
  Tue: "Mar",
  Wed: "Mié",
  Thu: "Jue",
  Fri: "Vie",
  Sat: "Sáb",

  // A month tile. Held to the English widths by its words (SOLD_OUT_EMS and
  // LEFT_EMS in GuestCalendar), measured in Chromium at the tile's weight:
  // "completo" is the hotel word for sold out, but at ~4.3em against the
  // English 3.71 it runs out of a phone's tile, and "agotado" (3.8) still
  // does; "lleno" is 2.2. Likewise "quedan 3" is ~4.3em against "3 left" at
  // 2.35, so the tile says "hay 3" (2.44). The day list, which has room,
  // still says "Completo".
  "{n} left": "hay {n}",
  "sold out": "lleno",
  "Add to wish list": "Agregar a la lista de deseos",
  "Remove from wish list": "Quitar de la lista de deseos",

  // The day-by-day list
  // "Libres: 1", not "{count} libres": the count can be 1, and the adjective
  // would have to agree with it.
  "{count} free": "Libres: {count}",
  Free: "Libre",
  "no charge": "sin costo",
  "family, no charge": "familia, sin costo",
  "a night, your price": "por noche, tu precio",
  "Sold out": "Completo",
  "Sold out · on your wish list": "Completo · en tu lista de deseos",
  // U+2011 in the English key, as on screen.
  "Sold out · tap to wish‑list": "Completo · toca para tu lista de deseos",
  "{n} night": "{n} noche",
  "{n} nights": "{n} noches",
  "Family — no charge": "Familia — sin costo",
  "Paid ${amount}": "Pagado: ${amount}",
  // "Apartado": held for the guest but not yet paid — "reservado" would read
  // as a confirmed booking, and a held night is not one.
  "⏳ Held for you": "⏳ Apartado para ti",
  "Your stay · {nights}": "Tu estadía · {nights}",
  "Your stay, continued": "Tu estadía (continuación)",
  "Booking details, {room}, {date}": "Detalles de la reserva, {room}, {date}",
  "Details ›": "Detalles ›",
  "Tap to pay": "Toca para pagar",
  "Prices are yours, a night": "Tus precios, por noche",

  // US federal holidays, as a Latin American guest reads them. Days that also
  // exist at home on another date (Labor Day is 1 May there, Independence Day
  // is their own) say EE. UU., so nobody thinks the calendar is wrong.
  "{name} (observed)": "{name} (feriado trasladado)",
  "New Year's Day": "Año Nuevo",
  "Martin Luther King Jr. Day": "Día de Martin Luther King Jr.",
  "Presidents' Day": "Día de los Presidentes",
  "Memorial Day": "Día de los Caídos (Memorial Day)",
  Juneteenth: "Juneteenth",
  "Independence Day": "Día de la Independencia (EE. UU.)",
  "Labor Day": "Día del Trabajo (EE. UU.)",
  "Columbus Day": "Día de Colón",
  "Veterans Day": "Día de los Veteranos",
  Thanksgiving: "Día de Acción de Gracias",
  "Christmas Day": "Navidad",
};
