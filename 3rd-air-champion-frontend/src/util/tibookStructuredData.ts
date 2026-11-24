import { roomType } from "./types/roomType";
import { hostType } from "./types/hostType";
import { getRoomFacts, getRoomPhotos, houseBathrooms, houseKitchen, houseParking } from "./roomFactsData";
import { priceRangeOf } from "./priceRange";

// TiBook described in schema.org terms, for software rather than people.
//
// AI assistants (Meta's Muse, ChatGPT and the like) now browse for their users,
// and TiBook is built for a person reading cards and tapping a calendar. An
// assistant reading it had to make out the rooms from the layout. This states
// them in the vocabulary search engines and assistants already read: the
// house, each room, who it fits, what it has, and the nightly range. Approved
// by Anh-Tuan 2026-11-24, with the TiBook connector (backend
// route/assistantRoute) as the way an assistant actually sends a request.
//
// The same rule as everywhere a stranger reads TiBook: what the room cards
// show, and nothing else. No door code (roomCode), no check-in instructions, no
// street address, and no guest's own rate — the range from util/priceRange is
// what every stranger sees.
//
// Built from the facts in English, the way the backend copy reads them, not
// through t(): this is for machines, and it should not change with whatever
// language the last guest on this device picked.

const HOUSE_NAME = "TT House";

export const tibookStructuredData = (host: hostType | null, rooms: roomType[], pageUrl: string) => {
  const shown = rooms.filter((r) => r.active !== false);
  const houseFeatures = [houseKitchen, houseParking, houseBathrooms, "Self check-in"];
  const feature = (name: string) => ({ "@type": "LocationFeatureSpecification", name, value: true });

  return {
    "@context": "https://schema.org",
    "@type": "LodgingBusiness",
    name: HOUSE_NAME,
    url: pageUrl,
    // The motto is a promise TO THE GUEST, so it is said as one (CLAUDE.md).
    description:
      `A five-room short-stay house in Silicon Valley, California, where the host lives. ` +
      `Its promise to guests: "Your comfort. Our mission." ` +
      `Requests are confirmed by the host by text; the street address is sent once a stay is confirmed.`,
    // Region only — the address is the guest's once the stay is confirmed.
    address: { "@type": "PostalAddress", addressRegion: "CA", addressCountry: "US" },
    areaServed: "Silicon Valley",
    amenityFeature: houseFeatures.map(feature),
    ...(host?.airbnbRating && host.airbnbReviewCount
      ? {
          aggregateRating: {
            "@type": "AggregateRating",
            ratingValue: host.airbnbRating,
            reviewCount: host.airbnbReviewCount,
            bestRating: 5,
          },
        }
      : {}),
    containsPlace: shown.map((room) => {
      const facts = getRoomFacts(room.airbnbUrl);
      const photos = getRoomPhotos(room);
      return {
        "@type": "HotelRoom",
        name: room.name,
        ...(facts
          ? {
              description: `${facts.privacy}. ${facts.bathroom}.`,
              occupancy: { "@type": "QuantitativeValue", maxValue: facts.maxGuests },
              bed: facts.beds.map((b) => b.label).join(", "),
              amenityFeature: facts.highlights.map(feature),
            }
          : {}),
        ...(photos.length > 0 ? { image: photos } : {}),
      };
    }),
    makesOffer: shown.flatMap((room) => {
      const range = priceRangeOf(room.price);
      if (!range) return [];
      return [
        {
          "@type": "Offer",
          itemOffered: { "@type": "HotelRoom", name: room.name },
          priceSpecification: {
            "@type": "UnitPriceSpecification",
            priceCurrency: "USD",
            minPrice: range.min,
            maxPrice: range.max,
            unitText: "night",
          },
          description: "A nightly range; the host agrees the exact price with the guest by text.",
        },
      ];
    }),
    potentialAction: {
      "@type": "ReserveAction",
      target: pageUrl,
      description: "Ask to book on TiBook. Nothing is booked until the host confirms.",
    },
  };
};

// The one <script> TiBook keeps in <head>, replaced when the rooms change.
export const STRUCTURED_DATA_ID = "tibook-structured-data";
