import mongoose from "mongoose";
import parsePhoneNumber, { isPossiblePhoneNumber } from "libphonenumber-js";
import Host from "./hostSchema";
import Day from "./daySchema";

const guestSchema = new mongoose.Schema(
  {
    name: { type: String, required: true },
    alias: { type: String, default: "" },
    email: {
      type: String,
      match: /^[a-zA-Z0-9._-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/,
    },
    phone: { type: String, required: true },
    numberOfGuests: { type: Number, required: true, default: 1 },
    pricing: [
      {
        room: { type: mongoose.Schema.ObjectId, ref: "Room" },
        price: { type: Number, default: 0 },
      },
    ],
    returning: { type: Boolean, required: true, default: false },
    notes: { type: String, default: "" },
    // Short free-text note the illustrated avatar is generated from, the same
    // field cleaners carry. Only the note is stored — the picture is derived
    // deterministically from it plus the name, so nothing is uploaded and no
    // image sits on a disk whose filling up takes mongod down with it.
    character: { type: String, default: "" },
    host: { type: mongoose.Schema.ObjectId, ref: "Host", required: true },
  },
  { timestamps: true, optimisticConcurrency: true }
);

guestSchema.pre("deleteMany", async function (next) {
  const query = this.getQuery();
  (this as any).toBeDeletedGuestId = await mongoose.model("Guest").find(query);

  return next();
});

guestSchema.pre("validate", function (next) {
  // Number of Guests validation
  if (this.numberOfGuests < 1)
    return next(new Error("Guests must be more than 1"));

  // Name validation
  const specialCharRegex = /[`!@#$%^&*()_+=\[\]{};:"\\|,<>\/?~]/;

  if (specialCharRegex.test(this.name))
    return next(new Error("Name cannot contain special characters"));

  return next();
});

guestSchema.pre(
  ["updateMany", "updateOne", "findOneAndUpdate"],
  async function (next) {
    const query = this.getQuery();
    const update = this.getUpdate();

    (this as any).originalGuests = await mongoose.model("Guest").find(query);

    if (update && typeof update === "object" && !Array.isArray(update)) {
      if ("phone" in update) {
        // Phone sanitization
        if (isPossiblePhoneNumber(update.phone, "US")) {
          const phoneNumber = parsePhoneNumber(update.phone, "US");
          if (update.phone && phoneNumber) {
            update.phone = phoneNumber.formatNational();
          }
        } else {
          return next(new Error("Invalid phone number"));
        }
      }

      // Number of Guests validation
      if ("numberOfGuests" in update) {
        if (update.numberOfGuests < 1)
          return next(new Error("Guests must be more than 1"));
      }

      if ("name" in update) {
        // Name validation
        const specialCharRegex = /[`!@#$%^&*()_+=\[\]{};:"\\|,<>\/?~]/;

        if (specialCharRegex.test(update.name))
          return next(new Error("Name cannot contain special characters"));
      }

      if ("email" in update) {
        update.email = update.email.toLowerCase();
      }

      if ("host" in update) {
        if (!(await Host.exists({ _id: update.host._id })))
          return next(new Error("Host does not exist"));
      }
    }

    return next();
  }
);

guestSchema.pre("save", function (next) {
  // Notes sanitization
  if (this.notes === null) this.notes = "";

  // Phone sanitization
  if (isPossiblePhoneNumber(this.phone, "US")) {
    const phoneNumber = parsePhoneNumber(this.phone, "US");
    if (this.phone && phoneNumber) {
      this.phone = phoneNumber.formatNational();
    }
  } else {
    return next(new Error("Invalid phone number"));
  }

  // Email sanitization
  this.email = this.email?.toLocaleLowerCase();

  return next();
});

guestSchema.pre("save", async function (next) {
  if (!(await Host.exists({ _id: this.host })))
    return next(new Error("Host does not exist"));

  return next;
});

guestSchema.post("save", async function (doc) {
  await Host.findByIdAndUpdate(
    doc.host,
    { $addToSet: { guests: doc._id } },
    { new: true }
  );
});

guestSchema.post("findOneAndUpdate", async function (doc) {
  await Host.findByIdAndUpdate(doc.host, { $addToSet: { guests: doc._id } });
  await Host.updateMany(
    { _id: { $ne: doc.host } },
    { $pull: { guests: doc._id } }
  );
});

guestSchema.post("updateMany", async function () {
  const update = this.getUpdate();

  if ((update as any).$set?.host) {
    const newHostId = (update as any).$set.host;
    const originalGuestIds = (this as any).originalGuests.map(
      (guest: any) => guest._id
    );

    // Remove guests from other hosts
    await Host.updateMany(
      { _id: { $ne: newHostId } },
      { $pull: { guests: { $in: originalGuestIds } } }
    );

    // Add guests to the new host
    await Host.updateOne(
      { _id: newHostId },
      { $addToSet: { guests: { $each: originalGuestIds } } }
    );
  }
});

guestSchema.post("findOneAndDelete", async function (doc) {
  await Host.findByIdAndUpdate(
    doc.host,
    { $pull: { guests: doc._id } },
    { new: true }
  );

  await Day.updateMany(
    { "bookings.guest": doc._id }, // Match bookings with the deleted guest
    { $pull: { bookings: { guest: doc._id } } } // Remove bookings with the deleted guest
  );
});

guestSchema.post("deleteMany", async function (doc) {
  // Assuming `toBeDeletedGuestId` is an array of guest IDs
  const toBeDeletedGuestIds = (this as any).toBeDeletedGuestId.map(
    (guest: any) => guest._id
  );

  await Day.updateMany(
    { "bookings.guest": { $in: toBeDeletedGuestIds } }, // Match any booking containing the deleted guests
    { $pull: { bookings: { guest: { $in: toBeDeletedGuestIds } } } } // Remove all bookings with the deleted guests
  );
});

guestSchema.index(
  { email: 1, host: 1 },
  {
    unique: true,
    partialFilterExpression: {
      email: { $type: "string" },
    },
  }
);
guestSchema.index({ returning: 1 });
guestSchema.index({ notes: 1 }, { sparse: true });

export default mongoose.model("Guest", guestSchema);
