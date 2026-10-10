import { cleaningWindow, latestPerRoom, lowReviews, roomAverages, topicMentions, ReviewRow } from "../reviewStats";

// The arithmetic the host reads as fact. Pinned because a wrong average on a
// screen about whom to thank, or whom to speak to, is a person's reputation.

const row = (o: Partial<ReviewRow>): ReviewRow => ({
  room: "k",
  roomName: "King",
  guestName: "A",
  stars: 5,
  stayDate: "",
  reviewMonth: "",
  text: "Nice.",
  ...o,
});

describe("roomAverages", () => {
  it("averages only the reviews that have stars, and says how many that was", () => {
    const [king] = roomAverages([row({ stars: 5 }), row({ stars: 4 }), row({ stars: null }), row({ stars: 3 })]);
    expect(king).toMatchObject({ name: "King", reviews: 4, withStars: 3, average: 4 });
  });

  it("rounds to two decimals and has no average for a room with no stars at all", () => {
    const out = roomAverages([row({ stars: 5 }), row({ stars: 5 }), row({ stars: 4 }), row({ room: "q", roomName: "Queen", stars: null })]);
    expect(out.find((r) => r.name === "King")!.average).toBe(4.67);
    expect(out.find((r) => r.name === "Queen")!.average).toBeNull();
  });

  it("lists rooms by name", () => {
    expect(roomAverages([row({ room: "q", roomName: "Queen" }), row({}), row({ room: "c", roomName: "Cozy" })]).map((r) => r.name)).toEqual(["Cozy", "King", "Queen"]);
  });
});

describe("lowReviews", () => {
  it("keeps 3 stars and under, not the unrated, newest first", () => {
    const out = lowReviews([
      row({ guestName: "old", stars: 2, reviewMonth: "2025-01" }),
      row({ guestName: "new", stars: 3, stayDate: "2026-09-20" }),
      row({ guestName: "fine", stars: 5, stayDate: "2026-09-25" }),
      row({ guestName: "unrated", stars: null, stayDate: "2026-09-26" }),
      row({ guestName: "undated", stars: 1 }),
    ]);
    expect(out.map((r) => r.guestName)).toEqual(["new", "old", "undated"]);
  });

  it("stops at the limit", () => {
    expect(lowReviews(Array.from({ length: 30 }, () => row({ stars: 1 })), 3, 12)).toHaveLength(12);
  });
});

describe("cleaningWindow", () => {
  it("is the night before and the night of a stay, when the start is known", () => {
    expect(cleaningWindow(row({ stayDate: "2026-03-01" }))).toEqual({ start: "2026-02-28", end: "2026-03-01" });
    expect(cleaningWindow(row({ stayDate: "2026-01-01" }))).toEqual({ start: "2025-12-31", end: "2026-01-01" });
  });

  it("is the whole month when only the month is known, including a leap February", () => {
    expect(cleaningWindow(row({ reviewMonth: "2026-09" }))).toEqual({ start: "2026-09-01", end: "2026-09-30" });
    expect(cleaningWindow(row({ reviewMonth: "2024-02" }))).toEqual({ start: "2024-02-01", end: "2024-02-29" });
  });

  it("is nothing without a date — no date, no lead", () => {
    expect(cleaningWindow(row({}))).toBeNull();
  });
});

describe("topicMentions", () => {
  it("counts reviews per room that mention the topic, by any of its words", () => {
    const out = topicMentions(
      [
        row({ text: "Spotless room and very quiet." }),
        row({ text: "The bed was comfy." }),
        row({ room: "q", roomName: "Queen", text: "Clean, tidy and fresh." }),
        row({ room: "q", roomName: "Queen", text: "Clean enough." }),
      ],
      "clean",
    )!;
    expect(out.rooms).toEqual([
      { room: "q", name: "Queen", count: 2 },
      { room: "k", name: "King", count: 1 },
    ]);
    expect(out.snippets[0].snippet).toContain("Spotless");
  });

  it("does not match inside another word", () => {
    expect(topicMentions([row({ text: "We parked easily." })], "parking")!.rooms).toEqual([]);
  });

  it("knows only the topics it lists", () => {
    expect(topicMentions([row({})], "politics")).toBeNull();
  });
});

describe("latestPerRoom", () => {
  // One per room, in room order (host, 2026-10-10): the five newest in the
  // house could all be one busy room's.
  it("gives each room its newest dated review, any stars, rooms in order", () => {
    const out = latestPerRoom([
      row({ room: "k", roomName: "King", guestName: "k-old", stars: 2, reviewMonth: "2025-01" }),
      row({ room: "k", roomName: "King", guestName: "k-new", stars: 4, stayDate: "2026-09-20" }),
      row({ room: "c", roomName: "Cozy", guestName: "c-undated", stars: 5 }),
      row({ room: "c", roomName: "Cozy", guestName: "c-new", stars: 5, reviewMonth: "2026-10" }),
      row({ room: "q", roomName: "Queen", guestName: "q-undated", stars: 5 }),
    ]);
    expect(out.map((r) => r.guestName)).toEqual(["c-new", "k-new"]);
  });
});
