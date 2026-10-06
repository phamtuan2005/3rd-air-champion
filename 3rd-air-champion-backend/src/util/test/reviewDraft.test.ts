import { draftReviewSummaries, MAX_PASTE, reviewPrompt } from "../reviewDraft";

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
        { roomId: "k", summary: "Big bed." },
        { roomId: "c", summary: "" },
      ],
      reviewsRead: 3,
    });
  });

  it("says so when Claude declines, rather than publishing an empty draft", async () => {
    await expect(draftReviewSummaries(rooms, fakeClient({ stop_reason: "refusal", content: [] }))).rejects.toThrow(/declined/);
  });
});

describe("reviewPrompt", () => {
  it("cuts a very long paste per room, keeping the newest reviews AirBnB lists first", () => {
    const long = "A".repeat(MAX_PASTE) + "OLDEST";
    expect(reviewPrompt([{ roomId: "k", name: "King", text: long }])).not.toContain("OLDEST");
  });
});
