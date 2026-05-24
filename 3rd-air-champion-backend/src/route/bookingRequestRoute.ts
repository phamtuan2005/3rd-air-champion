import express, { Request, Response } from "express";
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
