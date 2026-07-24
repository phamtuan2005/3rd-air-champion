// Dependency-free, deterministic illustrated avatars. We store only a short
// free-text "character" note per team member (e.g. "cheerful 24yo, glasses,
// short black hair"); the picture is generated from that note + the person's
// name, so the same inputs always yield the same friendly flat-style face.
//
// Recognised keywords (everything else is randomised, but stably, from the
// name so each member still looks distinct):
//   glasses · beard / mustache · bald · long hair / ponytail (or girl/woman)
//   hair colour: black / brown / blond(e) / red|ginger / gray|grey / white|silver
//   skin: pale|fair · tan · dark|brown|black skin
//   old (→ gray hair)

const BG = ["#DBEAFE", "#DCFCE7", "#EDE9FE", "#FEF3C7", "#FFE4E6", "#CFFAFE", "#FCE7F3", "#E0E7FF"];
const SKIN = ["#F8D9C0", "#F1C39B", "#E0A579", "#C68642", "#8D5524"];
const SHIRT = ["#2563EB", "#059669", "#7C3AED", "#D97706", "#DC2626", "#0891B2", "#DB2777", "#4F46E5"];
const HAIR = {
  black: "#2B2B2B",
  brown: "#6B4423",
  blonde: "#D9A441",
  red: "#A63A1E",
  gray: "#9CA3AF",
  white: "#E5E7EB",
};

// FNV-1a — small, stable string hash (deterministic across sessions/devices).
const hash = (s: string) => {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
};

const pick = <T,>(arr: T[], n: number) => arr[n % arr.length];

export const generateAvatar = (seed: string, character = ""): string => {
  const c = character.toLowerCase();
  const h = hash(`${seed}|${character}`);
  // A few independent deterministic streams from the one hash.
  const s1 = h;
  const s2 = (h >>> 5) ^ 0x9e3779b1;
  const s3 = Math.imul(h ^ 0x85ebca6b, 2654435761) >>> 0;
  const s4 = Math.imul(h >>> 13, 40503) >>> 0;

  const bg = pick(BG, s1);
  const shirt = pick(SHIRT, s2);

  let skin = pick(SKIN, s3);
  if (/\b(pale|fair)\b/.test(c)) skin = SKIN[0];
  else if (/\btan\b/.test(c)) skin = SKIN[2];
  else if (/\b(dark|brown|black)\s*skin\b/.test(c)) skin = SKIN[4];

  const hairShades = Object.values(HAIR);
  let hairColor = pick(hairShades, s4);
  if (/\bblack hair\b/.test(c)) hairColor = HAIR.black;
  else if (/\bbrown hair\b/.test(c)) hairColor = HAIR.brown;
  else if (/\bblond/.test(c)) hairColor = HAIR.blonde;
  else if (/\b(red|ginger)\b/.test(c)) hairColor = HAIR.red;
  else if (/\b(gray|grey|old)\b/.test(c)) hairColor = HAIR.gray;
  else if (/\b(white hair|silver)\b/.test(c)) hairColor = HAIR.white;

  const bald = /\bbald\b/.test(c);
  const glasses = /glass/.test(c);
  const beard = /beard/.test(c);
  const mustache = beard || /(mustache|moustache)/.test(c);
  const longHair =
    !bald && /\b(girl|woman|female|long hair|ponytail|braid)\b/.test(c);

  const eye = "#3A3A3A";
  const parts: string[] = [];

  // Background (the round container clips this square to a circle).
  parts.push(`<rect width="100" height="100" fill="${bg}"/>`);
  // Shoulders in a shirt colour.
  parts.push(`<circle cx="50" cy="104" r="30" fill="${shirt}"/>`);
  // Long hair sits behind the head, framing the sides.
  if (longHair) parts.push(`<rect x="25" y="38" width="50" height="36" rx="18" fill="${hairColor}"/>`);
  // Neck.
  parts.push(`<rect x="45" y="58" width="10" height="12" fill="${skin}"/>`);
  // Ears.
  parts.push(`<circle cx="30" cy="47" r="4" fill="${skin}"/><circle cx="70" cy="47" r="4" fill="${skin}"/>`);
  // Hair blob (a crescent peeking above the face), unless bald.
  if (!bald) parts.push(`<circle cx="50" cy="39" r="23" fill="${hairColor}"/>`);
  // Head.
  parts.push(`<circle cx="50" cy="46" r="21" fill="${skin}"/>`);
  // Eyebrows.
  parts.push(
    `<rect x="38" y="39" width="8" height="1.8" rx="0.9" fill="${hairColor}"/>` +
      `<rect x="54" y="39" width="8" height="1.8" rx="0.9" fill="${hairColor}"/>`,
  );
  // Eyes.
  parts.push(`<circle cx="42" cy="45" r="2.3" fill="${eye}"/><circle cx="58" cy="45" r="2.3" fill="${eye}"/>`);
  // Beard around the jaw (drawn before the mouth so the smile stays visible).
  if (beard)
    parts.push(
      `<path d="M31,49 C33,66 44,70 50,70 C56,70 67,66 69,49 C64,60 58,62 50,62 C42,62 36,60 31,49 Z" fill="${hairColor}"/>`,
    );
  // Mouth (smile).
  parts.push(`<path d="M43,55 Q50,61 57,55" fill="none" stroke="#9B4A3C" stroke-width="2" stroke-linecap="round"/>`);
  // Mustache.
  if (mustache) parts.push(`<path d="M43,53 Q50,57 57,53 Q50,51 43,53 Z" fill="${hairColor}"/>`);
  // Glasses.
  if (glasses)
    parts.push(
      `<g stroke="#333" stroke-width="1.6" fill="none">` +
        `<circle cx="42" cy="45" r="5.6"/><circle cx="58" cy="45" r="5.6"/>` +
        `<line x1="47.6" y1="45" x2="52.4" y2="45"/>` +
        `<line x1="36.4" y1="44" x2="30" y2="42"/><line x1="63.6" y1="44" x2="70" y2="42"/>` +
        `</g>`,
    );

  const svg =
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">${parts.join("")}</svg>`;
  return `data:image/svg+xml,${encodeURIComponent(svg)}`;
};
