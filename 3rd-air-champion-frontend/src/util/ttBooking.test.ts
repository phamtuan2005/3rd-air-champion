import { describe, expect, it } from "vitest";
import { askTT, AskTTContext, TTRoom } from "./askTT";
import {
  bookingRequestOf,
  checkoutReading,
  chooseRoom,
  monthAsked,
  nextStep,
  readContact,
  readParty,
  readStay,
  readYesNo,
  summaryLines,
  TTBookingDraft,
  ttBookingIsDryRun,
  wantsToBook,
} from "./ttBooking";

// Booking by talking to TT. Each case is a way a guest's words could become a
// request for nights they did not mean, or a request sent before they said so.

const today = new Date(2026, 9, 2); // Fri 2 Oct 2026, local midnight

const room = (id: string, name: string, listing: string): TTRoom => ({
  id,
  name,
  airbnbUrl: `https://www.airbnb.com/rooms/${listing}`,
});
const king = room("k", "King", "1586635483950294231"); // sleeps 3
const chill = room("c", "Chill", "1400962263132112124"); // sleeps 2
const cozy = room("z", "Cozy", "1177648203505001777"); // sleeps 1

const ctx = (free: Record<string, TTRoom[]> = {}, extra: Partial<AskTTContext> = {}): AskTTContext => ({
  today,
  rooms: [king, chill, cozy],
  freeRoomsOn: (key) => free[key] ?? [king, chill, cozy],
  myRates: new Map(),
  hostFirstName: "Anh-Tuan",
  cancellationFullRefundDays: 14,
  cancellationHalfRefundDays: 7,
  ...extra,
});

const draft = (over: Partial<TTBookingDraft> = {}): TTBookingDraft => ({
  id: 1,
  roomId: "k",
  dates: ["2026-10-20", "2026-10-21"],
  party: 2,
  name: "Mai",
  phone: "408 555 0123",
  holidaysKept: false,
  ...over,
});

describe("readStay — a stay written with its check-out", () => {
  // Read by the plain parser, "Oct 20 to Oct 23" was two single nights and TT
  // offered them as two one-night stays (2026-10-07).
  it("reads 'to' as the day they leave", () => {
    expect(readStay("can I book Queen from Oct 20 to Oct 23", today)?.dates).toEqual(["2026-10-20", "2026-10-21", "2026-10-22"]);
  });

  it("reads 'check out' and a bare day in the same month", () => {
    expect(readStay("check in Oct 20, check out the 22nd", today)?.dates).toEqual(["2026-10-20", "2026-10-21"]);
    expect(readStay("Oct 30 until 2", today)?.dates).toEqual(["2026-10-30", "2026-10-31", "2026-11-01"]);
  });

  it("reads 'through' as staying that night too", () => {
    expect(readStay("Dec 20 through Dec 22", today)?.dates).toEqual(["2026-12-20", "2026-12-21", "2026-12-22"]);
  });

  // "Nov 3, 2 nights" used to read as Nov 2 and Nov 3.
  it("reads a start and a number of nights, without taking the number as a day", () => {
    expect(readStay("Nov 3 for 2 nights", today)?.dates).toEqual(["2026-11-03", "2026-11-04"]);
    expect(readStay("Nov 3, two nights", today)?.dates).toEqual(["2026-11-03", "2026-11-04"]);
    expect(readStay("Nov 3 for a week", today)?.dates).toHaveLength(7);
  });

  it("leaves 'I want to book' alone — that 'to' has no date before it", () => {
    expect(readStay("I want to book King Oct 10-12", today)).toBeNull();
  });

  it("is null for the shapes the plain parser already reads", () => {
    expect(readStay("Oct 10-12", today)).toBeNull();
    expect(readStay("this weekend", today)).toBeNull();
  });
});

describe("checkoutReading — the other way to read 'Oct 10-12'", () => {
  it("offers the two-night reading of a dash range", () => {
    expect(checkoutReading("Oct 10-12", ["2026-10-10", "2026-10-11", "2026-10-12"])).toEqual(["2026-10-10", "2026-10-11"]);
  });

  it("does not offer one for a single night or a list", () => {
    expect(checkoutReading("Oct 10", ["2026-10-10"])).toBeNull();
    expect(checkoutReading("Oct 10, 11", ["2026-10-10", "2026-10-11"])).toBeNull();
  });
});

describe("monthAsked", () => {
  it("reads a month alone as its nights from today", () => {
    expect(monthAsked("what's available in November", today)).toHaveLength(30);
    expect(monthAsked("anything in October?", today)?.[0]).toBe("2026-10-02");
  });

  it("is not a month when a day follows it", () => {
    expect(monthAsked("Nov 3", today)).toBeNull();
  });
});

describe("wantsToBook", () => {
  it("hears a booking", () => {
    ["book King Oct 10", "I'd like to reserve Cozy", "we need a room Oct 18", "can I get Chill this weekend"].forEach((q) =>
      expect(wantsToBook(q)).toBe(true),
    );
  });

  // Their booking, cancelling one, or asking how: not a new request.
  it("does not hear one in a question about an existing stay", () => {
    ["where is my booking", "I need to cancel my reservation", "is Oct 10 booked", "is King free Oct 10"].forEach((q) =>
      expect(wantsToBook(q)).toBe(false),
    );
  });
});

describe("chooseRoom", () => {
  const nights = ["2026-10-10", "2026-10-11"];

  it("books the room they named when it is free every night", () => {
    expect(chooseRoom(nights, ctx(), chill, null)).toEqual({ kind: "room", room: chill });
  });

  it("does not book a named room that is taken one of the nights", () => {
    expect(chooseRoom(nights, ctx({ "2026-10-11": [king] }), chill, null).kind).toBe("none");
  });

  it("goes to their usual room when they did not name one", () => {
    const back = ctx({}, { guest: { firstName: "Mai", usualRoomId: "z", wishList: [] } });
    expect(chooseRoom(nights, back, null, null)).toEqual({ kind: "room", room: cozy });
  });

  // The rooms differ — a shared bathroom, a sofa bed. TT does not pick one
  // for a guest who did not say.
  it("asks when several rooms fit", () => {
    expect(chooseRoom(nights, ctx(), null, 2)).toEqual({ kind: "choose", rooms: [king, chill] });
  });

  it("takes the only room that fits the party", () => {
    expect(chooseRoom(nights, ctx(), null, 3)).toEqual({ kind: "room", room: king });
  });

  // TIBOOK.md rule 2: nights that are not one run are not one stay.
  it("will not book nights that are not one run", () => {
    expect(chooseRoom(["2026-10-10", "2026-10-12"], ctx(), king, null).kind).toBe("none");
  });
});

describe("askTT — asked to book", () => {
  it("starts the booking straight away when the room is free", () => {
    const a = askTT("I want to book King Oct 10-11", ctx());
    expect(a).toMatchObject({ category: "booking", answered: true, book: { roomId: "k", dates: ["2026-10-10", "2026-10-11"] } });
    expect(a.lines.join("\n")).toContain("check out Mon Oct 12");
  });

  it("carries the party size into the booking", () => {
    expect(askTT("book King Oct 10 for 2 guests", ctx()).book?.party).toBe(2);
  });

  it("asks which room when several are free", () => {
    const a = askTT("book this weekend", ctx());
    expect(a.book).toBeUndefined();
    expect(a.actions.filter((x) => x.kind === "book").map((x) => (x as { roomId: string }).roomId)).toEqual(["k", "c", "z"]);
  });

  it("says a named room is too small, and offers the ones that fit", () => {
    const a = askTT("book Cozy Oct 10 for 3 people", ctx());
    expect(a.lines.join("\n")).toMatch(/Cozy sleeps up to 1/);
    expect(a.actions).toContainEqual(expect.objectContaining({ kind: "book", roomId: "k" }));
  });

  it("explains a taken room as the availability answer does, with Book buttons", () => {
    const a = askTT("book King Oct 10", ctx({ "2026-10-10": [chill] }));
    expect(a.lines.join("\n")).toMatch(/King is taken/);
    expect(a.actions).toContainEqual(expect.objectContaining({ kind: "book", roomId: "c" }));
  });

  // A new guest only LOOKING still learns the calendar (askTT.test.ts); the
  // dates after "I'd like to book" are a booking.
  it("books the dates given after the guest said they want to book", () => {
    expect(askTT("Oct 10", ctx()).actions[0]).toMatchObject({ kind: "pick" });
    expect(askTT("Oct 10", ctx(), { booking: true }).actions[0]).toMatchObject({ kind: "book" });
  });

  it("offers the two-night reading on the booking it starts", () => {
    expect(askTT("book King Oct 10-12", ctx()).book?.alt).toEqual(["2026-10-10", "2026-10-11"]);
  });
});

describe("the conversation", () => {
  it("asks for what is missing in order: party, phone, name, holiday, then the read-back", () => {
    expect(nextStep(draft({ party: null }))).toBe("party");
    expect(nextStep(draft({ phone: "" }))).toBe("contact");
    expect(nextStep(draft({ name: "" }))).toBe("name");
    // Mon Oct 12 2026 is Columbus Day.
    expect(nextStep(draft({ dates: ["2026-10-11", "2026-10-12"] }))).toBe("holiday");
    expect(nextStep(draft({ dates: ["2026-10-11", "2026-10-12"], holidaysKept: true }))).toBe("confirm");
    expect(nextStep(draft())).toBe("confirm");
  });

  it("reads a name and a number out of one line", () => {
    expect(readContact("Mai Tran, 408 555 0123")).toEqual({ name: "Mai Tran", phone: "408 555 0123" });
    expect(readContact("I'm Mai and my number is (408) 555-0123")).toEqual({ name: "Mai", phone: "(408) 555-0123" });
    expect(readContact("Isabel")).toEqual({ name: "Isabel", phone: "" });
  });

  it("reads a party size typed on its own", () => {
    expect(readParty("2")).toBe(2);
    expect(readParty("two of us")).toBe(2);
    expect(readParty("just me")).toBe(1);
    expect(readParty("is there parking")).toBeNull();
  });

  it("reads yes and no", () => {
    expect(readYesNo("yes please")).toBe("yes");
    expect(readYesNo("send it")).toBe("yes");
    expect(readYesNo("no thanks")).toBe("no");
    expect(readYesNo("is there parking")).toBeNull();
  });
});

describe("the read-back and the request", () => {
  it("shows check-in, check-out, party and who — never the whole phone number", () => {
    const t = summaryLines(draft(), king, ctx()).join("\n");
    expect(t).toContain("King · Check in Tue Oct 20 · check out Thu Oct 22 · 2 nights");
    expect(t).toContain("2 guests · under Mai, phone ending 0123");
    expect(t).not.toContain("408 555");
    expect(t).toMatch(/Nothing is booked until Anh-Tuan confirms/);
  });

  // A stranger is never quoted a list price (askTT.ts); a $0 rate is family.
  it("states the guest's own rate, family as family, and no price for a stranger", () => {
    expect(summaryLines(draft(), king, ctx()).join("\n")).toContain("Anh-Tuan will text you the price");
    expect(summaryLines(draft(), king, ctx({}, { myRates: new Map([["k", 85]]) })).join("\n")).toContain("$85/night");
    expect(summaryLines(draft(), king, ctx({}, { myRates: new Map([["k", 0]]) })).join("\n")).toContain("Family — no charge");
  });

  // The same request the form sends, so the host's Requests screen cannot
  // tell them apart.
  it("builds the form's request: first night, nights as duration", () => {
    expect(bookingRequestOf(draft(), king, "host1")).toEqual({
      host: "host1",
      guestName: "Mai",
      guestPhone: "408 555 0123",
      date: "2026-10-20",
      room: "k",
      duration: 2,
      numberOfGuests: 2,
      notes: "Requested through Ask TT: King, Check in Tue Oct 20 · check out Thu Oct 22 · 2 nights.",
    });
  });

  // The dev server's /api is production.
  it("only pretends to send on the dev server, unless told to send", () => {
    expect(ttBookingIsDryRun({ dev: true, sendInDev: false })).toBe(true);
    expect(ttBookingIsDryRun({ dev: true, sendInDev: true })).toBe(false);
    expect(ttBookingIsDryRun({ dev: false, sendInDev: false })).toBe(false);
  });
});

describe("questions TT used to say it did not understand", () => {
  const answer = (q: string) => askTT(q, ctx({}, { houseRules: "No smoking." }));

  it("answers from the listings what the listings say", () => {
    expect(answer("is there a lock on my room door").lines.join("\n")).toContain("Every room has a lock on the door");
    expect(answer("is there a refrigerator").category).toBe("kitchen");
    expect(answer("show me photos").actions.every((a) => a.kind === "photos")).toBe(true);
    expect(answer("hola")).toMatchObject({ category: "greeting" });
    expect(answer("can I have a guest over")).toMatchObject({ category: "houseRules", answered: true });
  });

  // Never made up: what no listing says goes to the host, NAMED, so the guest
  // knows TT understood and the host's log shows what to teach.
  it("names what no listing mentions, and hands it to the host as not answered", () => {
    const a = answer("is there a hair dryer");
    expect(a).toMatchObject({ category: "amenities", answered: false });
    expect(a.lines.join("\n")).toContain("a hair dryer");
  });

  it("files payment questions under price, for the host", () => {
    expect(answer("can I pay with venmo")).toMatchObject({ category: "price", answered: false });
  });

  // Self check-in is how, not when. The house has no time written down.
  it("does not pass self check-in off as a check-in time", () => {
    expect(answer("what time is check in")).toMatchObject({ category: "checkIn", answered: false });
    expect(answer("how do I get in")).toMatchObject({ category: "checkIn", answered: true });
  });

  it("sends 'cancel my booking' to the cancellation terms, not just the bookings list", () => {
    expect(answer("I need to cancel my booking").category).toBe("cancellation");
  });

  it("answers a month on its own, and does not read 'May I' as May", () => {
    expect(answer("what's available in November")).toMatchObject({ category: "availability" });
    expect(answer("may I bring my dog")).toMatchObject({ category: "houseRules" });
  });
});
