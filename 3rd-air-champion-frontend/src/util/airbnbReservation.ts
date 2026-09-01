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

// The heading that opens the detail panel: a name, then a line like
// "Sep 2 – 3 · 1 night". The name is the line directly above it, which is what
// makes this findable in a page that also lists every upcoming reservation in
// the same shape.
const HEADING = /^(.+)\n\s*[A-Z][a-z]{2} \d{1,2}(?:\s*[–—-]\s*\d{1,2})?\s*·\s*(\d+)\s*nights?/m;

// "$73.51" on its own line, then "Total for 1 night". Anchored to that label
// rather than to the first dollar sign on the page — the upcoming list and the
// nightly rate both carry amounts, and only this one is the payout.
const PAYOUT = /\$\s*([\d,]+(?:\.\d{2})?)\s*\n\s*Total for \d+ nights?/;

const CONFIRMATION = /Confirmation code\s*\n?\s*([A-Z0-9]{8,})/;
const CHECK_IN = /Check-?in\s*\n\s*[A-Z][a-z]{2},\s*([A-Z][a-z]{2})\s+(\d{1,2})/;
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

  if (heading?.[2]) out.nights = Number(heading[2]);

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
    const month = MONTHS[checkIn[1].toLowerCase()];
    const day = Number(checkIn[2]);
    if (month !== undefined && day >= 1 && day <= 31) {
      // The check-in carries no year. The booking date does, and a stay cannot
      // be booked after it has started — so a check-in EARLIER in the year than
      // the booking belongs to the year after, which is how a December booking
      // for January reads correctly.
      let year = booked ? Number(booked[2]) : new Date().getFullYear();
      const bookedMonth = booked ? MONTHS[booked[1].slice(0, 3).toLowerCase()] : undefined;
      if (bookedMonth !== undefined && month < bookedMonth) year += 1;
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
