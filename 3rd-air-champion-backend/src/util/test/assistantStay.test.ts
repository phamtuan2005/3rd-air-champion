import { dayWords, findRoomByName, isDayKey, phoneLooksReal, readBack, readStay } from "../assistantStay";

// The rules an AI assistant's booking request goes through
// (route/assistantRoute). The assistant knows nothing about the house, so
// these pin that it cannot send a vague stay, and that what the guest reads
// back names every night — including the 1am-arrival rule that has already
// cost the house a room.

describe("reading the stay an assistant asks for", () => {
  const TODAY = "2026-11-24";

  it("takes the check-out morning as the end, not a night", () => {
    const stay = readStay("2026-12-01", "2026-12-04", TODAY);
    expect(stay).toEqual({ ok: true, nights: ["2026-12-01", "2026-12-02", "2026-12-03"] });
  });

  it("crosses a month and a year by UTC day, whatever the server's clock", () => {
    const stay = readStay("2026-12-31", "2027-01-02", TODAY);
    expect(stay).toEqual({ ok: true, nights: ["2026-12-31", "2027-01-01"] });
  });

  it("refuses anything but real yyyy-MM-dd days, and says what to send", () => {
    for (const bad of ["Dec 1", "2026-12-1", "2026-02-30", "", null, 20261201]) {
      const stay = readStay(bad, "2026-12-04", TODAY);
      expect(stay.ok).toBe(false);
      if (!stay.ok) expect(stay.error).toContain("yyyy-MM-dd");
    }
    expect(isDayKey("2028-02-29")).toBe(true);
  });

  it("refuses a check-out on or before the check-in", () => {
    expect(readStay("2026-12-04", "2026-12-04", TODAY).ok).toBe(false);
    expect(readStay("2026-12-04", "2026-12-01", TODAY).ok).toBe(false);
  });

  it("refuses the past but takes tonight", () => {
    expect(readStay("2026-11-23", "2026-11-25", TODAY).ok).toBe(false);
    expect(readStay(TODAY, "2026-11-25", TODAY)).toEqual({ ok: true, nights: [TODAY] });
  });

  it("caps the length and the reach, telling the assistant what to do instead", () => {
    const long = readStay("2026-12-01", "2027-03-01", TODAY);
    expect(long.ok).toBe(false);
    if (!long.ok) expect(long.error).toContain("notes");
    expect(readStay("2028-01-01", "2028-01-03", TODAY).ok).toBe(false);
  });
});

describe("finding a room and a phone", () => {
  it("matches the name TiBook shows, ignoring case and spaces", () => {
    const rooms = [{ name: "King" }, { name: "Cozy" }];
    expect(findRoomByName(rooms, "  king ")).toEqual({ name: "King" });
    expect(findRoomByName(rooms, "Kin")).toBeUndefined();
    expect(findRoomByName(rooms, 7)).toBeUndefined();
  });

  it("wants 7 to 15 digits, as TT does", () => {
    expect(phoneLooksReal("(408) 555-0123")).toBe(true);
    expect(phoneLooksReal("+49 30 1234567")).toBe(true);
    expect(phoneLooksReal("555")).toBe(false);
  });
});

describe("the read-back the guest sees", () => {
  const base = {
    roomName: "King",
    nights: ["2026-12-01", "2026-12-02"],
    checkOut: "2026-12-03",
    guests: 2,
    guestName: "Mai Tran",
    guestPhone: "408 555 0123",
    hostFirstName: "Anh-Tuan",
    priceRange: "$75–$85",
    cancellation: "Free cancellation up to 7 days before check-in",
  };

  it("names the nights in words, with the check-out day", () => {
    const lines = readBack(base);
    expect(lines[0]).toBe("King · 2 nights · check-in Tue, Dec 1, check-out Thu, Dec 3");
    expect(lines[1]).toBe("The guest sleeps there the nights of Tue, Dec 1 through Wed, Dec 2.");
  });

  it("spells out that a 1am arrival belongs to the night before", () => {
    expect(readBack(base)[2]).toBe(
      "Arriving after midnight still counts as the night before: a guest arriving at 1am on Wed, Dec 2 needs check-in Tue, Dec 1.",
    );
  });

  it("gives the public range, never a figure of its own, and says nothing is booked yet", () => {
    const lines = readBack(base);
    expect(lines).toContain("The price is flexible within $75–$85 a night; Anh-Tuan will text the guest one that works for both.");
    expect(lines[lines.length - 1]).toBe("Nothing is booked until Anh-Tuan confirms — the guest will hear back by text.");
    expect(readBack({ ...base, priceRange: null })).toContain("Anh-Tuan will text the guest the price for these nights.");
  });

  it("leaves the cancellation line out when the host has not set one", () => {
    expect(readBack({ ...base, cancellation: "" }).join(" ")).not.toContain("cancellation");
  });

  it("reads a day by its UTC date", () => {
    expect(dayWords("2026-12-01")).toBe("Tue, Dec 1");
  });
});
