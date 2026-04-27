import express, { Response, Request } from "express";
import { sendGraphQLRequest } from "./util/sendToGraphQL";

const router = express.Router();

router.post("/create", async (req: Request, res: any) => {
  if (!("user" in req))
    return res.status(401).json({ error: "Invalid or expired token" });

  const { name, email, phone, numberOfGuests, returning, notes } = req.body;

  let variables: {
    name: string;
    email?: string;
    phone: string;
    numberOfGuests?: number;
    returning?: boolean;
    notes?: string;
  } = { name, phone };
  if (email) variables.email = email;
  if (numberOfGuests) variables.numberOfGuests = numberOfGuests;
  if (typeof returning !== "undefined") variables.returning = returning;
  if (notes) variables.notes = notes;

  const { hostId } = req.user as any; // Extracted from token

  const query = `
    mutation CreateGuest($name: String!, $phone: String!, $host: String!, $numberOfGuests: Int, $returning: Boolean, $notes: String, $email: String) {
        createGuest(name: $name, phone: $phone, host: $host, numberOfGuests: $numberOfGuests, returning: $returning, notes: $notes, email: $email) {
            id
            phone
            alias
            numberOfGuests
            notes
            name
            email
            returning
            pricing {
              id
              price
              room
            }
        }
    }`;

  (variables as any).host = hostId;
  sendGraphQLRequest(query, variables)
    .then((result: any) => {
      if (result.errors) {
        return res.status(400).json({ errors: result.errors[0].message });
      }
      // Send the successful login response
      res.status(200).json(result.data.createGuest);
    })
    .catch((error: any) => {
      // Handle errors from the helper function
      res.status(500).json({ error: error.message });
    });
});

router.post("/remove", async (req: Request, res: any) => {
  if (!("user" in req))
    return res.status(401).json({ error: "Invalid or expired token" });

  const { guestIds } = req.body;

  const { hostId } = req.user as any; // Extracted from token
  const query = `
      mutation DeleteGuests($id: String!, $guestIds: [String!]!) {
        deleteGuests(_id: $id, guestIds: $guestIds) {
            guests
        }
    }`;

  const variables = { id: hostId, guestIds };
  sendGraphQLRequest(query, variables)
    .then((result: any) => {
      if (result.errors) {
        return res.status(400).json({ errors: result.errors[0].message });
      }
      // Send the successful login response
      res.status(200).json(result.data.deleteGuests);
    })
    .catch((error: any) => {
      // Handle errors from the helper function
      res.status(500).json({ error: error.message });
    });
});

router.put("/update", async (req: Request, res: any) => {
  if (!("user" in req))
    return res.status(401).json({ error: "Invalid or expired token" });

  const { id, name, email, phone, numberOfGuests, returning, notes } = req.body;

  let variables: {
    name?: string;
    email?: string;
    phone?: string;
    numberOfGuests?: number;
    returning?: boolean;
    notes?: string;
  } = {};

  if (name) variables.name = name;
  if (email) variables.email = email;
  if (phone) variables.phone = phone;
  if (numberOfGuests) variables.numberOfGuests = numberOfGuests;
  if (typeof returning !== "undefined") variables.returning = returning;
  if (notes) variables.notes = notes;

  (variables as any).id = id;

  const query = `
        mutation UpdateGuest($id: String!, $name: String, $email: String, $phone: String, $numberOfGuests: Int, $returning: Boolean, $notes: String) {
            updateGuest(_id: $id, name: $name, email: $email, phone: $phone, numberOfGuests: $numberOfGuests, returning: $returning, notes: $notes) {
                host
                email
                alias
                name
                notes
                numberOfGuests
                phone
                returning
                pricing {
                  id
                  price
                  room
                }
            }
        }`;

  sendGraphQLRequest(query, variables)
    .then((result: any) => {
      if (result.errors) {
        return res.status(400).json({ errors: result.errors[0].message });
      }
      // Send the successful login response
      res.status(200).json(result.data.updateGuest);
    })
    .catch((error: any) => {
      // Handle errors from the helper function
      res.status(500).json({ error: error.message });
    });
});

router.get("/get", async (req: Request, res: any) => {
  if (!("user" in req))
    return res.status(401).json({ error: "Invalid or expired token" });

  const query = `
    query Guests {
        guests {
            id
            name
            alias
            notes
            numberOfGuests
            phone
            returning
            email
            pricing {
              id
              price
              room
            }
        }
    }`;

  sendGraphQLRequest(query)
    .then((result: any) => {
      if (result.errors) {
        return res.status(400).json({ errors: result.errors[0].message });
      }
      // Send the successful login response
      res.status(200).json(result.data.guests);
    })
    .catch((error: any) => {
      // Handle errors from the helper function
      res.status(500).json({ error: error.message });
    });
});

router.post("/get/one", async (req: Request, res: any) => {
  if (!("user" in req))
    return res.status(401).json({ error: "Invalid or expired token" });

  const { id } = req.body;

  const query = `
      query Guest ($id: String!) {
          guest (_id: $id) {
              id
              name
              alias
              notes
              numberOfGuests
              phone
              returning
              email
              pricing {
                id
                price
                room
              }
          }
      }`;

  sendGraphQLRequest(query, { id })
    .then((result: any) => {
      if (result.errors) {
        return res.status(400).json({ errors: result.errors[0].message });
      }
      // Send the successful login response
      res.status(200).json(result.data.guest);
    })
    .catch((error: any) => {
      // Handle errors from the helper function
      res.status(500).json({ error: error.message });
    });
});

router.post("/update/pricing", async (req: Request, res: any) => {
  if (!("user" in req))
    return res.status(401).json({ error: "Invalid or expired token" });

  const { guest, price, room } = req.body;

  const query = `
      mutation UpdateGuestPricing($guest: String!, $room: String, $price: Float) {
        updateGuestPricing(guest: $guest, room: $room, price: $price) {
          id
          name
          alias
          notes
          numberOfGuests
          phone
          returning
          email
          pricing {
            id
            price
            room
          }
        }
      }`;

  sendGraphQLRequest(query, { guest, price, room })
    .then((result: any) => {
      if (result.errors) {
        return res.status(400).json({ errors: result.errors[0].message });
      }
      // Send the successful login response
      res.status(200).json(result.data.updateGuestPricing);
    })
    .catch((error: any) => {
      // Handle errors from the helper function
      res.status(500).json({ error: error.message });
    });
});

router.post("/get/host", async (req: Request, res: any) => {
  if (!("user" in req))
    return res.status(401).json({ error: "Invalid or expired token" });

  const { host } = req.body;

  const query = `
      query GuestsHost($host: String!) {
        guestsHost(host: $host) {
          id
          name
          alias
          notes
          numberOfGuests
          phone
          returning
          email
          pricing {
              id
              price
              room
            }  
        }
      }`;

  sendGraphQLRequest(query, { host })
    .then((result: any) => {
      if (result.errors) {
        return res.status(400).json({ errors: result.errors[0].message });
      }
      // Send the successful login response
      res.status(200).json(result.data.guestsHost);
    })
    .catch((error: any) => {
      // Handle errors from the helper function
      res.status(500).json({ error: error.message });
    });
});


router.post("/get/by-phone", async (req: Request, res: any) => {
  if (!("user" in req))
    return res.status(401).json({ error: "Invalid or expired token" });

  const { host, phone } = req.body;

  const query = `
    query GuestsHost($host: String!) {
      guestsHost(host: $host) {
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

  sendGraphQLRequest(query, { host })
    .then((result: any) => {
      if (result.errors) {
        return res.status(400).json({ errors: result.errors[0].message });
      }
      const guests = result.data.guestsHost;
      const match = guests.find((g: any) => g.phone === phone) ?? null;
      res.status(200).json(match);
    })
    .catch((error: any) => {
      res.status(500).json({ error: error.message });
    });
});

export default router;
