import { describe, expect, it } from "vitest";
import { fillRate, habitOf, habitsOf, lastStayOffer, proposalsFor, proposalsForAll, seriesFor, upcomingStarts } from "./bookingHabit";

// TiBook works a returning guest's habit out and proposes the next stays that
// fit it. These pin that it reads the habit a person would, never invents one
// from a single stay, never proposes a room the guest has not used, and never
// counts a night it cannot see as free.

// Wednesday Oct 7 2026.
const today = new Date("2026-10-07T12:00:00");
const stay = (start: string, nights: number, roomId: string) => ({ start, nights, roomId });

describe("habitOf", () => {
  it("reads Monday, four nights, King-first from three such stays", () => {
    const h = habitOf(
      [stay("2026-09-07", 4, "king"), stay("2026-09-14", 4, "king"), stay("2026-09-21", 4, "cute"), stay("2026-08-01", 1, "queen")],
      today,
    )!;
    expect(h).toMatchObject({ startWeekday: 1, nights: 4, times: 3 });
    expect(h.rooms.slice(0, 2)).toEqual(["king", "cute"]);
  });

  it("is no habit from one stay, or from a routine that stopped long ago", () => {
    expect(habitOf([stay("2026-09-07", 4, "king")], today)).toBeNull();
    expect(habitOf([stay("2025-11-03", 4, "king"), stay("2025-11-10", 4, "king")], today)).toBeNull();
  });

  it("breaks a tie toward the shape booked most recently", () => {
    const h = habitOf(
      [stay("2026-08-03", 2, "chill"), stay("2026-08-10", 2, "chill"), stay("2026-09-17", 1, "cozy"), stay("2026-09-24", 1, "cozy")],
      today,
    )!;
    expect(h).toMatchObject({ startWeekday: 4, nights: 1 });
    expect(h.rooms[0]).toBe("cozy");
  });
});

describe("upcomingStarts", () => {
  it("lists the next Mondays after today, never today itself", () => {
    const h = { startWeekday: 1, nights: 4, rooms: ["king"], times: 3 };
    expect(upcomingStarts(h, today, 3)).toEqual(["2026-10-12", "2026-10-19", "2026-10-26"]);
    // On a Monday the first is the NEXT Monday — tonight is not a booking ahead.
    expect(upcomingStarts(h, new Date("2026-10-12T12:00:00"), 1)).toEqual(["2026-10-19"]);
  });
});

describe("proposalsFor and fillRate", () => {
  const h = { startWeekday: 1, nights: 2, rooms: ["king", "cute"], times: 3 };
  // King taken Oct 12-13 and Oct 26; Cute free; nothing known past Nov 8.
  const takenKing = new Set(["2026-10-12", "2026-10-13", "2026-10-26"]);
  const isFree = (room: string, night: string) =>
    night > "2026-11-08" ? null : room === "king" ? !takenKing.has(night) : true;

  it("offers the usual room where free, the next room they use where not, and says which", () => {
    const out = proposalsFor(h, today, isFree, [], { max: 3 });
    expect(out.map((p) => [p.start, p.roomId, p.usualRoom])).toEqual([
      ["2026-10-12", "cute", false],
      ["2026-10-19", "king", true],
      ["2026-10-26", "cute", false],
    ]);
    expect(out[1].nights).toEqual(["2026-10-19", "2026-10-20"]);
  });

  it("skips a week the guest already has a stay in, and offers another free room only when given one", () => {
    const out = proposalsFor(h, today, isFree, [stay("2026-10-19", 2, "king")], { max: 2 });
    expect(out.map((p) => p.start)).toEqual(["2026-10-12", "2026-10-26"]);
    const onlyQueenFree = (room: string) => room === "queen";
    // Without other rooms to offer, nothing; with Queen among them (it holds the
    // party), Queen — the host's rule since 2026-10-07: a taken room means
    // another available room, not a missing week.
    expect(proposalsFor(h, today, onlyQueenFree, [], {})).toEqual([]);
    const withQueen = proposalsFor(h, today, onlyQueenFree, [], { max: 1, otherRooms: ["queen"] });
    expect(withQueen[0]).toMatchObject({ roomId: "queen", usualRoom: false });
  });

  it("never treats a night it cannot see as free", () => {
    const out = proposalsFor(h, today, isFree, [], { weeks: 8, max: 8 });
    expect(out.every((p) => p.start <= "2026-11-08")).toBe(true);
  });

  it("counts how many of the coming weeks the room is already taken, over weeks it can see", () => {
    expect(fillRate(h, "king", today, isFree, 8)).toEqual({ taken: 2, known: 4 });
  });
});

describe("a guest with two habits in a week (Monday and Thursday)", () => {
  const stays = [
    stay("2026-09-07", 1, "chill"), stay("2026-09-10", 1, "cozy"),
    stay("2026-09-14", 1, "chill"), stay("2026-09-17", 1, "cozy"),
    stay("2026-09-21", 1, "chill"), stay("2026-09-24", 1, "chill"),
  ];
  it("finds both habits — a tie (three each) led by the one booked most recently", () => {
    const hs = habitsOf(stays, today);
    expect(hs.map((h) => [h.startWeekday, h.nights])).toEqual([[4, 1], [1, 1]]);
    // Monday's room is ranked over every stay: Chill, used most.
    expect(hs[1].rooms[0]).toBe("chill");
  });
  it("proposes from both, soonest first", () => {
    const out = proposalsForAll(habitsOf(stays, today), today, () => true, [], { max: 4 });
    expect(out.map((p) => p.start)).toEqual(["2026-10-08", "2026-10-12", "2026-10-15", "2026-10-19"]);
  });
});

describe("seriesFor — regulars book months ahead", () => {
  // Rostam: Monday, 4 nights, every week, already booked to the end of Jan 2027.
  const rostamStays = Array.from({ length: 17 }, (_, i) => {
    const d = new Date(2026, 9, 12 + 7 * i); // Mondays from Oct 12 2026
    const k = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
    return stay(k, 4, "king");
  });
  const past = [stay("2026-09-21", 4, "king"), stay("2026-09-28", 4, "king")];

  it("lines up the three months after the last booked stay (Feb 1 2027 → through May)", () => {
    const habits = habitsOf([...past, ...rostamStays], today);
    const s = seriesFor(habits, today, () => true, [...past, ...rostamStays]);
    expect(s.lastBooked).toBe("2027-02-04"); // the Feb 1 stay's last night
    expect(s.until).toBe("2027-05-31");
    expect(s.proposals[0].start).toBe("2027-02-08");
    expect(s.proposals.every((p) => p.roomId === "king")).toBe(true);
    expect(s.proposals.every((p) => p.nights[p.nights.length - 1] <= "2027-05-31")).toBe(true);
  });

  it("offers a week left open inside their run as well", () => {
    const withGap = rostamStays.filter((st) => st.start !== "2026-11-23");
    const habits = habitsOf([...past, ...withGap], today);
    const s = seriesFor(habits, today, () => true, [...past, ...withGap]);
    expect(s.proposals[0].start).toBe("2026-11-23");
  });

  it("starts from today for a guest with nothing booked ahead, and leaves out weeks no room of theirs is free", () => {
    const h = { startWeekday: 1, nights: 2, rooms: ["king"], times: 3 };
    const s = seriesFor([h], today, (_r, night) => night !== "2026-10-19", [], 1);
    expect(s.lastBooked).toBeNull();
    expect(s.until).toBe("2026-11-30");
    expect(s.proposals.map((p) => p.start)).not.toContain("2026-10-19");
    expect(s.proposals[0].start).toBe("2026-10-12");
  });
});

describe("a week booked only in part", () => {
  // Tuesday and Wednesday nights, Chill first.
  const h = { startWeekday: 2, nights: 2, rooms: ["chill", "cute"], times: 3 };

  it("offers the night left, in the room they already have that week", () => {
    // They hold Tuesday Oct 13 in Cute (not their usual): Wednesday comes in Cute too.
    const out = proposalsFor(h, today, () => true, [stay("2026-10-13", 1, "cute")], { weeks: 1, max: 3 });
    expect(out).toEqual([
      { start: "2026-10-14", nights: ["2026-10-14"], roomId: "cute", usualRoom: false, completes: [2], theirRoom: "cute" },
    ]);
  });

  it("moves to another of their rooms only when that room is taken", () => {
    const cuteTakenWed = (room: string, night: string) => !(room === "cute" && night === "2026-10-14");
    const out = proposalsFor(h, today, cuteTakenWed, [stay("2026-10-13", 1, "cute")], { weeks: 1 });
    expect(out[0]).toMatchObject({ nights: ["2026-10-14"], roomId: "chill", completes: [2], theirRoom: "cute" });
  });

  it("offers the nights either side of a held middle as separate stays", () => {
    const monThu = { startWeekday: 1, nights: 4, rooms: ["king"], times: 3 };
    const out = proposalsFor(monThu, today, () => true, [stay("2026-10-13", 2, "king")], { weeks: 1, max: 5 });
    expect(out.map((p) => p.nights)).toEqual([["2026-10-12"], ["2026-10-15"]]);
  });

  it("still skips a week they hold in full", () => {
    expect(proposalsFor(h, today, () => true, [stay("2026-10-13", 2, "chill")], { weeks: 1 })).toEqual([]);
  });
});

describe("a usual week no room can take whole — Sean, Mon–Thu in King", () => {
  // From the host's calendar, Nov 2026: King is Shuhui's Mon–Thu both weeks;
  // every room is taken on Tuesday; Cute is free Mon, Wed, Thu of the 2nd week.
  const sean = { startWeekday: 1, nights: 4, rooms: ["king"], times: 3 };
  const today = new Date("2026-11-01T12:00:00"); // a Sunday
  const taken: Record<string, string[]> = {
    king: ["2026-11-02", "2026-11-03", "2026-11-04", "2026-11-05", "2026-11-09", "2026-11-10", "2026-11-11", "2026-11-12"],
    cute: ["2026-11-03", "2026-11-04", "2026-11-10"],
    queen: ["2026-11-02", "2026-11-03", "2026-11-04", "2026-11-09", "2026-11-10"],
  };
  const isFree = (room: string, night: string) => !(taken[room] ?? []).includes(night);

  it("offers the nights of his week that are free, says the full one, and keeps neighbours in one room", () => {
    const out = proposalsFor(sean, today, isFree, [], { weeks: 2, max: 10, otherRooms: ["cute", "queen"] });
    expect(out.map((p) => [p.nights.join(","), p.roomId, p.full])).toEqual([
      ["2026-11-02", "cute", [2, 3]],
      ["2026-11-05", "cute", [2, 3]],
      ["2026-11-09", "cute", [2]],
      ["2026-11-11,2026-11-12", "cute", [2]],
    ]);
  });

  it("still offers the whole week in one room when one has it", () => {
    const out = proposalsFor(sean, today, () => true, [], { weeks: 1, max: 5 });
    expect(out).toEqual([{ start: "2026-11-02", nights: ["2026-11-02", "2026-11-03", "2026-11-04", "2026-11-05"], roomId: "king", usualRoom: true }]);
  });
});

describe("lastStayOffer — a guest with no pattern yet", () => {
  it("takes their last stay as the example and offers the next weeks it is free", () => {
    // One stay: Fri Sep 18, 2 nights in King. Today Wed Oct 7.
    const o = lastStayOffer([stay("2026-09-18", 2, "king")], today, () => true)!;
    expect(o.habit).toMatchObject({ startWeekday: 5, nights: 2, rooms: ["king"] });
    expect(o.proposals.map((p) => p.start)).toEqual(["2026-10-09", "2026-10-16", "2026-10-23"]);
  });

  it("offers another free room when theirs is taken", () => {
    const o = lastStayOffer([stay("2026-09-18", 2, "king")], today, (r) => r === "cute", ["cute"])!;
    expect(o.proposals[0]).toMatchObject({ roomId: "cute", usualRoom: false });
  });

  it("stays quiet for a guest who already has a booking ahead, or whose last stay is over a year ago", () => {
    expect(lastStayOffer([stay("2026-09-18", 2, "king"), stay("2026-11-06", 2, "king")], today, () => true)).toBeNull();
    expect(lastStayOffer([stay("2025-08-01", 2, "king")], today, () => true)).toBeNull();
    expect(lastStayOffer([], today, () => true)).toBeNull();
  });
});

describe("back-to-back proposals in one room", () => {
  // Srinivas: a Tuesday habit and a Wednesday habit, both in Cute. Offered
  // apart they read "Nov 24 Tue, 1 night" and "Nov 25 Wed, 1 night".
  const tue = { startWeekday: 2, nights: 1, rooms: ["cute"], times: 3 };
  const wed = { startWeekday: 3, nights: 1, rooms: ["cute"], times: 3 };

  it("joins them into one stay", () => {
    const ps = proposalsForAll([tue, wed], today, () => true, [], { weeks: 2, max: 10 });
    expect(ps[0]).toMatchObject({ start: "2026-10-13", nights: ["2026-10-13", "2026-10-14"], roomId: "cute" });
  });

  it("keeps them apart when the rooms differ", () => {
    const ps = proposalsForAll([tue, wed], today, (r, n) => (n === "2026-10-14" ? r === "king" : r === "cute"), [], {
      weeks: 2,
      max: 10,
      otherRooms: ["king"],
    });
    expect(ps.find((p) => p.start === "2026-10-13")?.nights).toEqual(["2026-10-13"]);
    expect(ps.find((p) => p.start === "2026-10-14")?.roomId).toBe("king");
  });
});
