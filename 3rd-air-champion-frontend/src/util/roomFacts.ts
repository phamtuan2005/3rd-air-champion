import { roomType } from "./types/roomType";

// What a guest wants to know before choosing a room: how many people fit, what
// the bathroom is, how private the space really is — and the rest of the
// pictures. All of it already exists on the room's AirBnB listing — the page
// behind the ↗ on the room card — but a guest who taps a photo in TiBook
// should not have to leave for it.
//
// Keyed by AirBnB LISTING ID, deliberately:
//   - `roomCode` is the door code ("1224#"), not an identifier. It is a secret
//     that must never reach the guest, and it is not even unique — Chill and
//     ChillChill both carry "0205#".
//   - `name` is renameable, and has been renamed.
//   - the listing id is stable, unique per room, and is the very page these
//     facts were read off, so the key names its own source.
//
// Transcribed by hand from each listing. If a listing changes, this does not
// notice — so keep the wording factual and re-check it when a room is redone.
//
// The rooms are NOT variations on one template, and the differences are the
// ones a guest cares about most: Chill and Cozy share a bathroom rather than
// having their own, and Cozy has no air conditioning and no TV. Copying one
// room's list onto another would promise things the house cannot deliver,
// which a guest finds out at 11pm.
//
// The kitchen is the one exception: it is the same on all five. This read
// "King is the only room with kitchen access" until the house said otherwise
// — see `houseKitchen` below.

// What the bed actually is, kept apart from how it is written, so each bed can
// carry its own picture. A guest skimming five rooms on a phone reads the
// shapes before the words.
export type bedKind = "queen" | "double" | "sofa";

export interface bedEntry {
  kind: bedKind;
  label: string;
}

export interface roomFacts {
  // Airbnb's own ceiling for the listing ("3 guests maximum"), not a bed count.
  maxGuests: number;
  beds: bedEntry[];
  // Whether it is private or shared is stated first, because that is the
  // question, and a guest who assumes wrong has a bad night.
  bathroom: string;
  // Said plainly, because "private" on a listing can mean either a private room
  // in a shared house or a whole place, and the difference is the thing a guest
  // is actually asking about.
  privacy: string;
  // The handful worth showing on a phone, and only what THIS listing offers.
  // The full list stays on the listing, one tap away on the same card.
  highlights: string[];
  // Exactly TWO, and in this order: where you'll sleep, then the bathroom.
  // The house decided a guest choosing a room needs those two answers and not
  // a tour — the galleries used to run to 28-31 pictures each, most of them
  // the same garden and hallway repeated per room. `housePhotos` below adds
  // the three shared shots, so a gallery is five pictures and 13 files cover
  // the whole house.
  //
  // Hot-linked from AirBnB's own CDN. Self-hosting was measured and rejected:
  // not for size (the whole set was 12.3 MB as AVIF) but because it turns a
  // photo swap into a code change. Uploaded through TiMag they stay the host's
  // to replace in a minute; committed to this repo they need an engineer, a
  // review and a deploy, and the binaries sit in git history for good.
  //
  // What that costs instead: TiBook leans on a0.muscache.com staying up, and a
  // URL here dies the moment that photo is removed from its listing — which
  // now matters MORE, not less, with only two per room. One deletion and a
  // room is down to a single picture, so re-check these when a room is redone.
  //
  // ?im_w=1200 asks the CDN for a phone-sized copy instead of the original.
  photos: string[];
}

const listingId = (airbnbUrl?: string) => {
  if (!airbnbUrl) return undefined;
  return airbnbUrl.match(/\/rooms\/(\d+)/)?.[1];
};

// The house itself, shown at the end of EVERY room's gallery. These three are
// shared on purpose: the front, the garden and the hallway are the same
// whichever room a guest books, and five near-identical copies of them was the
// bulk of what made the galleries long. Two pictures of the room, then three of
// the house — five in total, and a guest can see all of it without paging.
//
// Which listing each came off is incidental; they are pictures of the house,
// not of that room.
// True of the house, not of any one room, so it is written once and shown on
// every room rather than copied into five entries that could drift apart.
//
// Note this CONTRADICTS the AirBnB listings, which mark the kitchen
// "Unavailable" on every room but King. The house says otherwise and the house
// is the authority on its own kitchen — but TiBook links to those listings, so
// a guest can read both. They want correcting.
export const houseKitchen = "Shared kitchen, open to every guest in the house";

// The other fact that belongs to the whole house rather than to any one room,
// and the reason a guest picks a room here over a lockbox in an empty hallway:
// the host is not a landlord somewhere else. They live in it.
//
// Written as a fact, not as a feeling. "Peace of mind" tells a guest how they
// ought to feel; naming what the host IS and where they LIVE lets the guest
// draw it themselves, which is how the rest of TiBook talks.
//
// Kept to ONE line on a 360px phone (a Galaxy S at default zoom), which is the
// real constraint here: this sits in a two-line band above the calendar, and a
// third line comes straight out of the calendar on a short screen.
//
// The budget is 45 characters, MEASURED rather than estimated — 45 fits on one
// line at 360px and 46 wraps. "living here" instead of "living in the house"
// is what buys the fit; on the house's own booking page "here" is not
// ambiguous. Re-measure if you lengthen this or if a host name grows: the name
// is interpolated, so it spends the same budget.
//
// Takes the host's first name so the sentence names the person whose face is
// at the top of the same screen, rather than an abstract "your host".
export const hostOnSite = (hostFirstName?: string) =>
  `Stay with ${hostFirstName || "your host"}, an engineer living here`;

// The bathroom fact the AirBnB titles sell the house on, said at house level
// on the host's instruction.
//
// CHECK THIS AGAINST THE ROOMS BEFORE TRUSTING IT. The entries transcribed
// below give a smart toilet to King, Queen and Cute only; Chill and Cozy share
// a bathroom listed with a bidet and no smart toilet. So this line and those
// two entries currently disagree, and a guest can see both — this on the
// first screen, the room's own bathroom one tap into its gallery.
//
// It was briefly "A smart toilet or a bidet in every bathroom", the phrasing
// true of all five. The house is the authority on its own bathrooms, exactly
// as it is on its own kitchen — but if the shared bathroom really did get a
// smart toilet, Chill's and Cozy's `bathroom` lines below are the stale ones
// and want updating to match.
//
// "in all bathrooms" says the scope out loud rather than leaving it implied,
// which is what makes the disagreement above worth resolving rather than
// living with. 42 characters, inside the 45 that fit one line at 360px.
export const houseBathrooms = "Smart toilet with a bidet in all bathrooms";

const housePhotos = [
  // The front of the house, from the street.
  "https://a0.muscache.com/im/pictures/hosting/Hosting-1586635483950294231/original/98a07cfc-7ac1-4717-9245-09091f2463d1.jpeg?im_w=1200",
  // The back garden and its covered patio.
  "https://a0.muscache.com/im/pictures/hosting/Hosting-1144526275550691711/original/fc9ba443-bae5-4060-8556-4845ad5268b6.jpeg?im_w=1200",
  // The hallway a guest walks in through.
  "https://a0.muscache.com/im/pictures/hosting/Hosting-1586635483950294231/original/a3082240-c07c-483d-a8d9-407df1b9fced.jpeg?im_w=1200",
];

const factsByListing: Record<string, roomFacts> = {
  // King — https://www.airbnb.com/rooms/1586635483950294231
  "1586635483950294231": {
    maxGuests: 3,
    beds: [
      { kind: "queen", label: "1 queen bed" },
      { kind: "sofa", label: "1 sofa bed" },
    ],
    bathroom: "Private attached bathroom, with a smart toilet and bidet",
    privacy: "Your own room, with a lock on the door",
    highlights: [
      "Wifi",
      "Air conditioning",
      "Heating",
      "Dedicated workspace",
      // No "Kitchen" chip: the shared kitchen is now a line of its own on every
      // room, and saying it twice on this one is the repetition just taken out
      // of Chill's and Cozy's bathrooms.
      "Mini fridge",
      "Free street parking",
      "Self check-in",
    ],
    photos: [
      // Where you'll sleep.
      "https://a0.muscache.com/im/pictures/hosting/Hosting-1586635483950294231/original/a2700f0b-667a-4ef2-bc93-5bb2123dd5f1.jpeg?im_w=1200",
      // The bathroom, so nobody has to guess what they are getting.
      "https://a0.muscache.com/im/pictures/hosting/Hosting-1586635483950294231/original/0639beb3-8e36-4bc1-a6a4-ed91857a20b9.jpeg?im_w=1200",
    ],
  },

  // Queen — https://www.airbnb.com/rooms/1591510685354579225
  "1591510685354579225": {
    maxGuests: 3,
    beds: [
      { kind: "queen", label: "1 queen bed" },
      { kind: "sofa", label: "1 sofa bed" },
    ],
    bathroom: "Private attached bathroom, with a smart toilet and bidet",
    // The balcony is this room's own — it is the reason a guest picks Queen
    // over King, so it belongs next to the privacy, not buried in a chip.
    privacy: "Your own room and private balcony, with a lock on the door",
    highlights: [
      "Wifi",
      "Air conditioning",
      "Heating",
      "Dedicated workspace",
      "Mini fridge",
      "Microwave",
      "Free parking on premises",
      "Self check-in",
    ],
    photos: [
      // Where you'll sleep.
      "https://a0.muscache.com/im/pictures/hosting/Hosting-1591510685354579225/original/4bac8d30-2e80-4a79-9472-410e6bc84690.jpeg?im_w=1200",
      // The bathroom, so nobody has to guess what they are getting.
      "https://a0.muscache.com/im/pictures/hosting/Hosting-1591510685354579225/original/d98a0e78-4438-4528-81f8-848984629fb5.jpeg?im_w=1200",
    ],
  },

  // Cute — https://www.airbnb.com/rooms/1144526275550691711
  "1144526275550691711": {
    maxGuests: 2,
    beds: [{ kind: "queen", label: "1 queen bed" }],
    bathroom: "Private attached bathroom, with a bathtub and a heated smart toilet",
    privacy: "Your own room, with a lock on the door",
    highlights: [
      "Wifi",
      "Central air conditioning",
      "Heating",
      "Dedicated workspace",
      "Mini fridge",
      "Coffee maker",
      "Backyard",
      "Free street parking",
      "Self check-in",
    ],
    photos: [
      // Where you'll sleep.
      "https://a0.muscache.com/im/pictures/hosting/Hosting-1144526275550691711/original/abce9db1-df7e-4a52-8ecf-87ed350f35b2.jpeg?im_w=1200",
      // The bathroom, so nobody has to guess what they are getting.
      "https://a0.muscache.com/im/pictures/hosting/Hosting-1144526275550691711/original/93ad7680-b6aa-4513-b17e-6ffd5795a34e.jpeg?im_w=1200",
    ],
  },

  // Chill — https://www.airbnb.com/rooms/1400962263132112124
  "1400962263132112124": {
    maxGuests: 2,
    beds: [{ kind: "queen", label: "1 queen bed" }],
    // Shared, and said so. Guessing wrong about this is the single worst
    // surprise a guest can arrive to.
    bathroom: "Shared bathroom, with a bathtub, bidet and hot water",
    privacy: "Your own room, with a lock on the door",
    highlights: [
      "Wifi",
      "Air conditioning",
      "Heating",
      "Dedicated workspace",
      "TV",
      "Mini fridge",
      "Microwave",
      "Free street parking",
      "Self check-in",
    ],
    photos: [
      // Where you'll sleep.
      "https://a0.muscache.com/im/pictures/hosting/Hosting-1400962263132112124/original/97a1121e-ffc6-4994-bd8c-8af3b80a0aa9.jpeg?im_w=1200",
      // The bathroom, so nobody has to guess what they are getting.
      "https://a0.muscache.com/im/pictures/hosting/Hosting-1400962263132112124/original/02e4e973-5262-4a8d-8cd4-85586c110b92.jpeg?im_w=1200",
    ],
  },

  // Cozy — https://www.airbnb.com/rooms/1177648203505001777
  "1177648203505001777": {
    maxGuests: 1,
    beds: [{ kind: "double", label: "1 double bed" }],
    bathroom: "Shared bathroom, with a bathtub, bidet and hot water",
    privacy: "Your own room, with a lock on the door",
    // No air conditioning and no TV on this listing — both are listed as
    // unavailable. Do not add them back by copying another room's list.
    highlights: [
      "Wifi",
      "Heating",
      "Portable fans",
      "Dedicated workspace",
      "Towels and bed linen",
      "Free parking on premises",
      "Self check-in",
    ],
    photos: [
      // Where you'll sleep.
      "https://a0.muscache.com/im/pictures/hosting/Hosting-1177648203505001777/original/6b87e765-a704-4438-9304-a069e994535b.jpeg?im_w=1200",
      // The bathroom, so nobody has to guess what they are getting.
      "https://a0.muscache.com/im/pictures/hosting/Hosting-1177648203505001777/original/d8ece2ab-e965-4a74-a1db-35c16dc2d869.jpeg?im_w=1200",
    ],
  },
};

// Undefined for a room with no listing behind it — every caller must be happy
// to show nothing rather than a gap where facts should be.
export const getRoomFacts = (airbnbUrl?: string): roomFacts | undefined => {
  const id = listingId(airbnbUrl);
  return id ? factsByListing[id] : undefined;
};

// The ONE list of a room's pictures. The card's photo-count badge and the
// gallery both ask this, so they cannot drift apart and show a guest "12" over
// a gallery that then pages through 3.
//
// Where a room has listing photos, they REPLACE the stored one rather than
// following it. The stored photo turned out to be the listing's own first shot
// saved smaller (480x360 against 1200x900), so keeping both opened the gallery
// on a duplicate and then changed size as the guest paged on.
export const getRoomPhotos = (room: roomType): string[] => {
  const listing = getRoomFacts(room.airbnbUrl)?.photos ?? [];
  const own = listing.length > 0 ? listing : (room.photos?.filter(Boolean) ?? []);
  // The room's own pictures first — the card's thumbnail is the first of these,
  // so a room must never be represented by a shot of the hallway. A room with
  // no pictures of its own gets none of the house's either: the card falls back
  // to its coloured initial rather than pretending to show the room.
  return own.length > 0 ? [...own, ...housePhotos] : [];
};
