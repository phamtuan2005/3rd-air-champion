// Which continent a TiBook visitor is on, read from the time zone their device
// is set to ("America/Los_Angeles", "Europe/Berlin").
//
// Deliberately NOT their IP address:
//  · the backend never sees a guest's real IP — CloudFront sits in front of it,
//    so every request arrives from an Amazon edge address;
//  · looking an IP up means a geo database to keep current or a third party to
//    send every guest's address to, for an answer this coarse;
//  · the house has no business keeping guests' IP addresses at all.
// A time zone is set by the phone itself, survives a VPN, and is precise enough
// for a continent. Its one blind spot is a traveller whose phone still holds
// their home zone, which is a fair answer to "where are they from" anyway.

export const CONTINENTS = [
  "North America",
  "South America",
  "Europe",
  "Asia",
  "Africa",
  "Oceania",
  "Antarctica",
  "Unknown",
] as const;

export type Continent = (typeof CONTINENTS)[number];

// Everything under America/ is North America (Central America and the
// Caribbean included, as the seven-continent model counts them) EXCEPT these.
const SOUTH_AMERICA = new Set([
  "Araguaina", "Asuncion", "Bahia", "Belem", "Boa_Vista", "Bogota",
  "Buenos_Aires", "Campo_Grande", "Caracas", "Catamarca", "Cayenne", "Cordoba",
  "Cuiaba", "Eirunepe", "Fortaleza", "Guayaquil", "Guyana", "Jujuy", "La_Paz",
  "Lima", "Maceio", "Manaus", "Mendoza", "Montevideo", "Noronha", "Paramaribo",
  "Porto_Acre", "Porto_Velho", "Punta_Arenas", "Recife", "Rio_Branco",
  "Rosario", "Santarem", "Santiago", "Sao_Paulo",
]);

// Ocean prefixes hold islands belonging to several continents.
const ATLANTIC: Record<string, Continent> = {
  Azores: "Europe", Madeira: "Europe", Canary: "Europe", Faroe: "Europe",
  Faeroe: "Europe", Reykjavik: "Europe", Jan_Mayen: "Europe",
  Bermuda: "North America",
  Cape_Verde: "Africa", St_Helena: "Africa",
  South_Georgia: "South America", Stanley: "South America",
};
const INDIAN: Record<string, Continent> = {
  Chagos: "Asia", Christmas: "Asia", Cocos: "Asia", Maldives: "Asia",
  Kerguelen: "Antarctica",
  // Antananarivo, Comoro, Mahe, Mauritius, Mayotte, Reunion fall to Africa.
};
const PACIFIC_SOUTH_AMERICA = new Set(["Galapagos", "Easter"]);

// Old link names some browsers still report instead of the canonical zone.
const LEGACY_PREFIX: Record<string, Continent> = {
  US: "North America", Canada: "North America", Mexico: "North America",
  Brazil: "South America", Chile: "South America",
};
const LEGACY_WHOLE: Record<string, Continent> = {
  Cuba: "North America", Jamaica: "North America", Navajo: "North America",
  Egypt: "Africa", Libya: "Africa",
  Eire: "Europe", GB: "Europe", "GB-Eire": "Europe", Iceland: "Europe",
  Poland: "Europe", Portugal: "Europe", Turkey: "Europe", "W-SU": "Europe",
  Hongkong: "Asia", Iran: "Asia", Israel: "Asia", Japan: "Asia", PRC: "Asia",
  ROC: "Asia", ROK: "Asia", Singapore: "Asia",
  NZ: "Oceania", "NZ-CHAT": "Oceania", Kwajalein: "Oceania",
};

export const continentOfTimeZone = (timeZone: unknown): Continent => {
  if (typeof timeZone !== "string") return "Unknown";
  const zone = timeZone.trim();
  if (!zone) return "Unknown";

  if (LEGACY_WHOLE[zone]) return LEGACY_WHOLE[zone];

  const slash = zone.indexOf("/");
  if (slash === -1) return "Unknown"; // "UTC", "GMT" — says nothing about place
  const prefix = zone.slice(0, slash);
  // America/Argentina/Salta → "Argentina"; the first segment after the prefix
  // is the one that names the place.
  const place = zone.slice(slash + 1).split("/")[0];

  switch (prefix) {
    case "America":
      return place === "Argentina" || SOUTH_AMERICA.has(place)
        ? "South America"
        : "North America";
    case "Europe":
    case "Arctic": // Longyearbyen, Svalbard
      return "Europe";
    case "Asia":
      return "Asia";
    case "Africa":
      return "Africa";
    case "Australia":
      return "Oceania";
    case "Pacific":
      // Honolulu lands here: Hawaii is a US state but an Oceanian island
      // group, and this is a map of where people are, not whose passport.
      return PACIFIC_SOUTH_AMERICA.has(place) ? "South America" : "Oceania";
    case "Atlantic":
      return ATLANTIC[place] ?? "Unknown";
    case "Indian":
      return INDIAN[place] ?? "Africa";
    case "Antarctica":
      return "Antarctica";
    default:
      return LEGACY_PREFIX[prefix] ?? "Unknown"; // Etc/GMT+8 and the like
  }
};
