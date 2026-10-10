#!/usr/bin/env node
//
// Fill in the stay date of reviews already on record, from the bookings —
// the same lookup the review form now does as a review is pasted (host,
// 2026-10-10). Reviews came in with a month only, so the link to the cleaner
// who prepared the room for that stay was missing on every one of them.
//
// Uses the COMPILED lookup (dist/util/reviewStayLookup), the one the form's
// route runs, so an old review gets exactly the date a new one would. Run
// `npm run build` first.
//
// Touches only reviews with NO stay date, a guest name and a review month. A
// date the host typed is never changed.
//
// Where several stays fit, NOTHING is written: the row is listed as CHECK and
// keeps its month. The first dry run (2026-10-10) had 24 of them, Wan-Lin
// among them — she posted the same review for two different King stays, and
// "the newest" would have given both reviews the same night. A wrong stay date
// points a complaint at the wrong cleaner; no date points at nobody. The form
// still takes the newest, because there the host sees the date before Add.
//
// Usage (from 3rd-air-champion-backend):
//   node scripts/backfill-review-stays.js          show what it would fill
//   node scripts/backfill-review-stays.js --apply  fill it in

const path = require("path");
require("dotenv").config({ path: path.join(__dirname, "../.env") });
const mongoose = require("mongoose");

const dist = (p) => require(path.join(__dirname, "../dist", p));
const { lookupReviewStay } = dist("util/reviewStayLookup");
const TTReviewEntry = dist("model/ttReviewEntrySchema").default;
const Room = dist("model/roomSchema").default;

const APPLY = process.argv.includes("--apply");

(async () => {
  if (!process.env.MONGO_URI) {
    console.error("MONGO_URI not found in .env");
    process.exit(1);
  }
  await mongoose.connect(process.env.MONGO_URI);

  const rows = await TTReviewEntry.find({
    $or: [{ stayDate: "" }, { stayDate: { $exists: false } }],
    guestName: { $nin: ["", null] },
    reviewMonth: { $nin: ["", null] },
  }).lean();
  const roomName = new Map((await Room.find({}, { name: 1 }).lean()).map((r) => [String(r._id), r.name]));

  let found = 0;
  let checkThese = 0;
  for (const r of rows) {
    const stay = await lookupReviewStay(String(r.host), String(r.room), r.guestName, r.reviewMonth);
    const room = roomName.get(String(r.room)) ?? "?";
    if (!stay) {
      console.log(`  -  ${room.padEnd(6)} ${r.guestName.padEnd(18)} ${r.reviewMonth}  no stay found`);
      continue;
    }
    if (stay.others > 0) {
      checkThese++;
      console.log(
        `  ?  ${room.padEnd(6)} ${r.guestName.padEnd(18)} ${r.reviewMonth}  CHECK: ${stay.others + 1} stays fit, newest ${stay.stayDate} — left for you`,
      );
      continue;
    }
    found++;
    console.log(
      `  ✓  ${room.padEnd(6)} ${r.guestName.padEnd(18)} ${r.reviewMonth}  → ${stay.stayDate} (${stay.nights}n, out ${stay.checkout})`,
    );
    if (APPLY) {
      await TTReviewEntry.updateOne(
        { _id: r._id, $or: [{ stayDate: "" }, { stayDate: { $exists: false } }] },
        // The house's own guest, when the stay was theirs and none was linked.
        { $set: { stayDate: stay.stayDate, ...(stay.guestId && !r.guest ? { guest: stay.guestId } : {}) } },
      );
    }
  }

  console.log(
    `\n${rows.length} review(s) without a stay date · ${found} matched to one stay · ` +
      `${checkThese} with several stays (left for you) · ${rows.length - found - checkThese} not found`,
  );
  console.log(
    APPLY
      ? `Filled in ${found}.`
      : `Dry run — nothing written. Run again with --apply to fill in the ${found} matched to one stay.`,
  );
  await mongoose.disconnect();
})().catch(async (e) => {
  console.error(e);
  await mongoose.disconnect().catch(() => {});
  process.exit(1);
});
