import mongoose from "mongoose";
import Room from "./roomSchema";
import Calendar from "./calendarSchema";
import Guest from "./guestSchema";
import Cohost from "./cohostSchema";
import bcrypt from "bcrypt";

const SALT_ROUNDS = 10;

const hostSchema = new mongoose.Schema(
  {
    email: {
      type: String,
      match: /^[a-zA-Z0-9._-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/,
      required: true,
      unique: true,
    },
    password: { type: String, required: true },
    name: { type: String, required: true },
    rooms: [{ type: mongoose.Schema.ObjectId, ref: "Room" }],
    calendar: { type: mongoose.Schema.ObjectId, ref: "Calendar" },
    guests: [{ type: mongoose.Schema.ObjectId, ref: "Guest" }],
    cohosts: [{ type: mongoose.Schema.ObjectId, ref: "Cohost" }],
    airbnbsync: [
      {
        room: { type: mongoose.Schema.ObjectId, ref: "Room" },
        link: { type: String, default: "" },
      },
    ],
    airbnbGuestId: { type: mongoose.Schema.ObjectId, ref: "Guest" },
    doorCode: { type: String, default: "" },
    airbnbName: { type: String, default: "" },
    airbnbAddress: { type: String, default: "" },
    airbnbRating: { type: Number },
    airbnbReviewCount: { type: Number },
    airbnbReviewsUrl: { type: String, default: "" },
    airbnbProfileUrl: { type: String, default: "" },
    cohostProfileUrls: [{ type: String }],
    airbnbSuperhost: { type: Boolean, default: false },
    highlights: [{ type: String }],
    houseRules: { type: String, default: "" },
    phone: { type: String, default: "" },
    contactEmail: { type: String, default: "" },
    licenseNumber: { type: String, default: "" },
  },
  { timestamps: true }
);

hostSchema.pre("validate", function (next) {
  // Name validation
  const specialCharRegex = /[`!@#$%^&*()_+=\[\]{};:"\\|,<>\/?~]/;

  if (specialCharRegex.test(this.name))
    return next(new Error("Name cannot contain special characters"));

  return next();
});

// CREATE - Middleware START

hostSchema.pre("save", function (next) {
  // Email sanitization
  this.email = this.email?.toLocaleLowerCase();

  return next();
});

hostSchema.pre("save", async function (next) {
  if (!this.isModified("password")) return next();

  const salt = await bcrypt.genSalt(SALT_ROUNDS);
  this.password = await bcrypt.hash(this.password, salt);

  return next();
});

// CREATE - Middleware END

// UPDATE - Middleware START

hostSchema.pre(
  ["updateMany", "updateOne", "findOneAndUpdate"],
  async function (next) {
    const update = this.getUpdate();

    if (update && typeof update === "object" && !Array.isArray(update)) {
      const fields = (update as any).$set ?? update;

      if ("name" in fields) {
        // Name validation
        const specialCharRegex = /[`!@#$%^&*()_+=\[\]{};:"\\|,<>\/?~]/;

        if (specialCharRegex.test(fields.name))
          return next(new Error("Name cannot contain special characters"));
      }

      if ("email" in fields) {
        fields.email = fields.email.toLowerCase();
      }

      if ("password" in fields) {
        const salt = await bcrypt.genSalt(SALT_ROUNDS);
        fields.password = await bcrypt.hash(fields.password, salt);
      }
    }

    return next();
  }
);
// UPDATE - Middleware END

// Cascading delete
hostSchema.pre("deleteOne", async function (next) {
  const hostId = this.getQuery()._id;

  if (!hostId) {
    return next(new Error("Host ID is undefined or invalid"));
  }

  // Check for and conditionally delete associated documents
  const calendarExists = await Calendar.exists({ host: hostId });
  if (calendarExists) {
    await Calendar.findOneAndDelete({ host: hostId });
  }

  const roomsExist = await Room.exists({ host: hostId });
  if (roomsExist) {
    await Room.deleteMany({ host: hostId });
  }

  const guestsExist = await Guest.exists({ host: hostId });
  if (guestsExist) {
    await Guest.deleteMany({ host: hostId });
  }

  const cohostsExist = await Cohost.exists({ host: hostId });
  if (cohostsExist) {
    await Cohost.deleteMany({ host: hostId });
  }

  next();
});

hostSchema.pre("deleteMany", async function (next) {
  const query = this.getQuery();

  const hosts = await mongoose.model("Host").find(query);

  if (!hosts || hosts.length === 0) {
    return next(); // No hosts to delete, exit early
  }

  const hostIds = hosts.map((host) => host._id);

  // Check for and conditionally delete associated documents
  const calendarsExist = await Calendar.exists({ host: { $in: hostIds } });
  if (calendarsExist) {
    await Calendar.deleteMany({ host: { $in: hostIds } });
  }

  const roomsExist = await Room.exists({ host: { $in: hostIds } });
  if (roomsExist) {
    await Room.deleteMany({ host: { $in: hostIds } });
  }

  const guestsExist = await Guest.exists({ host: { $in: hostIds } });
  if (guestsExist) {
    await Guest.deleteMany({ host: { $in: hostIds } });
  }

  const cohostsExist = await Cohost.exists({ host: { $in: hostIds } });
  if (cohostsExist) {
    await Cohost.deleteMany({ host: { $in: hostIds } });
  }

  next();
});

hostSchema.methods.comparePassword = async function (
  candidatePassword: string
): Promise<boolean> {
  return bcrypt.compare(candidatePassword, this.password);
};

export default mongoose.model("Host", hostSchema);
