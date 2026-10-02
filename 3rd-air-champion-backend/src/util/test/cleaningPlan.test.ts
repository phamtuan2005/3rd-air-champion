import { addDays, startOfToday } from "date-fns";
import { dayType } from "../../shared/generated/util/types/dayType";
import { cleaningPlan, planCounts, PlanAssignment, UNASSIGNED } from "../cleaningPlan";

// What TT says when asked for the cleaning plan.
//
// It used to read the assignments table and repeat it. On 2026-10-02 that
// table put Henry on Cozy for a Saturday the Cozy guest was staying through,
// and was silent about three rooms that turned over with nobody on them. Each
// case below is one of the ways the table and the plan differ.

// Keys the way the rule itself makes them, so "three mornings from now" means
// the same morning here as it does inside getCleaningEntriesFor.
const key = (offset: number) => addDays(startOfToday(), offset).toISOString().split("T")[0];
const iso = (offset: number) => `${key(offset)}T00:00:00.000Z`;

// A stay is written onto every night it covers; `last` is its last NIGHT.
const stay = (map: Map<string, dayType>, roomId: string, first: number, last: number) => {
  for (let n = first; n <= last; n++) {
    const day =
      map.get(key(n)) ??
      ({ id: key(n), date: iso(n), isBlocked: false, blockedRooms: [], bookings: [] } as unknown as dayType);
    day.bookings.push({
      room: { id: roomId },
      startDate: iso(first),
      endDate: iso(last),
      reserved: false,
    } as unknown as dayType["bookings"][number]);
    map.set(key(n), day);
  }
};

const roomNames = new Map([
  ["king", "King"],
  ["cozy", "Cozy"],
  ["queen", "Queen"],
  ["cute", "Cute"],
]);

const on = (
  offset: number,
  roomId: string,
  cleaner: string,
  hours: number | null = null,
): PlanAssignment => ({ date: key(offset), roomId, room: roomNames.get(roomId) ?? "", cleaner, hours });

const planFor = (map: Map<string, dayType>, assignments: PlanAssignment[], from: number, to = from) =>
  cleaningPlan({ dayMap: map, assignments, from: key(from), to: key(to), roomNames });

describe("the cleaning plan TT reads", () => {
  it("lists a room whose guest leaves that morning, under whoever is assigned", () => {
    const map = new Map<string, dayType>();
    stay(map, "king", 1, 2); // last night is +2, so King turns over on +3
    const [day] = planFor(map, [on(3, "king", "Henry")], 3);
    expect(day.date).toBe(key(3));
    expect(day.rooms).toEqual([{ room: "King", cleaner: "Henry" }]);
  });

  // Sat Oct 10: Henry on Cozy, and the Cozy guest was not leaving.
  it("drops an assignment on a room nobody is leaving", () => {
    const map = new Map<string, dayType>();
    stay(map, "cozy", 1, 5); // still there on the morning of +3
    expect(planFor(map, [on(3, "cozy", "Henry")], 3)).toEqual([]);
  });

  // The plan is not always what happened. Hours on record are work that was
  // done and is paid for, whatever the calendar says now.
  it("keeps that assignment once hours are recorded against it", () => {
    const map = new Map<string, dayType>();
    stay(map, "cozy", -8, -2); // still there on the morning of -5
    const [day] = planFor(map, [on(-5, "cozy", "Henry", 2)], -5);
    expect(day.rooms).toEqual([{ room: "Cozy", cleaner: "Henry", hours: 2 }]);
  });

  // Tue Oct 6: Cute and Cozy turned over and the table had nobody on them.
  it("names a room that turns over with nobody on it", () => {
    const map = new Map<string, dayType>();
    stay(map, "queen", 2, 2);
    const [day] = planFor(map, [], 3);
    expect(day.rooms).toEqual([{ room: "Queen", cleaner: UNASSIGNED }]);
  });

  it("marks a clean with a guest arriving the same day", () => {
    const map = new Map<string, dayType>();
    stay(map, "queen", 2, 2);
    stay(map, "queen", 3, 4); // the next guest checks in on the cleaning day
    const [day] = planFor(map, [on(3, "queen", "Cindy")], 3);
    expect(day.rooms).toEqual([{ room: "Queen", cleaner: "Cindy", arrivalSameDay: true }]);
  });

  // An empty night before a booked arrival is expected to sell. That is a
  // forecast, and TT has to be able to say so rather than state it as booked.
  it("marks a clean that rests on a night expected to sell as likely", () => {
    const map = new Map<string, dayType>();
    stay(map, "cute", 4, 5); // arrives on +4; the night of +2 is empty
    const [day] = planFor(map, [on(3, "cute", "Cindy")], 3);
    expect(day.rooms).toEqual([{ room: "Cute", cleaner: "Cindy", likely: true }]);
  });

  it("leaves out a day with nothing to clean, and gives each day its weekday", () => {
    const map = new Map<string, dayType>();
    stay(map, "king", 1, 2);
    // +2: the guest is mid-stay. +4: the room is empty with nobody booked after.
    const days = planFor(map, [on(3, "king", "Henry")], 2, 4);
    expect(days.map((d) => d.date)).toEqual([key(3)]);
    const weekday = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"][
      new Date(`${key(3)}T12:00:00.000Z`).getUTCDay()
    ];
    expect(days[0].day).toBe(weekday);
  });

  // Twenty rows for Henry were headed "21 rooms". The sum travels with the
  // rows, so the model repeats it rather than working it out.
  it("counts the rooms, in all and per cleaner, so the model does not", () => {
    const map = new Map<string, dayType>();
    stay(map, "king", 1, 2);
    stay(map, "queen", 1, 2);
    stay(map, "cozy", 2, 2);
    const days = planFor(map, [on(3, "king", "Henry"), on(3, "queen", "Henry")], 3);
    expect(planCounts(days)).toEqual({ rooms: 3, byCleaner: { Henry: 2, [UNASSIGNED]: 1 } });
  });

  // No day records means the calendar could not be read, not an empty house.
  // Hiding a cleaner's morning on the strength of an empty query is the worse
  // mistake, so the table is passed through and nothing is invented.
  it("passes the assignments through when the calendar could not be read", () => {
    const days = planFor(new Map(), [on(3, "cozy", "Henry"), on(3, "king", "Henry")], 3);
    expect(days).toHaveLength(1);
    expect(days[0].rooms).toEqual([
      { room: "Cozy", cleaner: "Henry" },
      { room: "King", cleaner: "Henry" },
    ]);
  });
});
