import { continentOfTimeZone } from "../continentOfTimeZone";

// Where TiBook's visitors are, from the zone their phone reports. The cases
// worth pinning are the ones a prefix alone gets wrong.

describe("continent from a device time zone", () => {
  it("reads the plain prefixes", () => {
    expect(continentOfTimeZone("America/Los_Angeles")).toBe("North America");
    expect(continentOfTimeZone("Europe/Berlin")).toBe("Europe");
    expect(continentOfTimeZone("Asia/Ho_Chi_Minh")).toBe("Asia");
    expect(continentOfTimeZone("Africa/Lagos")).toBe("Africa");
    expect(continentOfTimeZone("Australia/Sydney")).toBe("Oceania");
  });

  // America/ spans two continents. Lumping them would put a guest in São Paulo
  // on the same bar as one in San José.
  it("splits America/ into North and South", () => {
    expect(continentOfTimeZone("America/Sao_Paulo")).toBe("South America");
    expect(continentOfTimeZone("America/Argentina/Buenos_Aires")).toBe("South America");
    expect(continentOfTimeZone("America/Bogota")).toBe("South America");
    expect(continentOfTimeZone("America/Mexico_City")).toBe("North America");
    expect(continentOfTimeZone("America/Costa_Rica")).toBe("North America");
    expect(continentOfTimeZone("America/Puerto_Rico")).toBe("North America");
  });

  it("places ocean islands on the continent they belong to", () => {
    expect(continentOfTimeZone("Atlantic/Reykjavik")).toBe("Europe");
    expect(continentOfTimeZone("Atlantic/Canary")).toBe("Europe");
    expect(continentOfTimeZone("Atlantic/Bermuda")).toBe("North America");
    expect(continentOfTimeZone("Indian/Maldives")).toBe("Asia");
    expect(continentOfTimeZone("Indian/Mauritius")).toBe("Africa");
    expect(continentOfTimeZone("Pacific/Galapagos")).toBe("South America");
    expect(continentOfTimeZone("Pacific/Auckland")).toBe("Oceania");
  });

  it("understands the old link names some browsers still report", () => {
    expect(continentOfTimeZone("US/Pacific")).toBe("North America");
    expect(continentOfTimeZone("Brazil/East")).toBe("South America");
    expect(continentOfTimeZone("Japan")).toBe("Asia");
  });

  // A zone with no place in it is not a guess at one. Unknown is shown as
  // Unknown, never folded into the house's own continent.
  it("says Unknown rather than guessing", () => {
    expect(continentOfTimeZone("UTC")).toBe("Unknown");
    expect(continentOfTimeZone("Etc/GMT+8")).toBe("Unknown");
    expect(continentOfTimeZone("")).toBe("Unknown");
    expect(continentOfTimeZone(undefined)).toBe("Unknown");
    expect(continentOfTimeZone("Atlantic/Nowhere")).toBe("Unknown");
  });
});
