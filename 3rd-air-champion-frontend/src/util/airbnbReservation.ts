import { guestsFromAlias, tidyAlias } from "./airbnbAlias";

// Reading an AirBnB reservation the host has copied off the page.
//
// The reservation detail page cannot be fetched. It is behind the host login,
// sends no CORS header, and is guarded by DataDome — so a link is not something
// this app can follow, from the server or from the browser. Checked, not
// assumed: the URL answers 302 to /login and sets a datadome cookie.
//
// What the host CAN do is what they already do — have the page open — and copy
// it. So this reads the text instead. No credentials, nothing to break when
// AirBnB rotates a session, and deterministic like util/dateText: no model, no
// network, no cost.
//
// Everything here is optional on purpose. A partial read that fills three
// fields correctly and leaves the fourth alone beats a confident guess, because
// the host is pasting precisely because they are tired of checking.

export interface ParsedReservation {
  // "Olga" — the heading name, tidied the way a hand-typed alias is.
  alias: string;
  // "Olga Trofimova", from Who's coming. Kept apart: the alias is what a
  // calendar bar shows and wants to stay short.
  fullName?: string;
  guests?: number;
  // "Queen room" → "Queen", matched to a real room by the caller.
  roomName?: string;
  startDate?: string; // yyyy-MM-dd
  nights?: number;
  // The host payout, cents included. NEVER rounded — the cents are the real
  // figure ([[project-manual-airbnb-guests]]).
  payout?: number;
  confirmationCode?: string;
}

const MONTHS: Record<string, number> = {
  jan: 0, feb: 1, mar: 2, apr: 3, may: 4, jun: 5,
  jul: 6, aug: 7, sep: 8, sept: 8, oct: 9, nov: 10, dec: 11,
};

const pad = (n: number) => String(n).padStart(2, "0");
// "Sep", "Sept", "June": the page is not consistent about the long forms, and
// the table above is keyed by the first three letters.
const monthOf = (s: string | undefined) =>
  s === undefined ? undefined : MONTHS[s.slice(0, 3).toLowerCase()];

// A date on the page carries its year ONLY when the stay is not in the current
// one: "Jan 5 – 7, 2027 · 2 nights" and "Tue, Jan 5, 2027". Every pattern
// below takes that ", 2027" as optional. It was not optional, and a booking
// for 2027 pasted in September 2026 matched nothing — no heading, so no name,
// no guest count, and no payout either, because the payout is only read from
// the heading onward. The host saw three blank fields and no reason for them.
const YEAR = String.raw`(?:,\s*(\d{4}))?`;

// The heading that opens the detail panel: a name, then a line like
// "Sep 2 – 3 · 1 night". The name is the line directly above it, which is what
// makes this findable in a page that also lists every upcoming reservation in
// the same shape.
// The range may also cross a month ("Sep 30 – Oct 2 · 2 nights"), which the
// first version of this pattern did not allow either.
const HEADING = new RegExp(
  String.raw`^(.+)\n\s*[A-Z][a-z]{2,4}\.? \d{1,2}${YEAR}(?:\s*[–—-]\s*(?:[A-Z][a-z]{2,4}\.? )?\d{1,2}${YEAR})?\s*·\s*(\d+)\s*nights?`,
  "m",
);

// "$73.51" on its own line, then "Total for 1 night". Anchored to that label
// rather than to the first dollar sign on the page — the upcoming list and the
// nightly rate both carry amounts, and only this one is the payout.
const PAYOUT = /\$\s*([\d,]+(?:\.\d{2})?)\s*\n\s*Total for \d+ nights?/;

const CONFIRMATION = /Confirmation code\s*\n?\s*([A-Z0-9]{8,})/;
// "Wed, Sep 2" this year, "Tue, Jan 5, 2027" next. When the year is there it
// is the truth and beats the booking-date inference below.
const CHECK_IN = new RegExp(
  String.raw`Check-?in\s*\n\s*[A-Z][a-z]{2,8},\s*([A-Z][a-z]{2,4})\.?\s+(\d{1,2})${YEAR}`,
);
// "Booking date / Wednesday, August 26, 2026" — the only YEAR on the page, and
// the anchor for a check-in that never carries one.
// The MONTH is captured too: a check-in earlier in the year than the booking
// belongs to the year after it.
const BOOKING_DATE = /Booking date\s*\n?\s*[A-Za-z]+,\s*([A-Za-z]+) \d{1,2},\s*(\d{4})/;
// "Queen room • Smart toilet • …". The bullet is what proves it is the room
// line and not a sentence that happens to contain the word.
const ROOM = /^\s*([A-Za-z]+) room\s*[•·]/m;

export const parseReservation = (text: string): ParsedReservation | null => {
  const raw = (text ?? "").replace(/\r\n/g, "\n");
  if (!raw.trim()) return null;

  const heading = raw.match(HEADING);
  const confirmation = raw.match(CONFIRMATION);
  // One or the other has to be there, or this is not a reservation at all and
  // guessing at the rest would invent a booking.
  if (!heading && !confirmation) return null;

  // Everything below is read from the DETAIL PANEL only — the text from the
  // heading onward. Above it the page lists every upcoming reservation in the
  // same "name / dates / room" shape, so a search across the whole paste finds
  // the room in the Today section rather than the room of the booking the host
  // actually has open.
  const detail = heading?.index !== undefined ? raw.slice(heading.index) : raw;

  const headingName = heading?.[1]?.trim() ?? "";
  const out: ParsedReservation = { alias: tidyAlias(headingName) };

  const read = guestsFromAlias(headingName);
  // No possessive and no group means the reservation is for the one person
  // named — which is the case the host most often leaves sitting at whatever
  // the form defaulted to.
  if (headingName) out.guests = read ? read.count : 1;

  // Group 2 and 3 are the optional years; the night count is the last group.
  if (heading?.[4]) out.nights = Number(heading[4]);

  const payout = detail.match(PAYOUT);
  if (payout) {
    const n = Number(payout[1].replace(/,/g, ""));
    if (Number.isFinite(n)) out.payout = n;
  }

  if (confirmation) out.confirmationCode = confirmation[1];

  const room = detail.match(ROOM);
  if (room) out.roomName = room[1];

  const checkIn = detail.match(CHECK_IN);
  const booked = detail.match(BOOKING_DATE);
  if (checkIn) {
    const month = monthOf(checkIn[1]);
    const day = Number(checkIn[2]);
    if (month !== undefined && day >= 1 && day <= 31) {
      let year: number;
      if (checkIn[3]) {
        // The page says the year outright — it does so for any stay outside
        // the current year — and that is the end of it.
        year = Number(checkIn[3]);
      } else {
        // The check-in carries no year. The booking date does, and a stay
        // cannot be booked after it has started — so a check-in EARLIER in
        // the year than the booking belongs to the year after, which is how a
        // December booking for January reads correctly.
        year = booked ? Number(booked[2]) : new Date().getFullYear();
        const bookedMonth = monthOf(booked?.[1]);
        if (bookedMonth !== undefined && month < bookedMonth) year += 1;
      }
      out.startDate = `${year}-${pad(month + 1)}-${pad(day)}`;
    }
  }

  // "Who's coming" then the guest's full name on the next non-empty line.
  const who = detail.match(/Who[’'`]?s coming\s*\n+\s*([^\n]+)/);
  if (who) {
    const name = who[1].trim();
    if (name && !/^Cancellation/i.test(name)) out.fullName = name;
  }

  return out;
};

// ── The Upcoming list ───────────────────────────────────────────────────────
//
// The same page carries every upcoming reservation as three lines:
//
//   Sep 2 – 3
//   Xiaomin's group of 2
//   Cute room • Smart toilet • Stay with an Engineer
//
// One copy of that list is what lets TiMag be checked against AirBnB at all.
// There is no upcoming-reservations screen in TiMag — the calendar shows stays
// as bars, which cannot be read down a column — so a guest count typed wrong
// months ago is invisible until somebody arrives to a bed that was not made.
//
// No payout here; the list does not carry one. It gives the two things most
// likely to be wrong anyway: whether the stay exists at all, and how many
// people are in it.

export interface ListedReservation {
  alias: string;
  guests: number;
  roomName: string;
  startDate: string; // yyyy-MM-dd
  nights: number;
}

// "Sep 2 – 3" or "Sep 30 – Oct 2": the end may name its own month. And
// "Jan 5 – 7, 2027" once the list reaches next year — see YEAR above.
// Groups: 1 start month, 2 start day, 3 start year?, 4 end month?, 5 end day,
// 6 end year?.
const ROW_DATES = new RegExp(
  String.raw`^\s*([A-Z][a-z]{2,4})\.?\s+(\d{1,2})${YEAR}\s*[–—-]\s*(?:([A-Z][a-z]{2,4})\.?\s+)?(\d{1,2})${YEAR}\s*$`,
);
const ROW_ROOM = /^\s*([A-Za-z]+) room\s*[•·]/;

export const parseReservationList = (
  text: string,
  today: Date = new Date(),
): ListedReservation[] => {
  const lines = (text ?? "").replace(/\r\n/g, "\n").split("\n");
  const out: ListedReservation[] = [];

  for (let i = 0; i < lines.length; i++) {
    const dates = lines[i].match(ROW_DATES);
    if (!dates) continue;

    // The next two NON-EMPTY lines are the name and the room. AirBnB pads the
    // list with blank lines, and a row whose next lines are not a name and a
    // room is not a row at all — the Today section above is laid out
    // differently and must not be read as one.
    const rest: string[] = [];
    for (let j = i + 1; j < lines.length && rest.length < 2; j++) {
      if (lines[j].trim()) rest.push(lines[j]);
    }
    if (rest.length < 2) continue;
    const room = rest[1].match(ROW_ROOM);
    if (!room) continue;

    const startMonth = monthOf(dates[1]);
    const endMonth = dates[4] ? monthOf(dates[4]) : startMonth;
    if (startMonth === undefined || endMonth === undefined) continue;
    const startDay = Number(dates[2]);
    const endDay = Number(dates[5]);

    // The list carries no year for this year's stays. These are UPCOMING, so a
    // month already behind us is next year's — the same rule util/dateText
    // uses. A row that does name its year ("Jan 5 – 7, 2027") is believed.
    const y0 = today.getFullYear();
    const endYearGiven = dates[6] ? Number(dates[6]) : undefined;
    const startYear = dates[3]
      ? Number(dates[3])
      : endYearGiven !== undefined && endMonth >= startMonth
        ? endYearGiven
        : startMonth < today.getMonth()
          ? y0 + 1
          : y0;
    // A stay running Dec 30 – Jan 2 ends in the year after it starts.
    const endYear = endYearGiven ?? (endMonth < startMonth ? startYear + 1 : startYear);

    const start = new Date(startYear, startMonth, startDay);
    const end = new Date(endYear, endMonth, endDay);
    const nights = Math.round((end.getTime() - start.getTime()) / 86400000);
    if (nights < 1) continue;

    const name = rest[0].trim();
    const read = guestsFromAlias(name);
    out.push({
      alias: tidyAlias(name),
      guests: read ? read.count : 1,
      roomName: room[1],
      startDate: `${startYear}-${pad(startMonth + 1)}-${pad(startDay)}`,
      nights,
    });
  }

  return out;
};
