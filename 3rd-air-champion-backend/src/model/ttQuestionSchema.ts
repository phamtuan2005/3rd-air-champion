import mongoose from "mongoose";

// One question a guest asked TiBook's TT, and whether TT could answer it.
//
// The host asked for these so TT can be taught what guests actually ask: the
// "not answered" pile is the to-do list, and the categories say where guests'
// attention goes. TT itself still answers on the guest's phone — this is a
// record kept AFTER the answer, never something the answer waits on.
//
// No phone, no name field, no visitor id. The question is stored with phone
// numbers, emails, links and door-code shapes already scrubbed out (by TiBook
// and again by the route, which does not trust TiBook). A guest who types their
// own name into the question is the one thing that can still arrive, which is
// why only the host and cohosts can read these (ttHostRoute, requireManager).
const ttQuestionSchema = new mongoose.Schema(
  {
    host: { type: mongoose.Schema.ObjectId, ref: "Host", required: true },
    question: { type: String, required: true },
    // Whether TT gave a real answer. A privacy refusal counts as answered —
    // TT did exactly what it should — so the "not answered" pile only holds
    // questions TT could be taught to handle.
    answered: { type: Boolean, required: true },
    // Which of TT's topics the question landed in (TT_CATEGORIES). "other"
    // when TT did not recognise it at all.
    category: { type: String, required: true, default: "other" },
    // Whether the guest was somebody TiBook already knows. Not who — only that
    // a returning guest asks different things from a stranger.
    returning: { type: Boolean, default: false },
  },
  { timestamps: true }
);

ttQuestionSchema.index({ host: 1, createdAt: -1 });

export default mongoose.model("TTQuestion", ttQuestionSchema);
