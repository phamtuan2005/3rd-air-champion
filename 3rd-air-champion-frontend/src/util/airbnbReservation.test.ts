import { describe, expect, it } from "vitest";
import { parseReservation, parseReservationList } from "./airbnbReservation";

// The real shape of the AirBnB host page, names changed — a test fixture lives
// in git and a guest's full name does not belong there.
//
// Note what surrounds the detail panel: the nav, and a list of forty-nine
// upcoming reservations in the SAME "name / dates / room" shape. Anything that
// matched loosely would read the first row of that list instead of the booking
// the host actually has open.
const PAGE = `Skip to content
Today
Calendar
Listings
Messages13 unread messages
Switch to traveling


Notifications, 28 unread

Today


2:00 PM
Ivy’s group of 2 checks in
King room • Smart toilet • Stay with an Engineer



All day
Aritra stays for 2 more days
Cozy room • Smart toilet • Stay with an Engineer


Upcoming
49 reservations

Sep 2 – 3
Xiaomin’s group of 2
Cute room • Smart toilet • Stay with an Engineer




Sep 2 – 3
Nadia
Queen room • Smart toilet • Stay with an Engineer



Sep 3 – 5
David’s group of 2
Chill room • Smart toilet • Stay with an Engineer


Show more
Nadia
Sep 2 – 3 · 1 night
Queen room • Smart toilet • Stay with an Engineer

Check-in
Wed, Sep 2
2:00 PM

Checkout
Thu, Sep 3
11:00 AM

Suggested door code
9101
Your notes
Add a note to yourself


Who’s coming

Nadia Petrova
Enjoys coffee

Cancellation policy
Moderate

$73.51
Total for 1 night

Manage reservation

Booking date
Wednesday, August 26, 2026

Confirmation code
HM2AXNH84J
Message`;

describe("a reservation copied off the AirBnB page", () => {
  const r = parseReservation(PAGE)!;

  it("reads the guest, not the first row of the upcoming list", () => {
    expect(r.alias).toBe("Nadia");
    expect(r.fullName).toBe("Nadia Petrova");
  });

  it("counts one guest when the name carries no group", () => {
    expect(r.guests).toBe(1);
  });

  it("reads the payout to the cent", () => {
    // The cents ARE the payout; rounding them loses real money.
    expect(r.payout).toBe(73.51);
  });

  it("reads the room, the dates and the length", () => {
    expect(r.roomName).toBe("Queen");
    expect(r.startDate).toBe("2026-09-02");
    expect(r.nights).toBe(1);
  });

  it("reads the confirmation code", () => {
    expect(r.confirmationCode).toBe("HM2AXNH84J");
  });
});

describe("a group reservation", () => {
  const PAGE_GROUP = PAGE.replace("Show more\nNadia\nSep 2 – 3 · 1 night", "Show more\nDavid’s group of 2\nSep 3 – 5 · 2 nights")
    .replace("$73.51\nTotal for 1 night", "$164.00\nTotal for 2 nights")
    .replace("Check-in\nWed, Sep 2", "Check-in\nThu, Sep 3");

  it("takes the count out of the name and tidies the name down", () => {
    const r = parseReservation(PAGE_GROUP)!;
    expect(r.alias).toBe("David");
    expect(r.guests).toBe(2);
    expect(r.nights).toBe(2);
    expect(r.payout).toBe(164);
    expect(r.startDate).toBe("2026-09-03");
  });
});

describe("what it refuses to read", () => {
  it("returns nothing for text that is not a reservation", () => {
    expect(parseReservation("")).toBeNull();
    expect(parseReservation("just some notes I pasted by mistake")).toBeNull();
  });

  it("does not invent a payout when the page has none", () => {
    const noMoney = PAGE.replace("$73.51\nTotal for 1 night", "");
    expect(parseReservation(noMoney)?.payout).toBeUndefined();
  });
});

describe("a stay that runs into the next year", () => {
  // Booked in December for January: the check-in carries no year, so it has to
  // come from the booking date — and a January check-in booked in December is
  // the January AFTER it, never the one already gone.
  it("rolls the year forward", () => {
    const nextYear = PAGE.replace("Check-in\nWed, Sep 2", "Check-in\nFri, Jan 8").replace(
      "Booking date\nWednesday, August 26, 2026",
      "Booking date\nMonday, December 21, 2026",
    );
    expect(parseReservation(nextYear)?.startDate).toBe("2027-01-08");
  });
});

describe("a stay in another year", () => {
  // Pasted 2026-09-25: a booking for January 2027 filled nothing at all — no
  // name, no guest count, no payout. AirBnB writes the year into the dates
  // only when the stay is outside the current year, and no pattern here
  // allowed for it, so the heading never matched and the read gave up.
  const NEXT_YEAR = PAGE.replace("Show more\nNadia\nSep 2 – 3 · 1 night", "Show more\nNadia\nJan 5 – 7, 2027 · 2 nights")
    .replace("$73.51\nTotal for 1 night", "$164.00\nTotal for 2 nights")
    .replace("Check-in\nWed, Sep 2", "Check-in\nTue, Jan 5, 2027")
    .replace("Checkout\nThu, Sep 3", "Checkout\nThu, Jan 7, 2027");

  it("still reads the name, the count and the payout", () => {
    const r = parseReservation(NEXT_YEAR);
    expect(r?.alias).toBe("Nadia");
    expect(r?.guests).toBe(1);
    expect(r?.payout).toBe(164);
    expect(r?.nights).toBe(2);
  });

  it("takes the year the page states, over the booking-date guess", () => {
    // Booked in August 2026 for January: the old inference would have said
    // 2027 here too, but the point is that the stated year is read AS stated.
    expect(parseReservation(NEXT_YEAR)?.startDate).toBe("2027-01-05");
    const stated2028 = NEXT_YEAR.replace("Check-in\nTue, Jan 5, 2027", "Check-in\nWed, Jan 5, 2028");
    expect(parseReservation(stated2028)?.startDate).toBe("2028-01-05");
  });

  it("reads a heading whose range crosses a month", () => {
    const crossing = PAGE.replace("Show more\nNadia\nSep 2 – 3 · 1 night", "Show more\nNadia\nSep 30 – Oct 2 · 2 nights");
    const r = parseReservation(crossing);
    expect(r?.alias).toBe("Nadia");
    expect(r?.nights).toBe(2);
  });
});

// One copy of the Upcoming list is what lets TiMag be checked against AirBnB —
// there is no upcoming-reservations screen in TiMag to read it against by eye.
const LIST = `Upcoming
49 reservations

Sep 2 – 3
Xiaomin’s group of 2
Cute room • Smart toilet • Stay with an Engineer




Sep 2 – 3
Nadia
Queen room • Smart toilet • Stay with an Engineer



Sep 3 – 5
David’s group of 2
Chill room • Smart toilet • Stay with an Engineer



Sep 30 – Oct 2
Priya
King room • Smart toilet • Stay with an Engineer



Jan 5 – 7, 2027
Mateo’s group of 3
Chill room • Smart toilet • Stay with an Engineer
`;

describe("the Upcoming list", () => {
  const rows = parseReservationList(LIST, new Date(2026, 7, 20));

  it("reads every row", () => {
    expect(rows).toHaveLength(5);
  });

  // The list names the year once it reaches next year's stays; a row that
  // does is believed as written, not inferred from today.
  it("reads a row that states its year", () => {
    const r = rows[4];
    expect(r.alias).toBe("Mateo");
    expect(r.guests).toBe(3);
    expect(r.startDate).toBe("2027-01-05");
    expect(r.nights).toBe(2);
  });

  it("takes the name, the count and the room", () => {
    expect(rows[0]).toEqual({
      alias: "Xiaomin",
      guests: 2,
      roomName: "Cute",
      startDate: "2026-09-02",
      nights: 1,
    });
    expect(rows[1].alias).toBe("Nadia");
    expect(rows[1].guests).toBe(1);
  });

  it("counts nights across the range", () => {
    expect(rows[2]).toMatchObject({ alias: "David", nights: 2, startDate: "2026-09-03" });
  });

  it("handles a range that crosses a month", () => {
    expect(rows[3]).toMatchObject({ roomName: "King", startDate: "2026-09-30", nights: 2 });
  });
});
