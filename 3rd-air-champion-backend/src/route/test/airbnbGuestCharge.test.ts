import express from "express";
import request from "supertest";
import mongoose from "mongoose";
import chargeRoute from "../chargeRoute";
import Guest from "../../model/guestSchema";
import { createMockHost } from "../../model/test/util/mockHost";

// A charge on an AirBnB guest.
//
// Every AirBnB stay hangs off one placeholder guest record named "AirBnB", so
// a charge on that record alone says only "somebody from AirBnB owes this".
// Anh-Tuan gets a cancellation fee when an AirBnB guest cancels, and until
// 2026-10-03 there was nowhere in TiMag to write it down. The alias is who.

const app = express();
app.use(express.json());
app.use("/charge", chargeRoute);

// A guest can only be saved under a host that exists — and the suite wipes
// the database between tests, so the host is made again for each.
let host: mongoose.Types.ObjectId;
beforeEach(async () => {
  host = (await createMockHost("airbnb-charge@example.com"))._id as mongoose.Types.ObjectId;
});

describe("charging an AirBnB guest", () => {
  it("keeps the AirBnB guest's name on the charge, and lists it back", async () => {
    const airbnb: any = await new Guest({ host, name: "AirBnB", phone: "0000000000" }).save();

    const created = await request(app).post("/charge/create").send({
      host: String(host),
      guest: String(airbnb._id),
      alias: "Vanessa",
      label: "Cancellation",
      amount: 68,
      date: "2026-10-03",
      paid: true,
    });
    expect(created.status).toBe(200);
    expect(created.body.alias).toBe("Vanessa");
    expect(created.body.guest.name).toBe("AirBnB");

    const list = await request(app).get("/charge/list").query({ hostId: String(host) });
    expect(list.status).toBe(200);
    expect(list.body.find((c: any) => c.id === created.body.id)?.alias).toBe("Vanessa");
  });

  it("leaves the alias empty for a house guest", async () => {
    const eddie: any = await new Guest({ host, name: "Eddie", phone: "4085550100" }).save();
    const created = await request(app).post("/charge/create").send({
      host: String(host),
      guest: String(eddie._id),
      label: "Cancellation",
      amount: 55,
      date: "2026-10-03",
    });
    expect(created.status).toBe(200);
    expect(created.body.alias).toBe("");
  });
});
