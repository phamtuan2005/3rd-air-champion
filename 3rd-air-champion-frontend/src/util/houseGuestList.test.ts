import { describe, expect, it } from "vitest";
import { houseGuestList, isPhoneQuery, matchesTyped, topMatches } from "./houseGuestList";
import type { dayType } from "./types/dayType";
import type { guestType } from "./types/guestType";

// The calendar's Filter is a search box: the host types a room, a guest's
// name, or a phone number. These pin what a typed word finds, and that the
// answer stays short however many guests the house has had.

const TODAY = "2026-10-02";
const guest = (id: string, name: string, alias = "", phone = "") => ({ id, name, alias, phone }) as unknown as guestType;
const night = (key: string, entries: [string, string][]) =>
  [key, { id: key, date: key, isBlocked: false, blockedRooms: [], bookings: entries.map(([g, room]) => ({ guest: { id: g }, room: { id: room, name: room } })) } as unknown as dayType] as const;

describe("the house guests a search runs over", () => {
  const guests = [guest("s", "Susan", "", "(650) 416-9448"), guest("e", "Edward", "Eddie"), guest("p", "Past"), guest("n", "Never"), guest("ab", "AirBnB")];
  const map = new Map([
    night("2026-09-10", [["p", "Cozy"]]),
    night("2026-10-02", [["e", "King"]]),
    night("2026-10-19", [["s", "King"]]),
    night("2026-10-20", [["s", "King"], ["ab", "Queen"]]),
  ]);

  it("puts the next night from today first, then the most recent, then by name", () => {
    expect(houseGuestList(guests, map, TODAY).map((r) => r.name)).toEqual(["Eddie", "Susan", "Past", "Never"]);
  });

  it("leaves the AirBnB placeholder out, prefers a guest's alias, and carries their phone", () => {
    const rows = houseGuestList(guests, map, TODAY);
    expect(rows.find((r) => r.name === "AirBnB")).toBeUndefined();
    expect(rows[0]).toMatchObject({ name: "Eddie", next: "2026-10-02", room: "King" });
    expect(rows[1]).toMatchObject({ name: "Susan", phone: "(650) 416-9448" });
  });

  it("carries the room of the night it names", () => {
    const rows = houseGuestList(guests, map, TODAY);
    expect(rows.find((r) => r.name === "Past")).toMatchObject({ last: "2026-09-10", room: "Cozy" });
    expect(rows.find((r) => r.name === "Never")).toMatchObject({ room: "" });
  });
});

describe("what a typed word finds", () => {
  it("matches part of a name, whatever the case", () => {
    expect(matchesTyped("sus", "Susan")).toBe(true);
    expect(matchesTyped("SAN", "Susan")).toBe(true);
    expect(matchesTyped("eddie", "Susan")).toBe(false);
  });

  it("matches a phone number on its digits, however either was written", () => {
    expect(matchesTyped("650 416", "Susan", "(650) 416-9448")).toBe(true);
    expect(matchesTyped("(650)416-94", "Susan", "+1 650.416.9448")).toBe(true);
    expect(matchesTyped("9448", "Susan", "(650) 416-9448")).toBe(true);
    expect(matchesTyped("555", "Susan", "(650) 416-9448")).toBe(false);
  });

  // "2" typed on the way to a room, or "65", would otherwise bring back every
  // guest with those digits somewhere in their number.
  it("needs three digits before it reads a number as a phone", () => {
    expect(isPhoneQuery("65")).toBe(false);
    expect(matchesTyped("65", "Susan", "(650) 416-9448")).toBe(false);
    expect(isPhoneQuery("650")).toBe(true);
  });

  it("does not search phones for a word that merely contains digits", () => {
    expect(isPhoneQuery("room 650")).toBe(false);
    expect(matchesTyped("susan 650", "Susan", "(650) 416-9448")).toBe(false);
  });

  it("finds nothing for an empty box", () => {
    expect(matchesTyped("", "Susan", "(650) 416-9448")).toBe(false);
    expect(matchesTyped("   ", "Susan")).toBe(false);
  });
});

describe("how much a search draws", () => {
  // A thousand guests: the answer is still a handful.
  const rows = Array.from({ length: 1000 }, (_, i) => ({ id: `g${i}`, name: i % 250 === 0 ? `Susan ${i}` : `Guest ${i}` }));

  it("never returns more than the limit, and says how many matched", () => {
    const { shown, total } = topMatches(rows, (r) => matchesTyped("guest", r.name), 8);
    expect(shown).toHaveLength(8);
    expect(total).toBe(996);
  });

  it("keeps the order it was given, so the likeliest guest stays first", () => {
    const { shown } = topMatches(rows, (r) => matchesTyped("susan", r.name), 8);
    expect(shown.map((r) => r.id)).toEqual(["g0", "g250", "g500", "g750"]);
  });
});
