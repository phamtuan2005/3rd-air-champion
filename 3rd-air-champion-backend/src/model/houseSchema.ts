import mongoose from "mongoose";

const houseSchema = new mongoose.Schema(
  {
    reminderTemplate: {type: String},
  },
  { timestamps: true, optimisticConcurrency: true }
);

export default mongoose.model("House", houseSchema);