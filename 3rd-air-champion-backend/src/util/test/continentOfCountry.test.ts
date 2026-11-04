import { continentOfCountry, countryCode } from "../continentOfCountry";
import { CONTINENTS } from "../continentOfTimeZone";

// Where TiBook's visitors are, from the country CloudFront puts their
// connection in. The cases worth pinning are the ones a map of the world
// draws differently from the seven-continent model the time zones use.

describe("continent from a connection's country", () => {
  it("reads the house's usual visitors", () => {
    expect(continentOfCountry("US")).toBe("North America");
    expect(continentOfCountry("VN")).toBe("Asia");
    expect(continentOfCountry("DE")).toBe("Europe");
    expect(continentOfCountry("BR")).toBe("South America");
    expect(continentOfCountry("NG")).toBe("Africa");
    expect(continentOfCountry("AU")).toBe("Oceania");
  });

  // Agrees with continentOfTimeZone, so the map does not jump a bar for the
  // same guest depending on which of the two answered.
  it("groups the edge cases the way the time zones do", () => {
    expect(continentOfCountry("CR")).toBe("North America"); // Central America
    expect(continentOfCountry("PR")).toBe("North America"); // Caribbean
    expect(continentOfCountry("RU")).toBe("Europe");
    expect(continentOfCountry("TR")).toBe("Europe");
    expect(continentOfCountry("EG")).toBe("Africa");
    expect(continentOfCountry("MV")).toBe("Asia");
  });

  it("accepts the code however it is cased or padded", () => {
    expect(continentOfCountry(" vn ")).toBe("Asia");
    expect(countryCode(" vn ")).toBe("VN");
  });

  // Unknown, not a guess -- the route then falls back to the time zone.
  it("says Unknown for anything that is not a known two-letter code", () => {
    expect(continentOfCountry(undefined)).toBe("Unknown");
    expect(continentOfCountry("")).toBe("Unknown");
    expect(continentOfCountry("ZZ")).toBe("Unknown");
    expect(continentOfCountry("USA")).toBe("Unknown");
    expect(countryCode("<b>US</b>")).toBe("");
  });

  it("only ever answers with a continent the stats screen knows", () => {
    const codes = "US VN DE BR NG AU AQ GL FK SJ".split(" ");
    for (const c of codes) expect(CONTINENTS).toContain(continentOfCountry(c));
  });
});
