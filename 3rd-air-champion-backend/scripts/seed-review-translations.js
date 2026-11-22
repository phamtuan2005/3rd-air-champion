// Saves hand-made translations of TiBook's review texts (review-translations.json)
// into TTTranslation, where GET /tt/reviews/:host?lang= reads them.
//
// Why by hand: the server translates these with Claude (util/reviewTranslate),
// but on 2026-11-21 the API account had no credit, and the host chose to have
// them translated in a Claude Code session instead of paying for the API.
// Each entry carries its English text exactly as guests are shown it; the key
// is computed here by the SERVER's own textKey, so a translation can only land
// on the text it was made for. A text that has since changed is simply never
// matched — guests see its English until it is translated again.
//
// Usage (on EC2, after `npm run build`):
//   node scripts/seed-review-translations.js           # dry run: what would be saved
//   node scripts/seed-review-translations.js --apply   # save them

const path = require("path");
require("dotenv").config({ path: path.join(__dirname, "../.env") });
const mongoose = require("mongoose");

const dist = (p) => require(path.join(__dirname, "../dist", p));
const TTTranslation = dist("model/ttTranslationSchema").default;
const { textKey, REVIEW_LANGS } = dist("util/reviewTranslate");
const { items } = require("./review-translations.json");

const APPLY = process.argv.includes("--apply");

(async () => {
  if (!process.env.MONGO_URI) {
    console.error("MONGO_URI not found in .env");
    process.exit(1);
  }
  await mongoose.connect(process.env.MONGO_URI);
  let saved = 0;
  for (const item of items) {
    const key = textKey(item.en);
    for (const lang of Object.keys(REVIEW_LANGS)) {
      const text = String(item[lang] ?? "").trim();
      if (!text) continue;
      if (APPLY) {
        await TTTranslation.updateOne({ key, lang }, { $set: { text } }, { upsert: true });
      }
      saved++;
    }
    console.log(`${APPLY ? "saved" : "would save"}: ${item.en.slice(0, 60)}…`);
  }
  console.log(`${APPLY ? "Saved" : "Would save"} ${saved} translations of ${items.length} texts.${APPLY ? "" : " Run with --apply to save."}`);
  await mongoose.disconnect();
})().catch((err) => {
  console.error(err);
  process.exit(1);
});
