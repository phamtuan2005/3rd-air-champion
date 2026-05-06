import mongoose from "mongoose";
import dotenv from "dotenv";
import path from "path";

dotenv.config({ path: path.resolve(__dirname, "../.env") });

const MONGO_URI = process.env.MONGO_URI || "";

const bookingRequestSchema = new mongoose.Schema(
  {
    host: mongoose.Schema.ObjectId,
    guestName: String,
    guestPhone: String,
    date: Date,
    room: mongoose.Schema.ObjectId,
    duration: Number,
    numberOfGuests: Number,
    status: String,
    notes: String,
  },
  { timestamps: true }
);

const BookingRequest = mongoose.model("BookingRequest", bookingRequestSchema);

async function removeDuplicates() {
  await mongoose.connect(MONGO_URI);
  console.log("Connected to MongoDB");

  const all = await BookingRequest.find().lean();

  // Group by the fields that make a request unique
  const groups = new Map<string, typeof all>();
  for (const req of all) {
    const dateKey = new Date(req.date as Date).toISOString().slice(0, 10);
    const key = [
      String(req.host),
      String(req.guestPhone),
      dateKey,
      String(req.room),
      req.duration,
      req.numberOfGuests,
    ].join("|");

    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push(req);
  }

  let totalDeleted = 0;
  for (const [key, group] of groups) {
    if (group.length <= 1) continue;

    // Keep the oldest; delete the rest
    group.sort((a, b) => new Date(a.createdAt as Date).getTime() - new Date(b.createdAt as Date).getTime());
    const [keep, ...duplicates] = group;

    console.log(`\nDuplicate group: ${key}`);
    console.log(`  Keeping:  ${keep._id} (created ${keep.createdAt}, status: ${keep.status})`);
    for (const dup of duplicates) {
      console.log(`  Deleting: ${dup._id} (created ${dup.createdAt}, status: ${dup.status})`);
      await BookingRequest.findByIdAndDelete(dup._id);
      totalDeleted++;
    }
  }

  if (totalDeleted === 0) {
    console.log("\nNo duplicates found.");
  } else {
    console.log(`\nDone. Deleted ${totalDeleted} duplicate(s).`);
  }

  await mongoose.disconnect();
}

removeDuplicates().catch((err) => {
  console.error(err);
  process.exit(1);
});