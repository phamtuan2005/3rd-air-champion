import GuestMessage from "../../model/guestMessageSchema";

// Phones are stored however the guest typed them — "(408) 555-1234" and
// "4085551234" are the same person. Matching on the digits with anything
// allowed between them is what bookingRequestsByGuest, guestByPhone and the
// wish list all already do; a message thread has to find the same guest they do
// or a guest who wrote from the booking form would not see their own reply.
const phoneMatcher = (phone: string) => {
  const digits = phone.replace(/\D/g, "");
  return new RegExp(digits.split("").join("\\D*"));
};

export const guestMessageResolvers = {
  Query: {
    guestMessages: async (_: unknown, { hostId, phone }: any) => {
      return await GuestMessage.find({
        host: hostId,
        guestPhone: { $regex: phoneMatcher(phone) },
      }).sort({ createdAt: 1 });
    },

    // The host's inbox: one row per guest, most recently active first.
    //
    // Grouped in memory rather than by an aggregation pipeline. The phone match
    // above is a regex per guest, which $group cannot express, and this house
    // has five rooms — the whole collection is small enough that correctness is
    // worth more here than a pipeline that would have to normalise phones on
    // write to work at all.
    guestMessageThreads: async (_: unknown, { hostId }: any) => {
      const all = await GuestMessage.find({ host: hostId }).sort({ createdAt: 1 });
      const byGuest = new Map<string, any>();

      for (const m of all) {
        // Key on digits so the same guest writing from two forms, one with
        // dashes and one without, is one thread and not two.
        const key = (m.guestPhone || "").replace(/\D/g, "");
        const existing = byGuest.get(key);
        if (!existing) {
          byGuest.set(key, {
            guestName: m.guestName,
            guestPhone: m.guestPhone,
            lastBody: m.body,
            lastSender: m.sender,
            lastAt: (m as any).createdAt,
            unreadForHost: m.sender === "guest" && !m.readByHost ? 1 : 0,
            total: 1,
          });
          continue;
        }
        // Sorted ascending, so every later row is the newer one.
        existing.lastBody = m.body;
        existing.lastSender = m.sender;
        existing.lastAt = (m as any).createdAt;
        existing.total += 1;
        // The freshest name they gave, so a guest who first wrote as "Tri" and
        // later booked as "Anh-Tri Pham" is listed the way they last signed.
        if (m.guestName) existing.guestName = m.guestName;
        if (m.sender === "guest" && !m.readByHost) existing.unreadForHost += 1;
      }

      return Array.from(byGuest.values()).sort(
        (a, b) => new Date(b.lastAt).getTime() - new Date(a.lastAt).getTime()
      );
    },
  },

  Mutation: {
    sendGuestMessage: async (
      _: unknown,
      { host, guestName, guestPhone, sender, body }: any
    ) => {
      const text = (body ?? "").trim();
      if (!text) throw new Error("A message needs something in it.");
      if (sender !== "guest" && sender !== "host")
        throw new Error("sender must be 'guest' or 'host'.");

      // Whoever wrote it has read it. Only the other side's flag starts false,
      // which is what makes the unread count mean "waiting for me".
      return await new GuestMessage({
        host,
        guestName,
        guestPhone,
        sender,
        body: text,
        readByHost: sender === "host",
        readByGuest: sender === "guest",
      }).save();
    },

    // Marks the OTHER side's messages read. `reader` says who is looking, so
    // the guest opening their thread can never clear the host's unread badge.
    markGuestMessagesRead: async (_: unknown, { hostId, phone, reader }: any) => {
      if (reader !== "guest" && reader !== "host")
        throw new Error("reader must be 'guest' or 'host'.");

      const result = await GuestMessage.updateMany(
        {
          host: hostId,
          guestPhone: { $regex: phoneMatcher(phone) },
          sender: reader === "host" ? "guest" : "host",
          ...(reader === "host" ? { readByHost: false } : { readByGuest: false }),
        },
        reader === "host" ? { readByHost: true } : { readByGuest: true }
      );
      return result.modifiedCount ?? 0;
    },
  },
};
