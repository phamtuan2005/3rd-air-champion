import express, { Request } from "express";
import mongoose from "mongoose";
import Host from "../model/hostSchema";
import TiBookVisit from "../model/tibookVisitSchema";
import { continentOfTimeZone } from "../util/continentOfTimeZone";
import { normalizePhone } from "../model/guestSchema";
import { utcDay } from "../util/tibookVisitorStats";

// TiBook saying "someone is looking". PUBLIC, because the someone is a guest
// with no login. The host's side — reading the numbers — is tibookStatsRoute,
// behind the JWT gate and the manager check.
//
// Talks to the model directly rather than through the GraphQL layer like its
// neighbours. /graphql is mounted OUTSIDE the JWT gate, so anything added to the
// schema can be queried by anyone who finds it; the stats half must not be, and
// splitting one small feature across two styles would invite the next person to
// "tidy" the stats query into the schema. Neither half goes there.
//
// Anyone can call this, so anyone can inflate the numbers. Accepted: it is a
// five-room house's page, the worst case is a vanity figure that reads high, and
// nothing here can read, change or delete a single real booking.
const router = express.Router();

// A random id the device generated (crypto.randomUUID). Held to a strict shape
// so the field cannot be used to stuff arbitrary text into the database.
const VISITOR_ID = /^[A-Za-z0-9-]{8,64}$/;

router.post("/", async (req: Request, res: any) => {
  const { host, visitorId, timeZone, guestPhone } = req.body ?? {};

  if (!mongoose.isValidObjectId(host) || typeof visitorId !== "string" || !VISITOR_ID.test(visitorId)) {
    return res.status(400).json({ error: "host and visitorId are required" });
  }

  try {
    // Refuse a host that does not exist, or a script could fill the collection
    // with rows for made-up houses that no stats screen would ever show.
    if (!(await Host.exists({ _id: host }))) {
      return res.status(404).json({ error: "Unknown host" });
    }

    const zone = typeof timeZone === "string" ? timeZone.trim().slice(0, 64) : "";

    // $set, not $setOnInsert: a phone that changes zone mid-day (a guest
    // landing at SJO) is counted where it was last seen that day.
    const set: Record<string, string> = { timeZone: zone, continent: continentOfTimeZone(zone) };

    // Who this visit belongs to, in three states that must not be confused:
    //   absent       -- the look says nothing about the guest; leave any link
    //                   made earlier today alone. Anonymous page loads send this.
    //   ""           -- "Not you?". The guest withdrew; unlink today's visit.
    //   a number     -- a guest who agreed to be remembered; link it.
    // Consent is enforced where it is given, in TiBook. This route cannot see
    // it, which is why the frontend only ever sends a number past that check.
    //
    // A number that does not parse is IGNORED rather than refused: counting the
    // visit matters more than the link, and a failed count shows the guest
    // nothing while losing the house a real visitor.
    if (typeof guestPhone === "string") {
      const typed = guestPhone.trim().slice(0, 40);
      if (!typed) set.guestPhone = "";
      else {
        const normalized = normalizePhone(typed);
        if (normalized) set.guestPhone = normalized;
      }
    }

    await TiBookVisit.updateOne({ host, visitorId, day: utcDay() }, { $set: set }, { upsert: true });
    return res.status(204).end();
  } catch (error: any) {
    // Two tabs opening at the same moment both try to insert the day's row;
    // the unique index lets one win. The visit IS recorded — say so.
    if (error?.code === 11000) return res.status(204).end();
    return res.status(500).json({ error: error.message });
  }
});

export default router;
