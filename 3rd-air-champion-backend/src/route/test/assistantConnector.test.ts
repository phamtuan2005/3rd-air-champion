import express from "express";
import request from "supertest";
import mongoose from "mongoose";
import assistantRoute, { resetAssistantState } from "../assistantRoute";
import Host from "../../model/hostSchema";
import Room from "../../model/roomSchema";
import Day from "../../model/daySchema";
import Guest from "../../model/guestSchema";
import BookingRequest from "../../model/bookingRequestSchema";
import TTReviews from "../../model/ttReviewsSchema";
import { createMockHost } from "../../model/test/util/mockHost";
import { addNights, houseToday } from "../../util/houseNights";
import { createBookingRequest } from "../../util/createBookingRequest";

// The TiBook connector AI assistants book through (route/assistantRoute).
// What these pin, in order of what it would cost to get wrong:
//   - it never books: it sends a REQUEST, and only with a confirmation that
//     came with the read-back the guest was shown;
//   - it never says anything TiBook would not show a stranger — not the door
//     code, not who is staying, not a guest's own (or family $0) rate;
//   - it agrees with the calendar: held requests and per-room blocks are taken.
// If one fails, work out which promise moved before changing the test.

const app = express();
app.use(express.json());
app.use("/assistant", assistantRoute);

let rpcId = 0;
const call = async (name: string, args: Record<string, unknown> = {}) => {
  const res = await request(app)
    .post("/assistant/mcp")
    .set("Accept", "application/json, text/event-stream")
    .send({ jsonrpc: "2.0", id: ++rpcId, method: "tools/call", params: { name, arguments: args } });
  expect(res.status).toBe(200);
  const result = res.body.result;
  const body = result.content[0].text as string;
  let data: any = body;
  try {
    data = JSON.parse(body);
  } catch {
    // A refusal is plain words.
  }
  return { isError: result.isError === true, text: body, data };
};

// King's real AirBnB listing, so the room facts (3 guests, 1 queen + sofa bed)
// come from roomFactsData exactly as TiBook shows them.
const KING_LISTING = "https://www.airbnb.com/rooms/1586635483950294231";

const today = houseToday();
const night = (n: number) => addNights(today, n);
const at = (key: string) => new Date(`${key}T00:00:00Z`);

const setup = async () => {
  const host = await createMockHost(`assist-${new mongoose.Types.ObjectId()}@example.com`);
  const calendar = new mongoose.Types.ObjectId();
  await Host.updateOne(
    { _id: host._id },
    {
      calendar,
      name: "Anh-Tuan Pham",
      doorCode: "9999#",
      airbnbAddress: "1 Secret Lane",
      houseRules: "No smoking. Quiet after 10pm.",
      cancellationFullRefundDays: 7,
      cancellationHalfRefundDays: 3,
    },
  );
  const king = await Room.create({
    host: host._id,
    name: "King",
    price: 75,
    roomCode: "1224#",
    airbnbUrl: KING_LISTING,
    checkInInstructions: "Lockbox behind the gate",
  });
  // Chill's real listing too: it fits 2, so a party of 3 leaves it out.
  const chill = await Room.create({
    host: host._id,
    name: "Chill",
    price: 60,
    roomCode: "0205#",
    airbnbUrl: "https://www.airbnb.com/rooms/1400962263132112124",
  });
  await Room.create({ host: host._id, name: "Retired", price: 50, active: false });
  process.env.TIBOOK_HOST_ID = String(host._id);
  return { host, calendar, king, chill };
};

beforeEach(() => resetAssistantState());
afterAll(() => {
  delete process.env.TIBOOK_HOST_ID;
});

describe("an assistant connecting", () => {
  const rpc = (method: string, params: Record<string, unknown> = {}) =>
    request(app)
      .post("/assistant/mcp")
      .set("Accept", "application/json, text/event-stream")
      .send({ jsonrpc: "2.0", id: ++rpcId, method, params });

  it("is greeted with the house's instructions and finds the five tools", async () => {
    const init = await rpc("initialize", {
      protocolVersion: "2025-06-18",
      capabilities: {},
      clientInfo: { name: "test-assistant", version: "1" },
    });
    expect(init.status).toBe(200);
    expect(init.body.result.serverInfo.name).toBe("tibook");
    expect(init.body.result.instructions).toContain("A sent request is not a booking");
    expect(init.body.result.instructions).toContain("1am on Tuesday is booked from Monday night");

    const list = await rpc("tools/list");
    const tools = list.body.result.tools;
    expect(tools.map((t: any) => t.name).sort()).toEqual([
      "check_availability",
      "house_info",
      "list_rooms",
      "prepare_booking_request",
      "send_booking_request",
    ]);
    const send = tools.find((t: any) => t.name === "send_booking_request");
    expect(send.inputSchema.required).toEqual(["confirmation_id"]);
  });

  it("has no stream or session to open", async () => {
    expect((await request(app).get("/assistant/mcp")).status).toBe(405);
  });
});

describe("what an assistant can read", () => {
  it("lists the active rooms with TiBook's facts and price range, and no door code or check-in secret", async () => {
    await setup();
    const { data, text } = await call("list_rooms");
    expect(data.rooms.map((r: any) => r.name).sort()).toEqual(["Chill", "King"]);
    const king = data.rooms.find((r: any) => r.name === "King");
    expect(king.max_guests).toBe(3);
    expect(king.beds).toEqual(["1 queen bed", "1 sofa bed"]);
    expect(king.price_per_night_usd).toContain("$75–$85");
    expect(king.photos.length).toBeGreaterThan(0);
    expect(text).not.toMatch(/1224#|0205#|9999#|Lockbox|Secret Lane/);
  });

  it("gives house info without the address, door code or a draft review", async () => {
    const s = await setup();
    await TTReviews.create({
      host: s.host._id,
      published: { house: "Spotless and quiet.", rooms: [{ room: s.king._id, summary: "Big bed, great TV." }] },
      draft: { house: "DRAFT not for guests", rooms: [] },
    } as any);
    const { data, text } = await call("house_info");
    expect(data.house_rules).toBe("No smoking. Quiet after 10pm.");
    expect(data.cancellation).toContain("Full refund if you cancel 7+ days before check-in");
    expect(data.promise_to_guests).toBe("Your comfort. Our mission.");
    expect(data.what_guests_say.rooms).toEqual([{ room: "King", summary: "Big bed, great TV." }]);
    expect(data.host).toMatch(/^Anh-Tuan,/);
    expect(text).not.toMatch(/Secret Lane|9999#|DRAFT/);
  });

  it("hides a code or number the host typed into the house rules or a review summary, as TT does", async () => {
    const s = await setup();
    await Host.updateOne(
      { _id: s.host._id },
      { houseRules: "Quiet after 10pm. Back gate 0205# after 10pm. Questions? Call 408-555-0199 or anh@example.com" },
    );
    await TTReviews.create({
      host: s.host._id,
      published: { house: "Host answered fast at 408 555 0111.", rooms: [] },
    } as any);
    const { data, text } = await call("house_info");
    expect(data.house_rules).toContain("Quiet after 10pm.");
    expect(data.house_rules).toContain("(hidden)");
    expect(text).not.toMatch(/0205#|555-0199|555 0111|anh@example\.com/);
  });

  it("says a night is taken without saying who has it, and counts holds and per-room blocks as taken", async () => {
    const s = await setup();
    const stranger = await Guest.create({ host: s.host._id, name: "Private Person", phone: "4085550000" });
    // Night 3: King booked. Night 4: King blocked for that room only. Night 5: Chill held (reserved).
    await Day.create({ calendar: s.calendar, date: at(night(3)), bookings: [{ room: s.king._id, guest: stranger._id }] });
    await Day.create({ calendar: s.calendar, date: at(night(4)), blockedRooms: [s.king._id] });
    await BookingRequest.create({
      host: s.host._id,
      guestName: "Held Guest",
      guestPhone: "4085551111",
      date: at(night(5)),
      room: s.chill._id,
      duration: 1,
      numberOfGuests: 1,
      status: "reserved",
    });

    const { data, text } = await call("check_availability", { check_in: night(3), check_out: night(6) });
    expect(data.nights).toBe(3);
    expect(data.free_for_the_whole_stay).toEqual([]);
    expect(data.free_for_some_nights).toEqual(
      expect.arrayContaining([
        { room: "King", free_nights: [night(5)] },
        { room: "Chill", free_nights: [night(3), night(4)] },
      ]),
    );
    expect(data.if_nothing_fits).toContain("wish list");
    expect(text).not.toMatch(/Private Person|Held Guest|4085550000|4085551111/);

    const open = await call("check_availability", { check_in: night(10), check_out: night(12), guests: 3 });
    expect(open.data.free_for_the_whole_stay.map((r: any) => r.room)).toEqual(["King"]);
  });

  it("refuses a vague stay in words the assistant can act on", async () => {
    await setup();
    const res = await call("check_availability", { check_in: "next friday", check_out: night(3) });
    expect(res.isError).toBe(true);
    expect(res.text).toContain("yyyy-MM-dd");
  });

  it("says plainly that it is not set up when the house id is missing", async () => {
    await setup();
    delete process.env.TIBOOK_HOST_ID;
    const res = await call("list_rooms");
    expect(res.isError).toBe(true);
    expect(res.text).toContain("not set up");
  });
});

describe("sending a request", () => {
  const stay = (over: Record<string, unknown> = {}) => ({
    room: "king",
    check_in: night(10),
    check_out: night(12),
    guests: 2,
    guest_name: "Mai Tran",
    guest_phone: "(408) 555-0123",
    notes: "Arriving around 1am",
    ...over,
  });

  it("prepares a read-back first and writes nothing until it is confirmed", async () => {
    const s = await setup();
    const prep = await call("prepare_booking_request", stay());
    expect(prep.isError).toBe(false);
    expect(prep.data.read_back[0]).toContain("King · 2 nights");
    expect(prep.data.read_back.join("\n")).toContain("Arriving after midnight still counts as the night before");
    expect(prep.data.read_back.join("\n")).toContain("$75–$85");
    expect(await BookingRequest.countDocuments({ host: s.host._id })).toBe(0);

    const sent = await call("send_booking_request", { confirmation_id: prep.data.confirmation_id });
    expect(sent.data.sent).toBe(true);
    const saved: any = await BookingRequest.findOne({ host: s.host._id }).lean();
    expect(saved).toMatchObject({
      guestName: "Mai Tran",
      duration: 2,
      numberOfGuests: 2,
      status: "pending",
      source: "assistant",
    });
    expect(String(saved.room)).toBe(String(s.king._id));
    expect(saved.date.toISOString().slice(0, 10)).toBe(night(10));
    expect(saved.notes).toContain("AI assistant");
    expect(saved.notes).toContain("Arriving around 1am");

    // A confirmation is good once.
    const again = await call("send_booking_request", { confirmation_id: prep.data.confirmation_id });
    expect(again.isError).toBe(true);
    expect(await BookingRequest.countDocuments({ host: s.host._id })).toBe(1);
  });

  it("will not send without a confirmation that prepare handed out", async () => {
    const s = await setup();
    const res = await call("send_booking_request", { confirmation_id: "made-up" });
    expect(res.isError).toBe(true);
    expect(res.text).toContain("prepare_booking_request");
    expect(await BookingRequest.countDocuments({ host: s.host._id })).toBe(0);
  });

  it("gives every guest the public range — never a rate on file for their phone, family $0 included", async () => {
    const s = await setup();
    await Guest.create({ host: s.host._id, name: "Family", phone: "4085550123", pricing: [{ room: s.king._id, price: 0 }] });
    const prep = await call("prepare_booking_request", stay());
    const said = prep.data.read_back.join("\n");
    expect(said).toContain("$75–$85");
    expect(said).not.toMatch(/\$0\b|no charge|family/i);
  });

  it("refuses a party too big for the room and a room that is taken", async () => {
    const s = await setup();
    expect((await call("prepare_booking_request", stay({ guests: 4 }))).text).toContain("fits 3 guests");
    await Day.create({ calendar: s.calendar, date: at(night(11)), blockedRooms: [s.king._id] });
    const taken = await call("prepare_booking_request", stay());
    expect(taken.isError).toBe(true);
    expect(taken.text).toContain(`taken on ${night(11)}`);
  });

  it("checks again at send time, in case the room went while the guest decided", async () => {
    const s = await setup();
    const prep = await call("prepare_booking_request", stay());
    await BookingRequest.create({
      host: s.host._id,
      guestName: "Quicker",
      guestPhone: "4085552222",
      date: at(night(10)),
      room: s.king._id,
      duration: 1,
      numberOfGuests: 1,
      status: "reserved",
    });
    const sent = await call("send_booking_request", { confirmation_id: prep.data.confirmation_id });
    expect(sent.isError).toBe(true);
    expect(sent.text).toContain("while the guest was deciding");
    expect(await BookingRequest.countDocuments({ host: s.host._id, source: "assistant" })).toBe(0);
  });

  it("caps sends per phone number, so one script cannot fill the Requests screen", async () => {
    const s = await setup();
    for (let i = 0; i < 4; i++) {
      const prep = await call("prepare_booking_request", stay({ check_in: night(20 + i * 2), check_out: night(21 + i * 2) }));
      const sent = await call("send_booking_request", { confirmation_id: prep.data.confirmation_id });
      expect(sent.isError).toBe(i >= 3);
      if (i >= 3) expect(sent.text).toContain("book on TiBook");
    }
    expect(await BookingRequest.countDocuments({ host: s.host._id })).toBe(3);
  });

  it("does not count a send the room had gone for against the guest's allowance", async () => {
    const s = await setup();
    // Two refusals: the room went between prepare and send.
    for (let i = 0; i < 2; i++) {
      const prep = await call("prepare_booking_request", stay({ check_in: night(40 + i * 2), check_out: night(41 + i * 2) }));
      await BookingRequest.create({
        host: s.host._id,
        guestName: "Quicker",
        guestPhone: "4085552222",
        date: at(night(40 + i * 2)),
        room: s.king._id,
        duration: 1,
        numberOfGuests: 1,
        status: "reserved",
      });
      expect((await call("send_booking_request", { confirmation_id: prep.data.confirmation_id })).isError).toBe(true);
    }
    // Still three real sends left.
    for (let i = 0; i < 3; i++) {
      const prep = await call("prepare_booking_request", stay({ check_in: night(50 + i * 2), check_out: night(51 + i * 2) }));
      expect((await call("send_booking_request", { confirmation_id: prep.data.confirmation_id })).isError).toBe(false);
    }
  });

  it("is not capped per address: guests of one assistant share its servers' address", async () => {
    const s = await setup();
    // Five different guests through the same assistant (one address here).
    for (let i = 0; i < 5; i++) {
      const prep = await call("prepare_booking_request", stay({ guest_phone: `408 555 01${10 + i}`, check_in: night(60 + i * 2), check_out: night(61 + i * 2) }));
      expect((await call("send_booking_request", { confirmation_id: prep.data.confirmation_id })).isError).toBe(false);
    }
    expect(await BookingRequest.countDocuments({ host: s.host._id, source: "assistant" })).toBe(5);
  });

  it("sends once when an assistant sends the same confirmation twice at once", async () => {
    const s = await setup();
    const prep = await call("prepare_booking_request", stay());
    const both = await Promise.all([
      call("send_booking_request", { confirmation_id: prep.data.confirmation_id }),
      call("send_booking_request", { confirmation_id: prep.data.confirmation_id }),
    ]);
    expect(both.filter((r) => !r.isError)).toHaveLength(1);
    expect(await BookingRequest.countDocuments({ host: s.host._id })).toBe(1);
  });
});

describe("a TiBook request", () => {
  it("is not marked as coming from an assistant", async () => {
    const s = await setup();
    const r: any = await createBookingRequest({
      host: String(s.host._id),
      guestName: "Form Guest",
      guestPhone: "+1 408 555 0199",
      date: night(30),
      room: String(s.king._id),
      duration: 1,
      numberOfGuests: 1,
    });
    expect(r.source).toBe("");
    expect(r.guestPhone).toBe("408 555 0199");
  });
});
