/**
 * Removes bookings from Day documents where the referenced Room no longer exists.
 * Run from the backend root: node scripts/cleanOrphanedBookings.mjs
 */

import mongoose from "mongoose";
import dotenv from "dotenv";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

const __dirname = dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: join(__dirname, "../.env") });

const MONGO_URI = process.env.MONGO_URI;
if (!MONGO_URI) { console.error("MONGO_URI not found in .env"); process.exit(1); }

await mongoose.connect(MONGO_URI);
console.log("Connected to MongoDB");

const db = mongoose.connection.db;

// Get all valid room IDs
const rooms = await db.collection("rooms").find({}, { projection: { _id: 1 } }).toArray();
const validRoomIds = new Set(rooms.map((r) => r._id.toString()));
console.log(`Found ${validRoomIds.size} valid rooms`);

// Find all days with bookings
const days = await db.collection("days").find({ "bookings.0": { $exists: true } }).toArray();
console.log(`Scanning ${days.length} days with bookings...`);

let totalRemoved = 0;
for (const day of days) {
  const orphaned = day.bookings.filter((b) => b.room && !validRoomIds.has(b.room.toString()));
  if (orphaned.length === 0) continue;

  const orphanedIds = orphaned.map((b) => b._id);
  await db.collection("days").updateOne(
    { _id: day._id },
    { $pull: { bookings: { _id: { $in: orphanedIds } } } },
  );
  totalRemoved += orphaned.length;
  console.log(`  Day ${day.date.toISOString().split("T")[0]}: removed ${orphaned.length} orphaned booking(s)`);
}

console.log(`\nDone. Removed ${totalRemoved} orphaned bookings total.`);
await mongoose.disconnect();