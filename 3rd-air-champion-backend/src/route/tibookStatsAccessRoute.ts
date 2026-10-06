import express, { Request } from "express";
import crypto from "crypto";
import mongoose from "mongoose";
import Guest from "../model/guestSchema";
import TiBookStatsGrant from "../model/tibookStatsGrantSchema";
import { requireManager } from "../middleware/requireManager";

// The host deciding which guests may read TiBook's visitor numbers — for a
// guest helping develop the site. Behind the JWT gate and requireManager like
// /tibook-stats itself: TiBook holds a valid token, and a guest must never be
// able to grant themselves this.
//
// The house always comes from the token, never the body, so one house cannot
// grant or revoke anything at another.
//
// Not in GraphQL, for the reason given at the top of tibookVisitRoute.
const router = express.Router();

router.use(requireManager as any);

// No 0/O or 1/I/L: the host reads this out or types it into a message, and the
// guest types it back on a phone.
const ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
const CODE_LENGTH = 12; // 31^12 ≈ 2^59 — not guessable, even without the rate limit

export const newStatsCode = (): string => {
  const bytes = crypto.randomBytes(CODE_LENGTH);
  const chars = Array.from(bytes, (b) => ALPHABET[b % ALPHABET.length]).join("");
  // Grouped in fours so it can be read back without losing one's place.
  return chars.match(/.{4}/g)!.join("-");
};

// How a typed code is compared: case, spaces and dashes do not matter, so
// "abcd efgh jkmn" finds "ABCD-EFGH-JKMN".
export const hashStatsCode = (code: string): string =>
  crypto
    .createHash("sha256")
    .update(String(code ?? "").toUpperCase().replace(/[^A-Z0-9]/g, ""))
    .digest("hex");

// Who has it. Names come from the house's own guest records; a grant whose
// guest has since been deleted is dropped here, so the list never shows
// somebody who no longer exists — and their code stops working.
router.get("/", async (req: Request, res: any) => {
  const hostId = (req as any).user.hostId;
  try {
    const grants = await TiBookStatsGrant.find({ host: hostId }, { guest: 1, createdAt: 1, grantedBy: 1 }).lean();
    const guests = await Guest.find(
      { host: hostId, _id: { $in: grants.map((g: any) => g.guest) } },
      { name: 1 }
    ).lean();
    const nameOf = new Map(guests.map((g: any) => [String(g._id), g.name]));
    const orphaned = grants.filter((g: any) => !nameOf.has(String(g.guest)));
    if (orphaned.length > 0) {
      await TiBookStatsGrant.deleteMany({ _id: { $in: orphaned.map((g: any) => g._id) } });
    }
    res.status(200).json(
      grants
        .filter((g: any) => nameOf.has(String(g.guest)))
        .map((g: any) => ({
          guestId: String(g.guest),
          name: nameOf.get(String(g.guest)),
          grantedAt: g.createdAt,
          grantedBy: g.grantedBy,
        }))
    );
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Give access, or replace a guest's code. The code comes back ONCE, in this
// response — only its hash is kept, so a lost code is replaced, never looked up.
//
// `confirm: true` is required. TiMag asks for two separate clicks before it
// sends this (pick the guest, then confirm on its own card); the flag means a
// stray or replayed request that skipped that step is refused here too.
router.post("/", async (req: Request, res: any) => {
  const user = (req as any).user;
  const { guestId, confirm } = req.body ?? {};
  if (confirm !== true) {
    return res.status(400).json({ error: "Giving access needs to be confirmed." });
  }
  if (!mongoose.isValidObjectId(guestId)) {
    return res.status(400).json({ error: "That guest could not be found." });
  }
  try {
    // The guest must be THIS house's.
    const guest = await Guest.findOne({ _id: guestId, host: user.hostId }, { name: 1 }).lean();
    if (!guest) return res.status(404).json({ error: "That guest could not be found." });

    const code = newStatsCode();
    await TiBookStatsGrant.findOneAndUpdate(
      { host: user.hostId, guest: guestId },
      { codeHash: hashStatsCode(code), grantedBy: user.cohostName || "" },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );
    res.status(200).json({ guestId, name: (guest as any).name, code });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Take it away. The code stops working at once.
router.delete("/:guestId", async (req: Request, res: any) => {
  const hostId = (req as any).user.hostId;
  if (!mongoose.isValidObjectId(req.params.guestId)) return res.status(204).end();
  try {
    await TiBookStatsGrant.deleteOne({ host: hostId, guest: req.params.guestId });
    res.status(204).end();
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

export default router;
