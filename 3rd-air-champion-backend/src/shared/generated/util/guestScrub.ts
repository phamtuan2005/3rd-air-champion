// GENERATED FILE — DO NOT EDIT.
//
// Copied from 3rd-air-champion-frontend/src/util/guestScrub.ts by
// scripts/sync-cleaning-rule.js, so the apps and the backend answer this
// question with one piece of code instead of two that can disagree.
//
// Change the rule in the FRONTEND file and run `npm run build` (or
// `node scripts/sync-cleaning-rule.js`). Editing this copy is undone by
// the next build, and the drift test will fail in the meantime.

// Nothing private leaves, whatever produced it — TT's last line of defence
// (askTT.ts, "Layer 3"), in a file of its own.
//
// Shapes, not values: TT does not hold the door codes to look for. A
// house-rules note the host typed with a number in it is the case this is
// mostly for — TiMag puts the house rules in the message a confirmed guest
// gets, next to the door code and the address, so hosts write things there a
// stranger must not read.
//
// Its own file, with no imports, because the backend copies it
// (scripts/sync-cleaning-rule.js) for the TiBook connector AI assistants read
// the house through (route/assistantRoute). The connector first sent the house
// rules out exactly as typed; a review caught that before it went live
// (2026-11-24). One scrub for TT and the connector, so the two cannot come to
// hide different things.
const SCRUBS: RegExp[] = [
  /\b\d{3,8}#/g, // a door code: "1224#"
  /[^\s@]+@[^\s@]+\.[^\s@]+/g, // an email
  /\bhttps?:\/\/\S+|\bwww\.\S+/gi, // a link
  /\b\d{1,3}(?:\.\d{1,3}){3}(?::\d+)?\b/g, // an IP address
  /(?:\+?\d[\s().-]*){7,}\d/g, // a phone number, or any long run of digits
];
export const scrub = (text: string) => SCRUBS.reduce((t, re) => t.replace(re, "(hidden)"), text);
