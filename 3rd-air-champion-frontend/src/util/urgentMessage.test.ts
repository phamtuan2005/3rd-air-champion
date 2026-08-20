import { describe, expect, it } from "vitest";
import { readGuestMessage } from "./urgentMessage";
import { recommendAction, StayContext } from "./urgentAction";

// The stay the incident happened on, in the shape the tool sees it.
const CUTE: StayContext = {
  roomName: "Cute",
  guestName: "Minh",
  startDate: "2026-08-24", // a Monday
  startWeekday: 1,
};

describe("reading the message that caused the incident", () => {
  const MSG = "Tuesday I will checkin at 1-2am";

  it("reads 1-2am as after midnight, never as the afternoon", () => {
    const r = readGuestMessage(MSG);
    expect(r.time?.fromMinutes).toBe(60);
    expect(r.time?.toMinutes).toBe(120);
    expect(r.afterMidnight).toBe(true);
    expect(r.timeInWords).toContain("after midnight");
    expect(r.timeInWords).not.toContain("PM");
  });

  it("keeps the room shut", () => {
    const rec = recommendAction(readGuestMessage(MSG), CUTE);
    expect(rec.verdict).toBe("hold");
    expect(rec.headline).toBe("Do NOT open the Cute");
  });

  it("warns that a small-hours arrival belongs to the night before", () => {
    const r = readGuestMessage(MSG);
    expect(r.notes.join(" ")).toContain("night BEFORE");
  });

  it("says Tuesday against a Monday stay is consistent with arriving after midnight", () => {
    const rec = recommendAction(readGuestMessage(MSG), CUTE);
    expect(rec.cautions.join(" ")).toContain("after midnight on the Monday night");
  });
});

describe("am and pm are never assumed", () => {
  it("refuses a bare 1-2 with no meridiem", () => {
    const r = readGuestMessage("I will check in at 1-2");
    expect(r.time?.ambiguous).toBe(true);
    expect(r.timeInWords).toBeNull();
    expect(r.notes.join(" ")).toContain("does not say AM or PM");
  });

  it("still holds the room when the time cannot be read", () => {
    // Unreadable time, but the guest plainly says they are checking in.
    const rec = recommendAction(readGuestMessage("I will check in at 1-2"), CUTE);
    expect(rec.verdict).toBe("hold");
  });

  it("reads an explicit pm as the afternoon", () => {
    const r = readGuestMessage("arriving 1-2pm");
    expect(r.time?.fromMinutes).toBe(13 * 60);
    expect(r.afterMidnight).toBe(false);
    expect(r.timeInWords).toContain("afternoon");
  });

  it("handles 12am as midnight and 12pm as noon", () => {
    expect(readGuestMessage("in at 12am").time?.fromMinutes).toBe(0);
    expect(readGuestMessage("in at 12pm").time?.fromMinutes).toBe(12 * 60);
  });

  it("reads a 24-hour clock at face value", () => {
    expect(readGuestMessage("arriving 23:30").time?.fromMinutes).toBe(23 * 60 + 30);
    expect(readGuestMessage("arriving 13:00").time?.fromMinutes).toBe(13 * 60);
  });

  it("reads the word midnight without needing digits", () => {
    const r = readGuestMessage("I will get there after midnight");
    expect(r.afterMidnight).toBe(true);
    expect(r.time?.ambiguous).toBe(false);
  });

  it("survives the dash a phone keyboard produces", () => {
    const r = readGuestMessage("checkin 1–2am");
    expect(r.time?.toMinutes).toBe(120);
  });

  it("reads a.m. written with dots", () => {
    expect(readGuestMessage("arriving at 2 a.m.").time?.fromMinutes).toBe(120);
  });
});

describe("coming or not coming", () => {
  it("opens the room when the guest cancels", () => {
    const rec = recommendAction(readGuestMessage("Sorry, I have to cancel"), CUTE);
    expect(rec.verdict).toBe("open");
    expect(rec.headline).toBe("Open the Cute");
  });

  it("opens the room when the guest says they cannot make it", () => {
    const rec = recommendAction(readGuestMessage("I can't come tonight"), CUTE);
    expect(rec.verdict).toBe("open");
  });

  it("warns that opening cannot be undone once the room sells", () => {
    const rec = recommendAction(readGuestMessage("I have to cancel"), CUTE);
    expect(rec.cautions.join(" ")).toContain("cannot be let in");
  });

  it("does NOT open on 'can't make it before 11pm' — that is a late arrival", () => {
    const rec = recommendAction(readGuestMessage("I can't make it before 11pm"), CUTE);
    expect(rec.verdict).not.toBe("open");
  });

  it("asks rather than guesses when the message settles nothing", () => {
    const rec = recommendAction(readGuestMessage("Hi, quick question about parking"), CUTE);
    expect(rec.verdict).toBe("ask");
    expect(rec.headline).toContain("Ask Minh");
  });

  it("asks on an empty paste", () => {
    expect(recommendAction(readGuestMessage("   "), CUTE).verdict).toBe("ask");
  });

  it("holds when the guest says late without a time", () => {
    const rec = recommendAction(readGuestMessage("I'm running late tonight"), CUTE);
    expect(rec.verdict).toBe("hold");
    expect(rec.cautions.join(" ")).toContain("did not say how late");
  });
});

describe("the wrong booking", () => {
  it("flags a weekday that does not match the stay", () => {
    const rec = recommendAction(readGuestMessage("Friday I arrive at 9pm"), CUTE);
    expect(rec.cautions.join(" ")).toContain("check this is the right booking");
  });

  it('warns that "tomorrow" counts from when the message was sent', () => {
    const r = readGuestMessage("arriving tomorrow at 10pm");
    expect(r.notes.join(" ")).toContain("message was SENT");
  });
});

// A Tuesday-night stay, for messages that name Tuesday explicitly.
const CUTE_TUE: StayContext = {
  roomName: "Cute",
  guestName: "Minh",
  startDate: "2026-08-25",
  startWeekday: 2,
};

describe("an explicit refusal", () => {
  it('opens the room on "I will not come on Tuesday"', () => {
    const rec = recommendAction(readGuestMessage("I will not come on Tuesday"), CUTE_TUE);
    expect(rec.verdict).toBe("open");
    expect(rec.headline).toBe("Open the Cute");
    expect(rec.because).toContain("not coming");
  });

  it("still warns that opening cannot be undone", () => {
    const rec = recommendAction(readGuestMessage("I will not come on Tuesday"), CUTE_TUE);
    expect(rec.cautions.join(" ")).toContain("cannot be let in");
  });

  it("flags the day when the refusal names a day the stay does not start on", () => {
    // Said of a Monday stay, "not coming Tuesday" may be the wrong booking — or
    // a guest dropping one night of several.
    const rec = recommendAction(readGuestMessage("I will not come on Tuesday"), CUTE);
    expect(rec.cautions.join(" ")).toContain("check this is the right booking");
  });

  it('handles "I won\'t be coming" and "not going to make it"', () => {
    expect(recommendAction(readGuestMessage("I won't be coming"), CUTE_TUE).verdict).toBe("open");
    expect(
      recommendAction(readGuestMessage("I'm not going to make it"), CUTE_TUE).verdict,
    ).toBe("open");
  });

  it("is not confused by the arrival verb inside the refusal", () => {
    // "won't be ARRIVING" and "won't be CHECKING IN" both contain the words for
    // turning up. Read naively they look like a guest who says both things.
    for (const msg of [
      "I won't be arriving",
      "I won't be checking in",
      "I will not be staying tonight",
    ]) {
      expect(recommendAction(readGuestMessage(msg), CUTE_TUE).verdict).toBe("open");
    }
  });

  it("still asks when a message genuinely says both things", () => {
    // Cancels one thing and announces another: not this tool's call to make.
    const rec = recommendAction(
      readGuestMessage("I can't come at 8, but I'm running late and will see you"),
      CUTE_TUE,
    );
    expect(rec.verdict).toBe("ask");
  });
});
