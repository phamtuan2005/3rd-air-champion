import { draftReviewSummaries, reviewPrompt } from "../reviewDraft";

// The draft is the model's; what comes back into the house's records is ours.
// These pin the parts the model cannot be trusted with: which rooms there are,
// and what a refusal means.

const fakeClient = (reply: any) =>
  ({
    beta: {
      messages: {
        create: async () => reply,
      },
    },
  }) as any;

const rooms = [
  { roomId: "k", name: "King", text: "Lovely." },
  { roomId: "c", name: "Chill", text: "" },
];

describe("draftReviewSummaries", () => {
  it("returns one summary per room asked about, in order, and drops rooms the model made up", async () => {
    const reply = {
      stop_reason: "end_turn",
      content: [
        {
          type: "text",
          text: JSON.stringify({
            house: " Guests love it. ",
            rooms: [
              { roomId: "zzz", summary: "Not a room" },
              { roomId: "k", summary: "Big bed." },
            ],
            reviewsRead: 3,
          }),
        },
      ],
    };
    const draft = await draftReviewSummaries(rooms, fakeClient(reply));
    expect(draft).toEqual({
      house: "Guests love it.",
      rooms: [
        { roomId: "k", summary: "Big bed.", latest: "", latestMonth: "", latestStars: null },
        { roomId: "c", summary: "", latest: "", latestMonth: "", latestStars: null },
      ],
      reviewsRead: 3,
    });
  });

  it("takes a latest-review summary only for a room that has a dated newest review, with the record's month and stars", async () => {
    const reply = {
      stop_reason: "end_turn",
      content: [
        {
          type: "text",
          text: JSON.stringify({
            house: "",
            rooms: [
              { roomId: "k", summary: "Big bed.", latest: " The latest guest found it spotless. " },
              // Chill had no <latest-review>; a latest the model wrote anyway has no month to show with.
              { roomId: "c", summary: "", latest: "Made up." },
            ],
            reviewsRead: 2,
          }),
        },
      ],
    };
    const withLatest = [{ ...rooms[0], latest: { text: "Spotless!", month: "2026-09", stars: 5 } }, rooms[1]];
    const draft = await draftReviewSummaries(withLatest, fakeClient(reply));
    expect(draft.rooms).toEqual([
      { roomId: "k", summary: "Big bed.", latest: "The latest guest found it spotless.", latestMonth: "2026-09", latestStars: 5 },
      { roomId: "c", summary: "", latest: "", latestMonth: "", latestStars: null },
    ]);
  });

  it("says so when Claude declines, rather than publishing an empty draft", async () => {
    await expect(draftReviewSummaries(rooms, fakeClient({ stop_reason: "refusal", content: [] }))).rejects.toThrow(/declined/);
  });
});

describe("reviewPrompt", () => {
  it("sends a very long paste whole — the oldest reviews are read too", () => {
    const long = "A".repeat(500_000) + "OLDEST";
    expect(reviewPrompt([{ roomId: "k", name: "King", text: long }])).toContain("OLDEST");
  });

  it("hands the newest review over on its own, marked, so the model does not pick one", () => {
    const prompt = reviewPrompt([{ roomId: "k", name: "King", text: "all", latest: { text: "Newest words", month: "2026-09", stars: 4 } }]);
    expect(prompt).toContain('<latest-review month="2026-09" stars="4">\nNewest words\n</latest-review>');
  });

  it("never hands the reviewer's name to the draft — a summary names no one", () => {
    const prompt = reviewPrompt([{ roomId: "k", name: "King", text: "all", latest: { text: "Newest words", month: "2026-09", stars: 4, firstName: "Gail" } }]);
    expect(prompt).not.toContain("Gail");
  });
});
