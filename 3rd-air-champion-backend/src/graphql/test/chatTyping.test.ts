import { chatTypingResolvers, TYPING_WINDOW_MS } from "../resolvers/chatTyping";
import { createMockHost } from "../../model/test/util/mockHost";
import ChatTyping from "../../model/chatTypingSchema";

const setTyping = (args: any) =>
  (chatTypingResolvers.Mutation.setChatTyping as any)(null, args);

const hostFor = async (email: string) => String((await createMockHost(email))._id);

describe("who is typing", () => {
  it("reports a side as typing once it pings", async () => {
    const host = await hostFor("typing-basic@example.com");

    const afterGuest = await setTyping({
      host,
      phone: "4085551234",
      sender: "guest",
      typing: true,
    });
    expect(afterGuest.guestTyping).toBe(true);
    expect(afterGuest.hostTyping).toBe(false);

    const afterHost = await setTyping({
      host,
      phone: "4085551234",
      sender: "host",
      typing: true,
    });
    // The point of the single round trip: each side is told about the other.
    expect(afterHost.hostTyping).toBe(true);
    expect(afterHost.guestTyping).toBe(true);
  });

  it("stops reporting typing when the side says it stopped", async () => {
    const host = await hostFor("typing-stop@example.com");
    await setTyping({ host, phone: "4085551234", sender: "guest", typing: true });

    const after = await setTyping({
      host,
      phone: "4085551234",
      sender: "guest",
      typing: false,
    });
    expect(after.guestTyping).toBe(false);
    // "Not typing" is the absence of a row, so nothing is left behind.
    expect(await ChatTyping.countDocuments({ host })).toBe(0);
  });

  // The reason "is typing" is a timestamp rather than a boolean: a browser
  // closed mid-sentence never sends "I stopped", and a flag would leave the
  // other side watching a bubble forever.
  it("lets a stale ping expire on its own", async () => {
    const host = await hostFor("typing-stale@example.com");
    await setTyping({ host, phone: "4085551234", sender: "guest", typing: true });

    await ChatTyping.updateOne(
      { host, sender: "guest" },
      { at: new Date(Date.now() - TYPING_WINDOW_MS - 1000) },
    );

    // Someone else's ping is enough to read the state back.
    const state = await setTyping({
      host,
      phone: "4085551234",
      sender: "host",
      typing: false,
    });
    expect(state.guestTyping).toBe(false);
  });

  it("keeps a ping alive while it is being renewed", async () => {
    const host = await hostFor("typing-renew@example.com");
    await setTyping({ host, phone: "4085551234", sender: "guest", typing: true });
    await ChatTyping.updateOne(
      { host, sender: "guest" },
      { at: new Date(Date.now() - TYPING_WINDOW_MS + 2000) },
    );
    const state = await setTyping({
      host,
      phone: "4085551234",
      sender: "host",
      typing: false,
    });
    expect(state.guestTyping).toBe(true);
  });

  // The guest pings with the number they typed; the host's inbox pings with the
  // number as it was stored. Keyed on anything but the digits, those are two
  // conversations and neither side ever sees the other type.
  it("treats the same number written two ways as one conversation", async () => {
    const host = await hostFor("typing-phone@example.com");
    await setTyping({ host, phone: "4085551234", sender: "guest", typing: true });

    const seenByHost = await setTyping({
      host,
      phone: "(408) 555-1234",
      sender: "host",
      typing: true,
    });
    expect(seenByHost.guestTyping).toBe(true);
    expect(await ChatTyping.countDocuments({ host })).toBe(2); // one per side, not four
  });

  it("keeps one guest's typing out of another guest's conversation", async () => {
    const host = await hostFor("typing-isolation@example.com");
    await setTyping({ host, phone: "4085551234", sender: "guest", typing: true });

    const other = await setTyping({
      host,
      phone: "6505559999",
      sender: "host",
      typing: false,
    });
    expect(other.guestTyping).toBe(false);
  });

  it("refuses a sender that is neither the guest nor the host", async () => {
    const host = await hostFor("typing-sender@example.com");
    await expect(
      setTyping({ host, phone: "4085551234", sender: "admin", typing: true }),
    ).rejects.toThrow();
  });

  it("refuses a ping with no number to hang it on", async () => {
    const host = await hostFor("typing-nophone@example.com");
    await expect(
      setTyping({ host, phone: "---", sender: "guest", typing: true }),
    ).rejects.toThrow();
  });
});
