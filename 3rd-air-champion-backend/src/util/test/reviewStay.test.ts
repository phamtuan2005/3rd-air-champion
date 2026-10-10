import { checkoutWindow, findReviewedStay, StayRow } from "../reviewStay";

// Finding the stay a pasted review is about (host, 2026-10-10), so the stay
// date fills itself in. Each case is a way the wrong stay — or a stay that
// was not theirs — could be picked.

const han: StayRow = { start: "2026-09-28", end: "2026-10-01", name: "Han" };

describe("findReviewedStay", () => {
  it("finds the stay by first name and checkout month, and counts its nights", () => {
    expect(findReviewedStay([han], "Han", "2026-10")).toEqual({
      stayDate: "2026-09-28",
      checkout: "2026-10-01",
      nights: 3,
      guestId: undefined,
      others: 0,
    });
  });

  it("matches a guest-list name by its first word, any case, and carries the guest", () => {
    const listed = { start: "2026-10-02", end: "2026-10-04", name: "han Nguyen", guestId: "g1" };
    expect(findReviewedStay([listed], "Han", "2026-10")).toMatchObject({ stayDate: "2026-10-02", guestId: "g1" });
  });

  it("reaches back a month: a September checkout reviewed in early October", () => {
    expect(findReviewedStay([{ ...han, start: "2026-09-25", end: "2026-09-29" }], "Han", "2026-10")).toMatchObject({
      stayDate: "2026-09-25",
    });
  });

  it("never takes a stay that ended after the review was written, or long before", () => {
    expect(findReviewedStay([{ ...han, start: "2026-11-01", end: "2026-11-03" }], "Han", "2026-10")).toBeNull();
    expect(findReviewedStay([{ ...han, start: "2026-07-01", end: "2026-07-03" }], "Han", "2026-10")).toBeNull();
  });

  it("takes the most recent of several, and says there were others", () => {
    const earlier = { ...han, start: "2026-09-10", end: "2026-09-12" };
    expect(findReviewedStay([earlier, han], "Han", "2026-10")).toMatchObject({ stayDate: "2026-09-28", others: 1 });
  });

  it("finds nothing for another guest, no name, or no month", () => {
    expect(findReviewedStay([han], "Gail", "2026-10")).toBeNull();
    expect(findReviewedStay([han], "", "2026-10")).toBeNull();
    expect(findReviewedStay([han], "Han", "")).toBeNull();
  });
});

describe("checkoutWindow", () => {
  it("is the month before through the end of the review's month, across a year", () => {
    expect(checkoutWindow("2026-10")).toEqual({ from: "2026-09-01", to: "2026-10-31" });
    expect(checkoutWindow("2026-01")).toEqual({ from: "2025-12-01", to: "2026-01-31" });
  });
});
