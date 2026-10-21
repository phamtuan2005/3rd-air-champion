import { praiseFor, reviewsForCleaner, workWords, CleanerReview, ReviewRow } from "../cleanerReviews";

// A cleaner reads these as "the guest after your clean said this". Pinned
// because handing one cleaner praise for another's visit is worse than showing
// nothing: it is the same person who did the work going unthanked.

const HENRY = "henry";
const MAI = "mai";
const clean = (date: string, cleaner: string, room = "k") => ({
  date,
  room: { _id: room, name: room === "k" ? "King" : "Queen", color: "" },
  cleaner: { _id: cleaner, name: cleaner },
});
const review = (o: Partial<ReviewRow>): ReviewRow => ({
  id: "r1",
  room: "k",
  stayDate: "2026-09-10",
  stars: 5,
  text: "Spotless room.",
  guestName: "Sarah Johnson",
  ...o,
});

describe("reviewsForCleaner", () => {
  it("credits the clean that prepared the stay, dated by that clean", () => {
    const out = reviewsForCleaner(HENRY, [review({})], [clean("2026-09-10", HENRY)]);
    expect(out).toEqual([
      expect.objectContaining({ cleanDate: "2026-09-10", stayDate: "2026-09-10", roomName: "King", stars: 5 }),
    ]);
  });

  it("counts a clean the day before arrival", () => {
    expect(reviewsForCleaner(HENRY, [review({})], [clean("2026-09-09", HENRY)])).toHaveLength(1);
  });

  it("gives the stay to the LATEST clean, not to the turnover for the guest before", () => {
    // Mai cleaned the 9th for the previous guest; Henry the 10th for this one.
    const rota = [clean("2026-09-09", MAI), clean("2026-09-10", HENRY)];
    expect(reviewsForCleaner(HENRY, [review({})], rota)).toHaveLength(1);
    expect(reviewsForCleaner(MAI, [review({})], rota)).toHaveLength(0);
  });

  it("does not credit a clean of a different room", () => {
    expect(reviewsForCleaner(HENRY, [review({})], [clean("2026-09-10", HENRY, "q")])).toHaveLength(0);
  });

  it("leaves out reviews under 4 stars, with no stars, or with only a month", () => {
    const rota = [clean("2026-09-10", HENRY)];
    expect(reviewsForCleaner(HENRY, [review({ stars: 3 })], rota)).toHaveLength(0);
    expect(reviewsForCleaner(HENRY, [review({ stars: null })], rota)).toHaveLength(0);
    expect(reviewsForCleaner(HENRY, [review({ stayDate: "" })], rota)).toHaveLength(0);
  });

  it("shows the guest's first name only", () => {
    expect(reviewsForCleaner(HENRY, [review({})], [clean("2026-09-10", HENRY)])[0].guestFirstName).toBe("Sarah");
  });

  it("shows a good review that says nothing about the cleaning, with no work words", () => {
    // Used to be left out. Henry prepared four rooms for 2026-10-16 and saw
    // two reviews; the reviews are public on AirBnB anyway (host, 2026-10-19).
    const rota = [clean("2026-09-10", HENRY)];
    const out = reviewsForCleaner(HENRY, [review({ text: "Comfortable bed and a quiet street. Great location!" })], rota);
    expect(out).toHaveLength(1);
    expect(out[0].workWords).toEqual([]);
  });

  it("says which words tie the review to the work", () => {
    const rota = [clean("2026-09-10", HENRY)];
    const [r] = reviewsForCleaner(HENRY, [review({ text: "Fluffy towels, the bed was made and it smelled so fresh." })], rota);
    expect(r.workWords).toEqual(["Fluffy towels", "bed was made", "smelled so fresh"]);
  });
});

describe("workWords", () => {
  it("finds the cleaning work in the words guests use", () => {
    expect(workWords("Immaculate! The bathroom was sparkling.")).toEqual(["Immaculate", "sparkling"]);
    expect(workWords("Not a speck of dust anywhere.")).toEqual(["Not a speck of dust"]);
    expect(workWords("Everything was tidy and ready for us.")).toEqual(["tidy"]);
  });

  it("does not take the room, the bed or the house for the work", () => {
    expect(workWords("Lovely room, comfy bed, beautiful house, great host.")).toEqual([]);
  });

  it("finds no praise in a good review that complains about the cleaning", () => {
    // Four stars, and "cleaner" was being bolded as praise for the visit.
    expect(workWords("Great stay, but the room could have been cleaner.")).toEqual([]);
    expect(workWords("Nice host, room wasn't very clean though.")).toEqual([]);
    expect(workWords("Not clean when we arrived.")).toEqual([]);
    expect(workWords("Clean room but the towels were missing.")).toEqual([]);
    expect(workWords("Tidy, but there were no towels.")).toEqual([]);
    expect(workWords("Clean overall, a stained pillow.")).toEqual([]);
    expect(workWords("Mostly tidy, the bathroom was a bit dusty.")).toEqual([]);
  });

  it("still finds praise that only sounds like a complaint", () => {
    expect(workWords("Not only clean but spotless.")).toEqual(["clean", "spotless"]);
    expect(workWords("Clean, no stains anywhere.")).toEqual(["Clean"]);
    expect(workWords("Nothing dirty, everything tidy.")).toEqual(["tidy"]);
    expect(workWords("Spotless, not dusty at all.")).toEqual(["Spotless"]);
  });
});

describe("praiseFor", () => {
  const r = (cleanDate: string, stars = 5): CleanerReview => ({
    id: cleanDate, cleanDate, stayDate: cleanDate, roomName: "King", roomColor: "", guestFirstName: "A", stars, text: "", workWords: ["clean"],
  });

  it("congratulates three good reviews within sixty days", () => {
    expect(praiseFor([r("2026-10-01"), r("2026-09-20", 4), r("2026-08-20")], "2026-10-16")).toEqual({ count: 3, fiveStars: 2, days: 60 });
  });

  it("stays quiet for two, or when the third is older than sixty days", () => {
    expect(praiseFor([r("2026-10-01"), r("2026-09-20")], "2026-10-16")).toBeNull();
    expect(praiseFor([r("2026-10-01"), r("2026-09-20"), r("2026-08-01")], "2026-10-16")).toBeNull();
  });

  it("counts only reviews about the work — a general 'great stay' is shown, not counted", () => {
    const general = { ...r("2026-10-05"), workWords: [] };
    expect(praiseFor([r("2026-10-01"), r("2026-09-20"), general], "2026-10-16")).toBeNull();
  });
});
