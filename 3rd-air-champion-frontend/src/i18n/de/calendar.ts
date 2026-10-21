// German for TiBook's calendar screens — see index.ts.
export const calendar: Record<string, string> = {
  // The bar over the calendar
  Today: "Heute",
  Month: "Monat",
  List: "Liste",
  "Show the calendar as": "Kalender anzeigen als",
  "Show the calendar as a month": "Kalender als Monat anzeigen",
  "Show the calendar as a list of days": "Kalender als Tagesliste anzeigen",
  "Request a Booking": "Buchung anfragen",
  "All rooms": "Alle Zimmer",

  // Weekday header. The first letter of each is the narrow header on a phone
  // (S M D M D F S); the three-letter keys are its wider form.
  Sunday: "Sonntag",
  Monday: "Montag",
  Tuesday: "Dienstag",
  Wednesday: "Mittwoch",
  Thursday: "Donnerstag",
  Friday: "Freitag",
  Saturday: "Samstag",
  Sun: "So",
  Mon: "Mo",
  Tue: "Di",
  Wed: "Mi",
  Thu: "Do",
  Fri: "Fr",
  Sat: "Sa",

  // A month tile. Kept as narrow as the English: the tile caps these lines
  // by their English width (see SOLD_OUT_EMS in GuestCalendar), so
  // "ausgebucht" would run out of a phone's tile where "belegt" fits.
  "{n} left": "noch {n}",
  "sold out": "belegt",
  "Add to wish list": "Auf die Wunschliste",
  "Remove from wish list": "Von der Wunschliste entfernen",

  // The day-by-day list
  "{count} free": "{count} frei",
  Free: "Frei",
  "no charge": "kostenlos",
  "family, no charge": "Familie, kostenlos",
  "a night, your price": "pro Nacht, dein Preis",
  "Sold out": "Ausgebucht",
  "Sold out · on your wish list": "Ausgebucht · auf deiner Wunschliste",
  // U+2011 in the English key, as on screen.
  "Sold out · tap to wish‑list": "Ausgebucht · tippen für die Wunschliste",
  "{n} night": "{n} Nacht",
  "{n} nights": "{n} Nächte",
  "Family — no charge": "Familie – kostenlos",
  "Paid ${amount}": "Bezahlt: ${amount}",
  "⏳ Held for you": "⏳ Für dich reserviert",
  "Your stay · {nights}": "Dein Aufenthalt · {nights}",
  "Your stay, continued": "Dein Aufenthalt (Fortsetzung)",
  "Booking details, {room}, {date}": "Buchungsdetails, {room}, {date}",
  "Details ›": "Details ›",
  "Tap to pay": "Tippen zum Bezahlen",
  "Prices are yours, a night": "Deine Preise, pro Nacht",

  // US federal holidays, as a German guest reads them. Names a German already
  // knows (Thanksgiving, Memorial Day) stay; the rest say what the day is.
  "{name} (observed)": "{name} (Ersatzfeiertag)",
  "New Year's Day": "Neujahr",
  "Martin Luther King Jr. Day": "Martin-Luther-King-Tag",
  "Presidents' Day": "Presidents' Day",
  "Memorial Day": "Memorial Day",
  Juneteenth: "Juneteenth",
  "Independence Day": "Unabhängigkeitstag (USA)",
  "Labor Day": "Labor Day (Tag der Arbeit, USA)",
  "Columbus Day": "Columbus Day",
  "Veterans Day": "Veteranentag",
  Thanksgiving: "Thanksgiving",
  "Christmas Day": "Weihnachten",
};
