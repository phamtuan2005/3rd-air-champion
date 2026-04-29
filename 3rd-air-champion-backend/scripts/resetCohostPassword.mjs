/**
 * Resets a cohost's password.
 * Run from the backend root: node scripts/resetCohostPassword.mjs <email> <newPassword>
 * Example: node scripts/resetCohostPassword.mjs cindy@example.com NewPass123
 */

import mongoose from "mongoose";
import bcrypt from "bcrypt";
import dotenv from "dotenv";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

const __dirname = dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: join(__dirname, "../.env") });

const MONGO_URI = process.env.MONGO_URI;
if (!MONGO_URI) { console.error("MONGO_URI not set"); process.exit(1); }

const [email, newPassword] = process.argv.slice(2);
if (!email || !newPassword) {
  console.error("Usage: node scripts/resetCohostPassword.mjs <email> <newPassword>");
  process.exit(1);
}

const cohostSchema = new mongoose.Schema({ email: String, password: String, name: String, host: mongoose.Schema.ObjectId });
const Cohost = mongoose.model("Cohost", cohostSchema);

await mongoose.connect(MONGO_URI);

const cohost = await Cohost.findOne({ email: email.toLowerCase() });
if (!cohost) { console.error(`No cohost found with email: ${email}`); await mongoose.disconnect(); process.exit(1); }

const salt = await bcrypt.genSalt(10);
const hashed = await bcrypt.hash(newPassword, salt);
await Cohost.findByIdAndUpdate(cohost._id, { password: hashed });

console.log(`✅ Password reset for cohost: ${cohost.name} (${email})`);
await mongoose.disconnect();