import express, { Request } from "express";
import { sendGraphQLRequest } from "./util/sendToGraphQL";

// The host side of the same conversation. Mounted AFTER the JWT gate, which is
// the whole reason it is a second file rather than three more handlers in
// guestMessageRoute — that one has to stay reachable by a guest with no login,
// and replying as the host must not be.
//
// `sender` is pinned to "host" here for the mirror of the reason it is pinned
// to "guest" there.
const router = express.Router();

router.post("/threads", async (req: Request, res: any) => {
  const { hostId } = req.body;
  if (!hostId) return res.status(400).json({ error: "hostId is required" });

  const query = `
    query GuestMessageThreads($hostId: String!) {
      guestMessageThreads(hostId: $hostId) {
        guestName
        guestPhone
        lastBody
        lastSender
        lastAt
        unreadForHost
        total
      }
    }`;

  sendGraphQLRequest(query, { hostId })
    .then((result: any) => {
      if (result.errors) {
        return res.status(400).json({ errors: result.errors[0].message });
      }
      res.status(200).json(result.data.guestMessageThreads);
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

  const query = `
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

  sendGraphQLRequest(query, { hostId, phone })
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

// The host half of the typing ping. sender pinned to "host".
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
    sender: "host", // pinned — see the note at the top of this file
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

router.post("/reply", async (req: Request, res: any) => {
  const { host, guestName, guestPhone, body } = req.body;
  if (!host || !guestPhone || !String(body ?? "").trim()) {
    return res
      .status(400)
      .json({ error: "host, guestPhone and body are required" });
  }

  const query = `
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

  sendGraphQLRequest(query, {
    host,
    guestName: guestName || "Guest",
    guestPhone,
    sender: "host", // pinned — see the note at the top of this file
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

router.post("/read", async (req: Request, res: any) => {
  const { hostId, phone } = req.body;
  if (!hostId || !phone) {
    return res.status(400).json({ error: "hostId and phone are required" });
  }

  const query = `
    mutation MarkRead($hostId: String!, $phone: String!, $reader: String!) {
      markGuestMessagesRead(hostId: $hostId, phone: $phone, reader: $reader)
    }`;

  sendGraphQLRequest(query, { hostId, phone, reader: "host" })
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

// Removing a conversation. Only here, never in guestMessageRoute — the guest
// half is public, and a delete anyone can call is a way to wipe the questions
// the host has not answered yet.
router.post("/thread/delete", async (req: Request, res: any) => {
  const { hostId, phone } = req.body;
  if (!hostId || !phone) {
    return res.status(400).json({ error: "hostId and phone are required" });
  }

  const query = `
    mutation DeleteGuestThread($hostId: String!, $phone: String!) {
      deleteGuestThread(hostId: $hostId, phone: $phone)
    }`;

  sendGraphQLRequest(query, { hostId, phone })
    .then((result: any) => {
      if (result.errors) {
        return res.status(400).json({ errors: result.errors[0].message });
      }
      res.status(200).json({ deleted: result.data.deleteGuestThread });
    })
    .catch((error: any) => {
      res.status(500).json({ error: error.message });
    });
});

export default router;
