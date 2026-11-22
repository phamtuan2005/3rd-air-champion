import express, { Request, Response } from "express";
import mongoose from "mongoose";
import Room from "../model/roomSchema";
import { lookupAirbnbHistory } from "../util/airbnbHistory";
import { sendGraphQLRequest } from "./util/sendToGraphQL";

const router = express.Router();

router.post("/create", async (req: Request, res: any) => {
  const { host, guestName, guestPhone, date, room, duration, numberOfGuests, notes } = req.body;

  const query = `
    mutation CreateBookingRequest($host: String!, $guestName: String!, $guestPhone: String!, $date: Date!, $room: String!, $duration: Int!, $numberOfGuests: Int!, $notes: String) {
      createBookingRequest(host: $host, guestName: $guestName, guestPhone: $guestPhone, date: $date, room: $room, duration: $duration, numberOfGuests: $numberOfGuests, notes: $notes) {
        id
        host
        guestName
        guestPhone
        date
        room
        duration
        numberOfGuests
        status
        notes
        createdAt
        updatedAt
      }
    }`;

  sendGraphQLRequest(query, { host, guestName, guestPhone, date, room, duration, numberOfGuests, notes })
    .then((result: any) => {
      if (result.errors) {
        return res.status(400).json({ errors: result.errors[0].message });
      }
      res.status(200).json(result.data.createBookingRequest);
    })
    .catch((error: any) => {
      res.status(500).json({ error: error.message });
    });
});

router.post("/get/host", async (req: Request, res: any) => {
  const { hostId } = req.body;

  const query = `
    query BookingRequestsByHost($hostId: String!) {
      bookingRequestsByHost(hostId: $hostId) {
        id
        host
        guestName
        guestPhone
        date
        room
        duration
        numberOfGuests
        status
        notes
        createdAt
        updatedAt
      }
    }`;

  sendGraphQLRequest(query, { hostId })
    .then((result: any) => {
      if (result.errors) {
        return res.status(400).json({ errors: result.errors[0].message });
      }
      res.status(200).json(result.data.bookingRequestsByHost);
    })
    .catch((error: any) => {
      res.status(500).json({ error: error.message });
    });
});

router.put("/update/status", async (req: Request, res: any) => {
  const { id, status } = req.body;

  const query = `
    mutation UpdateBookingRequest($id: String!, $status: String!) {
      updateBookingRequest(_id: $id, status: $status) {
        id
        host
        guestName
        guestPhone
        date
        room
        duration
        numberOfGuests
        status
        notes
        createdAt
        updatedAt
      }
    }`;

  sendGraphQLRequest(query, { id, status })
    .then((result: any) => {
      if (result.errors) {
        return res.status(400).json({ errors: result.errors[0].message });
      }
      res.status(200).json(result.data.updateBookingRequest);
    })
    .catch((error: any) => {
      res.status(500).json({ error: error.message });
    });
});

router.post("/get/guest", async (req: Request, res: any) => {
  const { hostId, phone } = req.body;

  const query = `
    query BookingRequestsByGuest($hostId: String!, $phone: String!) {
      bookingRequestsByGuest(hostId: $hostId, phone: $phone) {
        id
        guestName
        guestPhone
        date
        room
        duration
        numberOfGuests
        status
        notes
        createdAt
      }
    }`;

  sendGraphQLRequest(query, { hostId, phone })
    .then((result: any) => {
      if (result.errors) {
        return res.status(400).json({ errors: result.errors[0].message });
      }
      res.status(200).json(result.data.bookingRequestsByGuest);
    })
    .catch((error: any) => {
      res.status(500).json({ error: error.message });
    });
});

router.post("/guest-by-phone", async (req: Request, res: any) => {
  const { host, phone } = req.body;

  const query = `
    query GuestByPhone($host: String!, $phone: String!) {
      guestByPhone(host: $host, phone: $phone) {
        id
        name
        phone
        loyaltyDiscountPerNight
        pricing {
          id
          price
          room
        }
      }
    }`;

  sendGraphQLRequest(query, { host, phone })
    .then((result: any) => {
      if (result.errors) {
        return res.status(400).json({ errors: result.errors[0].message });
      }
      res.status(200).json(result.data.guestByPhone);
    })
    .catch((error: any) => {
      res.status(500).json({ error: error.message });
    });
});

// TiBook: a guest who stayed here through AirBnB, welcomed back as one
// (host, 2026-11-22). Guests who found the house on AirBnB now come back and
// book on TiBook, and TiBook greeted them as strangers.
//
// Public like /guest-by-phone above, which already answers to a phone number
// alone. Only a sure match counts — the first name AND the phone's last four
// digits (util/airbnbHistory); a name with no phone on record is for the host
// to judge in TiMag, not for TiBook to tell a guest. And it says only how many
// stays and in which rooms: never the dates, which say when somebody was
// away from home.
router.post("/airbnb-welcome", async (req: Request, res: any) => {
  const host = String(req.body?.host ?? "");
  const name = String(req.body?.name ?? "").trim();
  const phone = String(req.body?.phone ?? "").trim();
  if (!mongoose.isValidObjectId(host) || !name || !phone) return res.status(200).json({ stays: 0, rooms: [] });
  try {
    const stays = (await lookupAirbnbHistory(host, name, phone)).filter((s) => s.matchedBy === "phone");
    const ids = [...new Set(stays.map((s) => s.roomId))];
    const named = await Room.find({ _id: { $in: ids.filter((id) => mongoose.isValidObjectId(id)) } }, { name: 1 }).lean();
    const nameOf = new Map(named.map((r: any) => [String(r._id), String(r.name ?? "")]));
    res.status(200).json({
      stays: stays.length,
      rooms: ids.map((id) => nameOf.get(id) ?? "").filter(Boolean),
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.post("/get/guest/calendar", async (req: Request, res: any) => {
  const { calendarId, phone } = req.body;

  const query = `
    query CalendarBookingsByGuest($calendarId: String!, $phone: String!) {
      calendarBookingsByGuest(calendarId: $calendarId, phone: $phone) {
        id
        guestName
        date
        room
        duration
        numberOfGuests
        status
        createdAt
        fees {
          label
          amount
        }
        expectedPayDate
        total
      }
    }`;

  sendGraphQLRequest(query, { calendarId, phone })
    .then((result: any) => {
      if (result.errors) {
        return res.status(400).json({ errors: result.errors[0].message });
      }
      res.status(200).json(result.data.calendarBookingsByGuest);
    })
    .catch((error: any) => {
      res.status(500).json({ error: error.message });
    });
});

router.post("/delete", async (req: Request, res: any) => {
  const { id } = req.body;

  const query = `
    mutation DeleteBookingRequest($id: String!) {
      deleteBookingRequest(_id: $id)
    }`;

  sendGraphQLRequest(query, { id })
    .then((result: any) => {
      if (result.errors) {
        return res.status(400).json({ errors: result.errors[0].message });
      }
      res.status(200).json(result.data.deleteBookingRequest);
    })
    .catch((error: any) => {
      res.status(500).json({ error: error.message });
    });
});

export default router;
