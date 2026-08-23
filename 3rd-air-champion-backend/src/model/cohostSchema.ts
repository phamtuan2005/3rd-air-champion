import mongoose from "mongoose";
import { updateShapes } from "../util/updateShapes";
import bcrypt from "bcrypt";
import Host from "./hostSchema";

const SALT_ROUNDS = 10;

const cohostSchema = new mongoose.Schema(
  {
    email: {
      type: String,
      match: /^[a-zA-Z0-9._-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/,
      required: true,
      unique: true,
    },
    password: { type: String, required: true },
    name: { type: String, required: true },
    host: {
      type: mongoose.Schema.ObjectId,
      ref: "Host",
      required: true,
    },
  },
  { timestamps: true, optimisticConcurrency: true }
);

cohostSchema.pre(
  ["deleteOne", "deleteMany", "findOneAndDelete"],
  async function (next) {
    const query = this.getQuery();
    (this as any).originalCohosts = await mongoose.model("Cohost").find(query);

    return next();
  }
);

cohostSchema.pre("validate", function (next) {
  // Name validation
  const specialCharRegex = /[`!@#$%^&*()_+=\[\]{};:"\\|,<>\/?~]/;

  if (specialCharRegex.test(this.name))
    return next(new Error("Name cannot contain special characters"));

  return next();
});

cohostSchema.pre(
  ["updateMany", "updateOne", "findOneAndUpdate"],
  async function (next) {
    const query = this.getQuery();
    const update = this.getUpdate();

    (this as any).originalCohosts = await mongoose.model("Cohost").find(query);

    // Every shape the fields can arrive in — see util/updateShapes. This read
    // only the top level, so a caller passing { $set: { password } } had their
    // cohost password written to the database in PLAINTEXT: the same failure
    // found in hostSchema, from the opposite direction.
    for (const fields of updateShapes(update)) {
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

      if ("host" in fields) {
        if (!(await Host.exists({ _id: fields.host._id })))
          return next(new Error("Host does not exist"));
      }
    }

    return next();
  }
);

cohostSchema.pre("save", function (next) {
  // Email sanitization
  this.email = this.email?.toLocaleLowerCase();

  return next();
});

cohostSchema.pre("save", async function (next) {
  if (!(await Host.exists({ _id: this.host })))
    return next(new Error("Host does not exist"));

  if (!this.isModified("password")) return next();

  const salt = await bcrypt.genSalt(SALT_ROUNDS);
  this.password = await bcrypt.hash(this.password, salt);

  return next();
});

// Detach cohost to host on delete
cohostSchema.post("findOneAndDelete", async function (doc) {
  await Host.findByIdAndUpdate(doc.host, { $pull: { cohosts: doc._id } });
});

cohostSchema.post("deleteMany", async function (doc) {
  const cohostIds = (this as any).originalCohosts.map(
    (cohost: any) => cohost._id
  );

  await Host.updateMany(
    { _id: { $in: cohostIds } },
    { $pull: { cohosts: { $in: cohostIds } } }
  );
});

// Attach cohost to host after updating
// Need to work on detaching the cohosts from the old one
cohostSchema.post("findOneAndUpdate", async function (doc) {
  await Host.findByIdAndUpdate(doc.host, { $addToSet: { cohosts: doc._id } });
  await Host.updateMany(
    { _id: { $ne: doc.host } },
    { $pull: { cohosts: doc._id } }
  );
});

cohostSchema.post("updateMany", async function () {
  const update = this.getUpdate();

  // Ensure the update object and `$set.host` exist
  if (!(update as any).$set?.host) return;

  const newHostId = (update as any).$set.host;
  const originalCohostIds = (this as any).originalCohosts?.map(
    (cohost: any) => cohost._id
  );

  // Remove cohosts from hosts that are not the new host
  await Host.updateMany(
    { _id: { $ne: newHostId } },
    { $pull: { cohosts: { $in: originalCohostIds } } }
  );

  // Add cohosts to the new host
  await Host.updateMany(
    { _id: newHostId },
    { $addToSet: { cohosts: { $each: originalCohostIds } } }
  );
});

// Attach cohost to host after creating
cohostSchema.post("save", async function (doc) {
  await Host.findByIdAndUpdate(
    doc.host,
    { $addToSet: { cohosts: doc._id } },
    { new: true }
  );
});

cohostSchema.methods.comparePassword = async function (
  candidatePassword: string
): Promise<boolean> {
  return bcrypt.compare(candidatePassword, this.password);
};

cohostSchema.index({ _id: 1, host: 1 }, { unique: true });

export default mongoose.model("Cohost", cohostSchema);
