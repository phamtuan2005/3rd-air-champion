import express, { Request } from "express";
import { sendGraphQLRequest } from "./util/sendToGraphQL";

// The guest side of the host conversation. PUBLIC, like the booking request and
// the wish list beside it — a guest asking a question has no TiMag login and
// should not need one to ask whether the house has parking.
//
// A guest is identified by their phone, exactly as they are for wish lists and
// bookings. That is the same trust level those routes already run at, and the
// alternative — an account to ask a question — is the kind of work this app is
// supposed to save people.
//
// `sender` is NOT taken from the body anywhere in this file. It is pinned to
// "guest" on the way past, so nothing that can reach this router can post a
// message that appears to have come from Anh-Tuan.
const router = express.Router();

const SEND = `
  mutation SendGuestMessage($host: String!, $guestName: String!, $guestPhone: String!, $sender: String!, $body: String!) {
    sendGuestMessage(host: $host, guestName: $guestName, guestPhone: $guestPhone, sender: $sender, body: $body) {
      id
      guestName
      guestPhone
      sender
      body
      createdAt
    }
  }`;

const THREAD = `
  query GuestMessages($hostId: String!, $phone: String!) {
    guestMessages(hostId: $hostId, phone: $phone) {
      id
      guestName
      guestPhone
      sender
      body
      readByHost
      readByGuest
      createdAt
    }
  }`;

// Ping "I am typing" and learn whether the host is, in one round trip. Called
// every couple of seconds while the chat sheet is open, so it stays small.
// sender is pinned to "guest" like everything else in this file.
router.post("/typing", async (req: Request, res: any) => {
  const { host, guestPhone, typing } = req.body;
  if (!host || !guestPhone) {
    return res.status(400).json({ error: "host and guestPhone are required" });
  }

  const query = `
    mutation SetChatTyping($host: String!, $phone: String!, $sender: String!, $typing: Boolean!) {
      setChatTyping(host: $host, phone: $phone, sender: $sender, typing: $typing) {
        guestTyping
        hostTyping
      }
    }`;

  sendGraphQLRequest(query, {
    host,
    phone: guestPhone,
    sender: "guest", // pinned — see the note at the top of this file
    typing: !!typing,
  })
    .then((result: any) => {
      if (result.errors) {
        return res.status(400).json({ errors: result.errors[0].message });
      }
      res.status(200).json(result.data.setChatTyping);
    })
    .catch((error: any) => {
      res.status(500).json({ error: error.message });
    });
});

router.post("/send", async (req: Request, res: any) => {
  const { host, guestName, guestPhone, body } = req.body;
  if (!host || !guestPhone || !String(body ?? "").trim()) {
    return res
      .status(400)
      .json({ error: "host, guestPhone and body are required" });
  }

  sendGraphQLRequest(SEND, {
    host,
    guestName: guestName || "Guest",
    guestPhone,
    sender: "guest", // pinned — see the note at the top of this file
    body,
  })
    .then((result: any) => {
      if (result.errors) {
        return res.status(400).json({ errors: result.errors[0].message });
      }
      res.status(200).json(result.data.sendGuestMessage);
    })
    .catch((error: any) => {
      res.status(500).json({ error: error.message });
    });
});

router.post("/thread", async (req: Request, res: any) => {
  const { hostId, phone } = req.body;
  if (!hostId || !phone) {
    return res.status(400).json({ error: "hostId and phone are required" });
  }

  sendGraphQLRequest(THREAD, { hostId, phone })
    .then((result: any) => {
      if (result.errors) {
        return res.status(400).json({ errors: result.errors[0].message });
      }
      res.status(200).json(result.data.guestMessages);
    })
    .catch((error: any) => {
      res.status(500).json({ error: error.message });
    });
});

// The guest has read the host's replies. Pinned to "guest" for the same reason
// `sender` is above: this may never clear what is waiting for the host.
router.post("/read", async (req: Request, res: any) => {
  const { hostId, phone } = req.body;
  if (!hostId || !phone) {
    return res.status(400).json({ error: "hostId and phone are required" });
  }

  const query = `
    mutation MarkRead($hostId: String!, $phone: String!, $reader: String!) {
      markGuestMessagesRead(hostId: $hostId, phone: $phone, reader: $reader)
    }`;

  sendGraphQLRequest(query, { hostId, phone, reader: "guest" })
    .then((result: any) => {
      if (result.errors) {
        return res.status(400).json({ errors: result.errors[0].message });
      }
      res.status(200).json({ marked: result.data.markGuestMessagesRead });
    })
    .catch((error: any) => {
      res.status(500).json({ error: error.message });
    });
});

export default router;
