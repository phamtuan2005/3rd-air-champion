import bcrypt from "bcrypt";
import { createMockHost } from "./util/mockHost";
import Host from "../hostSchema";
import Cohost from "../cohostSchema";
import Room from "../roomSchema";
import { updateShapes } from "../../util/updateShapes";

// The bug that was found three times.
//
// A pre-update hook is handed whatever the caller passed, and `timestamps: true`
// rewrites a plain update into "fields at the top level PLUS a $set holding only
// updatedAt". Every hook that looked at one shape was wrong for somebody:
// hostSchema and roomSchema read `$set ?? update` and found the timestamp;
// cohostSchema read only the top level and missed `{ $set: {...} }` callers.
//
// The host case stored a PASSWORD IN PLAINTEXT and nothing failed. These tests
// exist so that cannot happen quietly again — in any of the three, in either
// calling style.

describe("updateShapes", () => {
  it("returns both the top level and $set when both are present", () => {
    const update = { password: "x", $set: { updatedAt: new Date() } };
    expect(updateShapes(update)).toHaveLength(2);
  });

  it("returns the top level alone when there is no $set", () => {
    expect(updateShapes({ password: "x" })).toHaveLength(1);
  });

  it("ignores things that are not update objects", () => {
    expect(updateShapes(null)).toEqual([]);
    expect(updateShapes(undefined)).toEqual([]);
    expect(updateShapes([{ password: "x" }])).toEqual([]);
  });
});

describe("a password is never written in plaintext", () => {
  const PLAINTEXT = "not-the-stored-value";

  it("hashes a host password passed at the top level", async () => {
    // The exact call that used to store it raw.
    const host = await createMockHost("shape.host.top@example.com");
    await Host.findByIdAndUpdate(host._id, { password: PLAINTEXT });

    const saved: any = await Host.findById(host._id);
    expect(saved.password).not.toBe(PLAINTEXT);
    expect(await bcrypt.compare(PLAINTEXT, saved.password)).toBe(true);
  });

  it("hashes a host password passed inside $set", async () => {
    const host = await createMockHost("shape.host.set@example.com");
    await Host.findByIdAndUpdate(host._id, { $set: { password: PLAINTEXT } });

    const saved: any = await Host.findById(host._id);
    expect(saved.password).not.toBe(PLAINTEXT);
    expect(await bcrypt.compare(PLAINTEXT, saved.password)).toBe(true);
  });

  it("hashes a cohost password passed inside $set", async () => {
    // cohostSchema read only the top level, so this one went in raw.
    const host = await createMockHost("shape.cohost@example.com");
    const cohost: any = await Cohost.create({
      email: "shape.cohost.member@example.com",
      password: "original",
      name: "Shape Member",
      host: host._id,
    });

    await Cohost.findByIdAndUpdate(cohost._id, { $set: { password: PLAINTEXT } });

    const saved: any = await Cohost.findById(cohost._id);
    expect(saved.password).not.toBe(PLAINTEXT);
    expect(await bcrypt.compare(PLAINTEXT, saved.password)).toBe(true);
  });

  it("hashes a cohost password passed at the top level", async () => {
    const host = await createMockHost("shape.cohost2@example.com");
    const cohost: any = await Cohost.create({
      email: "shape.cohost2.member@example.com",
      password: "original",
      name: "Shape Member Two",
      host: host._id,
    });

    await Cohost.findByIdAndUpdate(cohost._id, { password: PLAINTEXT });

    const saved: any = await Cohost.findById(cohost._id);
    expect(saved.password).not.toBe(PLAINTEXT);
    expect(await bcrypt.compare(PLAINTEXT, saved.password)).toBe(true);
  });
});

describe("validation still runs whichever way the fields arrive", () => {
  it("rejects a negative room price passed at the top level", async () => {
    // roomSchema read `$set ?? update`, found the timestamp-only $set, and let
    // this through — a room priced below zero.
    const host = await createMockHost("shape.room.top@example.com");
    const room: any = await Room.create({ host: host._id, name: "Shape", price: 75 });

    await expect(Room.findByIdAndUpdate(room._id, { price: -10 })).rejects.toThrow(
      "Price must be a positive number",
    );
  });

  it("rejects a negative room price passed inside $set", async () => {
    const host = await createMockHost("shape.room.set@example.com");
    const room: any = await Room.create({ host: host._id, name: "Shape Two", price: 75 });

    await expect(
      Room.findByIdAndUpdate(room._id, { $set: { price: -10 } }),
    ).rejects.toThrow("Price must be a positive number");
  });

  it("rejects a host name with special characters, either way", async () => {
    const host = await createMockHost("shape.name@example.com");

    await expect(Host.findByIdAndUpdate(host._id, { name: "Bad<Name>" })).rejects.toThrow(
      "Name cannot contain special characters",
    );
    await expect(
      Host.findByIdAndUpdate(host._id, { $set: { name: "Bad<Name>" } }),
    ).rejects.toThrow("Name cannot contain special characters");
  });

  it("still lets a good update through", async () => {
    const host = await createMockHost("shape.ok@example.com");
    const room: any = await Room.create({ host: host._id, name: "Fine", price: 75 });

    await Room.findByIdAndUpdate(room._id, { price: 90 });
    const saved: any = await Room.findById(room._id);
    expect(saved.price).toBe(90);
  });
});
