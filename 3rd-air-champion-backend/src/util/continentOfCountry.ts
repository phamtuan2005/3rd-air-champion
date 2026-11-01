import type { Continent } from "./continentOfTimeZone";

// Which continent a TiBook visitor is on, from the country CloudFront says
// their connection comes from (the CloudFront-Viewer-Country header, an ISO
// 3166-1 alpha-2 code such as "VN" or "US").
//
// This replaced the device time zone as the first answer. The zone is a phone
// setting, so a visitor could be placed anywhere by changing it, and a phone
// with automatic time zone turned off keeps a traveller at home. The house
// asked for it after Anh-Tuan, using TiBook from Asia, could not tell from the
// map whether he was being placed there at all. The connection
// moves with the person. It still trusts nothing about the visitor's real
// address: CloudFront looks the country up at the edge and passes only the two
// letters, so the backend never sees an IP and needs no geo database.
//
// Its blind spot is a VPN, which places a visitor wherever the VPN exits. The
// time zone (continentOfTimeZone) is kept as the fallback for a request that
// carries no country, such as one that did not come through CloudFront.
//
// Grouped to agree with continentOfTimeZone wherever the two can disagree:
// Central America and the Caribbean are North America, Russia and Turkey are
// Europe. One difference cannot be helped: Hawaii is "US", so a guest in
// Honolulu is North America here and Oceania by time zone.
const BY_CONTINENT: Record<Exclude<Continent, "Unknown">, string> = {
  "North America":
    "US CA MX GT BZ SV HN NI CR PA CU JM HT DO PR BS BB TT AG DM GD KN LC VC " +
    "AI AW BQ CW SX MF BL VG VI KY TC MS GP MQ PM GL BM",
  "South America": "AR BO BR CL CO EC FK GF GY PY PE SR UY VE GS",
  Europe:
    "AD AL AT AX BA BE BG BY CH CY CZ DE DK EE ES FI FO FR GB GG GI GR HR HU " +
    "IE IM IS IT JE LI LT LU LV MC MD ME MK MT NL NO PL PT RO RS RU SE SI SJ " +
    "SK SM TR UA VA XK",
  Asia:
    "AE AF AM AZ BD BH BN BT CC CN CX GE HK ID IL IN IO IQ IR JO JP KG KH KP " +
    "KR KW KZ LA LB LK MM MN MO MV MY NP OM PH PK PS QA SA SG SY TH TJ TL TM " +
    "TW UZ VN YE",
  Africa:
    "AO BF BI BJ BW CD CF CG CI CM CV DJ DZ EG EH ER ET GA GH GM GN GQ GW KE " +
    "KM LR LS LY MA MG ML MR MU MW MZ NA NE NG RE RW SC SD SH SL SN SO SS ST " +
    "SZ TD TG TN TZ UG YT ZA ZM ZW",
  Oceania: "AS AU CK FJ FM GU KI MH MP NC NF NR NU NZ PF PG PN PW SB TK TO TV UM VU WF WS",
  Antarctica: "AQ BV HM TF",
};

const CONTINENT_OF = new Map<string, Continent>();
for (const [continent, codes] of Object.entries(BY_CONTINENT)) {
  for (const code of codes.split(" ")) CONTINENT_OF.set(code, continent as Continent);
}

// The header as CloudFront sends it, held to two letters so the field cannot
// carry arbitrary text into the database. "" when absent or malformed.
export const countryCode = (header: unknown): string => {
  if (typeof header !== "string") return "";
  const code = header.trim().toUpperCase();
  return /^[A-Z]{2}$/.test(code) ? code : "";
};

export const continentOfCountry = (code: unknown): Continent =>
  CONTINENT_OF.get(countryCode(code)) ?? "Unknown";
