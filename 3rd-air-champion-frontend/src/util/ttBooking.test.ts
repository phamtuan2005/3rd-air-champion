import { describe, expect, it } from "vitest";
import { askTT, AskTTContext, TTRoom } from "./askTT";
import {
  bookingRequestOf,
  checkoutReading,
  chooseRoom,
  looksLikeQuestion,
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

describe("monthAsked — with a year", () => {
  const t = new Date("2026-10-09T12:00:00");
  it("reads 'Jan 2027' as January 2027, and leaves 'Jan 20' a date", () => {
    const jan = monthAsked("anything in Jan 2027?", t)!;
    expect(jan[0]).toBe("2027-01-01");
    expect(jan).toHaveLength(31);
    expect(monthAsked("Jan 20", t)).toBeNull();
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

describe("a German guest answering TT's booking questions", () => {
  // TT asks German guests in German; before this, "ja" or "zu zweit" got the
  // same question asked again with no hint why.
  it("reads ja / nein", () => {
    expect(readYesNo("Ja")).toBe("yes");
    expect(readYesNo("ja, bitte")).toBe("yes");
    expect(readYesNo("passt")).toBe("yes");
    expect(readYesNo("Nein")).toBe("no");
    expect(readYesNo("abbrechen")).toBe("no");
    // An English word that starts like a German one is still not an answer.
    expect(readYesNo("jam")).toBe(null);
  });

  it("reads a party size in German", () => {
    expect(readParty("zu zweit")).toBe(2);
    expect(readParty("wir sind drei")).toBe(3);
    expect(readParty("nur ich")).toBe(1);
    expect(readParty("fünf")).toBe(5);
  });
});
describe("a German guest asking TT to book", () => {
  it("hears German booking words, and not a question about an existing booking", () => {
    expect(wantsToBook("Ich möchte King vom 5. bis 7. November buchen")).toBe(true);
    expect(wantsToBook("King reservieren, bitte")).toBe(true);
    expect(wantsToBook("Ich möchte meine Buchung stornieren")).toBe(false);
    expect(wantsToBook("Wie kann ich buchen?")).toBe(false);
  });

  it('offers the two-night reading of "5. bis 7." as it does of "Nov 5-7"', () => {
    const three = ["2026-11-05", "2026-11-06", "2026-11-07"];
    expect(checkoutReading("vom 5. bis 7. November", three)).toEqual(["2026-11-05", "2026-11-06"]);
    expect(checkoutReading("5.-7. November", three)).toEqual(["2026-11-05", "2026-11-06"]);
  });
});

describe("a Chinese guest booking through TT", () => {
  it("hears booking words, and not a question about an existing booking", () => {
    expect(wantsToBook("我想预订 King 11月5日到7日")).toBe(true);
    expect(wantsToBook("帮我订本周末")).toBe(true);
    expect(wantsToBook("我的预订在哪里")).toBe(false);
    expect(wantsToBook("我想取消预订")).toBe(false);
    expect(wantsToBook("怎么预订")).toBe(false);
  });

  it("reads a stay given by its length", () => {
    expect(readStay("11月3日住2晚", today)?.dates).toEqual(["2026-11-03", "2026-11-04"]);
    expect(readStay("11月3日住两晚", today)?.dates).toEqual(["2026-11-03", "2026-11-04"]);
    expect(readStay("11月1日住30晚", today)?.dates).toHaveLength(30);
    expect(readStay("11月3日住3天", today)?.dates).toHaveLength(3);
    expect(readStay("11月3日住一周", today)?.dates).toHaveLength(7);
  });

  it("does not count the night in 今晚 as a length", () => {
    expect(readStay("今晚", today)).toBeNull();
  });

  it("reads 退房 as the day they leave, so not a night", () => {
    expect(readStay("11月3日入住,11月5日退房", today)?.dates).toEqual(["2026-11-03", "2026-11-04"]);
  });

  it("offers the two-night reading of 10-12日 and 10日到12日", () => {
    const three = ["2026-11-10", "2026-11-11", "2026-11-12"];
    expect(checkoutReading("11月10-12日", three)).toEqual(["2026-11-10", "2026-11-11"]);
    expect(checkoutReading("11月10日到12日", three)).toEqual(["2026-11-10", "2026-11-11"]);
    expect(checkoutReading("11月10日、11日、12日", three)).toBeNull();
  });

  it("reads a month on its own, and not a month with a day or a number of months", () => {
    expect(monthAsked("12月", today)?.[0]).toBe("2026-12-01");
    expect(monthAsked("十二月份有空吗", today)?.[0]).toBe("2026-12-01");
    expect(monthAsked("2027年1月", today)?.[0]).toBe("2027-01-01");
    expect(monthAsked("12月3日", today)).toBeNull();
    expect(monthAsked("住3个月", today)).toBeNull();
  });

  it("reads a party size", () => {
    expect(readParty("2")).toBe(2);
    expect(readParty("2个人")).toBe(2);
    expect(readParty("两个人")).toBe(2);
    expect(readParty("两位")).toBe(2);
    expect(readParty("三个人")).toBe(3);
    expect(readParty("我们四个人")).toBe(4);
    expect(readParty("一共五人")).toBe(5);
    expect(readParty("就我一个人")).toBe(1);
    expect(readParty("我一个")).toBe(1);
    expect(readParty("我和朋友")).toBe(2);
    expect(readParty("我们俩")).toBe(2);
    expect(readParty("不知道")).toBeNull();
  });

  it("goes back to the question rather than guess at a party it cannot count", () => {
    expect(readParty("我和两个朋友")).toBeNull();
  });

  it("takes a name and a number out of one line", () => {
    expect(readContact("张伟,408 555 0123")).toEqual({ name: "张伟", phone: "408 555 0123" });
    expect(readContact("我叫张伟,电话是 408 555 0123")).toEqual({ name: "张伟", phone: "408 555 0123" });
    expect(readContact("我是李娜").name).toBe("李娜");
  });

  it("reads a plain yes and a plain no", () => {
    for (const a of ["好", "好的", "是的", "可以", "确认", "发送", "好的,谢谢"]) expect(readYesNo(a), a).toBe("yes");
    for (const a of ["不", "不用", "不用了", "取消", "算了", "不要了,谢谢"]) expect(readYesNo(a), a).toBe("no");
  });

  it("never takes a question for a yes", () => {
    // A yes at the read-back SENDS the request. 可以 (can) begins most questions.
    for (const a of ["可以取消吗", "可以取消吗?", "可以带狗吗", "好不好", "是不是要付款", "确认了吗"]) {
      expect(readYesNo(a), a).toBeNull();
    }
  });

  it("recognises a question by its full-width mark, or by 吗 alone", () => {
    expect(looksLikeQuestion("can I cancel later?")).toBe(true);
    expect(looksLikeQuestion("可以吗?")).toBe(true);
    expect(looksLikeQuestion("可以带狗吗")).toBe(true);
    expect(looksLikeQuestion("张伟")).toBe(false);
  });
});

describe("what a Chinese keyboard really types", () => {
  // Full-width punctuation, written as escapes so no editor can flatten it. The
  // first draft of these rules only knew the ASCII marks.
  const Q = "\uFF1F", C = "\uFF0C", X = "\uFF01";

  it("sees a full-width question mark", () => {
    expect(looksLikeQuestion(`可以${Q}`)).toBe(true);
    expect(looksLikeQuestion(`什么时候退款${Q}`)).toBe(true);
  });

  it("does not take a full-width question for a yes", () => {
    expect(readYesNo(`可以${Q}`)).toBeNull();
    expect(readYesNo(`可以取消吗${Q}`)).toBeNull();
  });

  it("reads full-width answers", () => {
    expect(readYesNo(`好的${X}`)).toBe("yes");
    expect(readYesNo(`好的${C}谢谢`)).toBe("yes");
    expect(readYesNo(`不用了${C}谢谢`)).toBe("no");
  });

  it("takes a name and number apart at a full-width comma", () => {
    expect(readContact(`张伟${C}408 555 0123`)).toEqual({ name: "张伟", phone: "408 555 0123" });
  });

  it("reads a check-out after a full-width comma", () => {
    expect(readStay(`11月3日入住${C}11月5日退房`, today)?.dates).toEqual(["2026-11-03", "2026-11-04"]);
  });
});

describe("a Chinese party answer that is no one number", () => {
  it("is asked again rather than taken", () => {
    expect(readParty("二三个")).toBeNull();
    expect(readParty("三个")).toBe(3);
  });
});
