import ChatTyping from "../../model/chatTypingSchema";

// How long a "still typing" ping stays true. The clients re-ping every ~2.5s, so
// this is comfortably longer than one interval — a single dropped request must
// not make the bubble flicker — and short enough that somebody who walks away
// mid-sentence stops showing as typing within a breath or two.
export const TYPING_WINDOW_MS = 6000;

const phoneKeyOf = (phone: string) => (phone ?? "").replace(/\D/g, "");

export const chatTypingResolvers = {
  Mutation: {
    setChatTyping: async (
      _: unknown,
      { host, phone, sender, typing }: any
    ) => {
      if (sender !== "guest" && sender !== "host")
        throw new Error("sender must be 'guest' or 'host'.");

      const phoneKey = phoneKeyOf(phone);
      if (!phoneKey) throw new Error("A phone number is required.");

      if (typing) {
        await ChatTyping.findOneAndUpdate(
          { host, phoneKey, sender },
          { at: new Date() },
          { upsert: true, new: true, setDefaultsOnInsert: true }
        );
      } else {
        // Deleted rather than stamped with an old date: "not typing" is the
        // absence of a row, so a conversation nobody is in leaves nothing
        // behind. Sent when a message goes out, so the bubble disappears at the
        // same moment the message it was promising arrives.
        await ChatTyping.deleteOne({ host, phoneKey, sender });
      }

      const since = new Date(Date.now() - TYPING_WINDOW_MS);
      const live = await ChatTyping.find({ host, phoneKey, at: { $gt: since } });

      return {
        // Each side is told about the OTHER one too, which is what lets one
        // request serve both the ping and the poll.
        guestTyping: live.some((r) => r.sender === "guest"),
        hostTyping: live.some((r) => r.sender === "host"),
      };
    },
  },
};
