import { guestMessageResolvers } from "../resolvers/guestMessage";
import { createMockHost } from "../../model/test/util/mockHost";
import GuestMessage from "../../model/guestMessageSchema";

const send = (args: any) =>
  (guestMessageResolvers.Mutation.sendGuestMessage as any)(null, args);
const markRead = (args: any) =>
  (guestMessageResolvers.Mutation.markGuestMessagesRead as any)(null, args);
const thread = (args: any) =>
  (guestMessageResolvers.Query.guestMessages as any)(null, args);
const threads = (args: any) =>
  (guestMessageResolvers.Query.guestMessageThreads as any)(null, args);
const deleteThread = (args: any) =>
  (guestMessageResolvers.Mutation.deleteGuestThread as any)(null, args);

const hostFor = async (email: string) => {
  const host = await createMockHost(email);
  return String(host._id);
};

describe("guest messages — who has read what", () => {
  it("marks a message read for whoever wrote it, and unread for the other side", async () => {
    const host = await hostFor("read-state@example.com");

    const fromGuest = await send({
      host,
      guestName: "Mai",
      guestPhone: "4085551234",
      sender: "guest",
      body: "Is there parking?",
    });
    expect(fromGuest.readByGuest).toBe(true);
    expect(fromGuest.readByHost).toBe(false);

    const fromHost = await send({
      host,
      guestName: "Mai",
      guestPhone: "4085551234",
      sender: "host",
      body: "Yes — two spots on the driveway.",
    });
    expect(fromHost.readByHost).toBe(true);
    expect(fromHost.readByGuest).toBe(false);
  });

  // The reason readByHost and readByGuest are two flags rather than one "read".
  // With one, a guest opening their own thread would clear the host's badge and
  // a question would sit unanswered with nothing on screen saying so.
  it("a guest reading their thread does not clear what is waiting for the host", async () => {
    const host = await hostFor("guest-read@example.com");
    await send({
      host,
      guestName: "Mai",
      guestPhone: "4085551234",
      sender: "guest",
      body: "Can I check in late?",
    });

    await markRead({ hostId: host, phone: "4085551234", reader: "guest" });

    const stillWaiting = await GuestMessage.find({ host, readByHost: false });
    expect(stillWaiting).toHaveLength(1);
    expect(stillWaiting[0].body).toBe("Can I check in late?");
  });

  it("the host reading clears only the guest's messages, not their own", async () => {
    const host = await hostFor("host-read@example.com");
    await send({
      host,
      guestName: "Mai",
      guestPhone: "4085551234",
      sender: "guest",
      body: "Any parking?",
    });
    await send({
      host,
      guestName: "Mai",
      guestPhone: "4085551234",
      sender: "host",
      body: "Two spots.",
    });

    const marked = await markRead({ hostId: host, phone: "4085551234", reader: "host" });
    expect(marked).toBe(1);

    const rows = await thread({ hostId: host, phone: "4085551234" });
    const guestMsg = rows.find((r: any) => r.sender === "guest");
    const hostMsg = rows.find((r: any) => r.sender === "host");
    expect(guestMsg.readByHost).toBe(true);
    // The host's own reply is still unread BY THE GUEST — that is the flag the
    // badge on the floating button in TiBook counts.
    expect(hostMsg.readByGuest).toBe(false);
  });
});

describe("guest messages — finding the same guest", () => {
  // Phones are stored however they were typed. A guest who wrote from the chat
  // sheet as "4085551234" and booked as "(408) 555-1234" is one person, and
  // this is the rule the rest of TiBook already matches guests by.
  it("matches a thread however the number was written", async () => {
    const host = await hostFor("phone-shapes@example.com");
    await send({
      host,
      guestName: "Mai",
      guestPhone: "(408) 555-1234",
      sender: "guest",
      body: "Hello!",
    });

    const rows = await thread({ hostId: host, phone: "4085551234" });
    expect(rows).toHaveLength(1);
    expect(rows[0].body).toBe("Hello!");
  });

  it("groups one guest into one inbox row even across differently typed numbers", async () => {
    const host = await hostFor("grouping@example.com");
    await send({
      host,
      guestName: "Mai",
      guestPhone: "4085551234",
      sender: "guest",
      body: "First question",
    });
    await send({
      host,
      guestName: "Mai Nguyen",
      guestPhone: "(408) 555-1234",
      sender: "guest",
      body: "Second question",
    });

    const rows = await threads({ hostId: host });
    expect(rows).toHaveLength(1);
    expect(rows[0].total).toBe(2);
    expect(rows[0].unreadForHost).toBe(2);
    expect(rows[0].lastBody).toBe("Second question");
    // The freshest name they signed with.
    expect(rows[0].guestName).toBe("Mai Nguyen");
  });

  it("keeps different guests apart and puts the most recent first", async () => {
    const host = await hostFor("ordering@example.com");
    await send({
      host,
      guestName: "Mai",
      guestPhone: "4085551234",
      sender: "guest",
      body: "From Mai",
    });
    await send({
      host,
      guestName: "Sam",
      guestPhone: "6505559999",
      sender: "guest",
      body: "From Sam",
    });

    const rows = await threads({ hostId: host });
    expect(rows).toHaveLength(2);
    expect(rows[0].guestName).toBe("Sam");
    expect(rows[1].guestName).toBe("Mai");
  });

  it("does not leak one host's messages into another host's inbox", async () => {
    const hostA = await hostFor("host-a@example.com");
    const hostB = await hostFor("host-b@example.com");
    await send({
      host: hostA,
      guestName: "Mai",
      guestPhone: "4085551234",
      sender: "guest",
      body: "For A only",
    });

    expect(await threads({ hostId: hostB })).toHaveLength(0);
    expect(await thread({ hostId: hostB, phone: "4085551234" })).toHaveLength(0);
  });
});

describe("guest messages — what will not be stored", () => {
  it("refuses an empty message", async () => {
    const host = await hostFor("empty@example.com");
    await expect(
      send({ host, guestName: "Mai", guestPhone: "4085551234", sender: "guest", body: "   " }),
    ).rejects.toThrow();
  });

  it("refuses a sender that is neither the guest nor the host", async () => {
    const host = await hostFor("bad-sender@example.com");
    await expect(
      send({ host, guestName: "Mai", guestPhone: "4085551234", sender: "admin", body: "hi" }),
    ).rejects.toThrow();
  });

  it("trims what it stores", async () => {
    const host = await hostFor("trim@example.com");
    const saved = await send({
      host,
      guestName: "Mai",
      guestPhone: "4085551234",
      sender: "guest",
      body: "  spaces either side  ",
    });
    expect(saved.body).toBe("spaces either side");
  });
});

describe("guest messages — removing a conversation", () => {
  it("removes every message in the thread and leaves the other guests alone", async () => {
    const host = await hostFor("delete-thread@example.com");

    await send({ host, guestName: "Mai", guestPhone: "4085551234", sender: "guest", body: "Is there parking?" });
    await send({ host, guestName: "Mai", guestPhone: "(408) 555-1234", sender: "host", body: "Two spots." });
    await send({ host, guestName: "Linh", guestPhone: "6505559999", sender: "guest", body: "Early check-in?" });

    // Written one way, deleted the other — the same guest either way, exactly
    // as the inbox list groups them.
    const deleted = await deleteThread({ hostId: host, phone: "408-555-1234" });
    expect(deleted).toBe(2);

    expect(await thread({ hostId: host, phone: "4085551234" })).toHaveLength(0);
    expect(await thread({ hostId: host, phone: "6505559999" })).toHaveLength(1);

    const remaining = await threads({ hostId: host });
    expect(remaining).toHaveLength(1);
    expect(remaining[0].guestName).toBe("Linh");
  });

  // The reason this does not reuse phoneMatcher. That regex is unanchored, so
  // the digits of a ten-digit number sit inside an eleven-digit one with a
  // country code and it would delete both guests at once. A read showing an
  // extra thread is a nuisance; a delete taking one is unrecoverable.
  it("does not take a longer number that merely contains the same digits", async () => {
    const host = await hostFor("delete-country-code@example.com");

    await send({ host, guestName: "Mai", guestPhone: "4085551234", sender: "guest", body: "Ten digits." });
    await send({ host, guestName: "Someone else", guestPhone: "14085551234", sender: "guest", body: "Eleven digits." });

    const deleted = await deleteThread({ hostId: host, phone: "4085551234" });
    expect(deleted).toBe(1);

    const left = await GuestMessage.find({ host });
    expect(left).toHaveLength(1);
    expect(left[0].guestPhone).toBe("14085551234");
  });

  it("deletes nothing, rather than everything, when no thread matches", async () => {
    const host = await hostFor("delete-no-match@example.com");
    await send({ host, guestName: "Mai", guestPhone: "4085551234", sender: "guest", body: "Still here." });

    expect(await deleteThread({ hostId: host, phone: "2135550000" })).toBe(0);
    expect(await GuestMessage.find({ host })).toHaveLength(1);
  });

  it("refuses a phone with no digits in it", async () => {
    const host = await hostFor("delete-no-digits@example.com");
    await send({ host, guestName: "Mai", guestPhone: "4085551234", sender: "guest", body: "Still here." });

    await expect(deleteThread({ hostId: host, phone: "   " })).rejects.toThrow();
    expect(await GuestMessage.find({ host })).toHaveLength(1);
  });
});
