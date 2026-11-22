import mongoose from "mongoose";

// A review text TiBook shows guests, in one of TiBook's other languages.
//
// The review summaries and each room's latest review are written in English
// (the host publishes the summaries; the latest review is the guest's own
// words). A Chinese guest who opened a room's reviews read Chinese all round
// them and then the reviews themselves in English (host, 2026-11-21). So each
// text is translated ONCE per language, on the server, when the host changes
// the reviews — and guests only ever READ these rows. TT on the guest's phone
// stays model-free: no guest question ever waits on, or pays for, a model.
//
// Keyed by the English text's hash, not by room or host: the same words need
// the same translation wherever they appear, and an edited summary is simply
// a new key — the old row is never served again.
const ttTranslationSchema = new mongoose.Schema(
  {
    key: { type: String, required: true },
    lang: { type: String, required: true },
    text: { type: String, required: true },
  },
  { timestamps: true }
);
ttTranslationSchema.index({ key: 1, lang: 1 }, { unique: true });

const TTTranslation = mongoose.model("TTTranslation", ttTranslationSchema);
export default TTTranslation;
