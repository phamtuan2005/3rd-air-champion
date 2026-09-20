import { guestResolvers } from "../resolvers/guest";
import Guest from "../../model/guestSchema";
import { createMockHost } from "../../model/test/util/mockHost";

// A guest's standing discount — dollars off each night for the nurses who stay
// for years.
//
// The rule these protect is the one that is easy to get wrong and impossible to
// see: 0 is how a discount is ENDED. Every other field on updateGuest is copied
// with a truthiness check, and under that a 0 is indistinguishable from "not
// sent" — so ending a discount would silently keep paying it, on a booking
// screen that showed the right number.

const updateGuest = (args: any) => (guestResolvers.Mutation.updateGuest as any)(null, args);

const makeGuest = async (email: string) => {
  const host: any = await createMockHost(email);
  return await new Guest({
    name: "Mai",
    phone: "408-555-1234",
    host: host._id,
    numberOfGuests: 1,
  }).save();
};

describe("a guest's loyalty discount", () => {
  it("is nothing until the house sets one", async () => {
    const guest: any = await makeGuest("loyalty-default@example.com");
    expect(guest.loyaltyDiscountPerNight).toBe(0);
  });

  it("is stored as dollars off each night", async () => {
    const guest: any = await makeGuest("loyalty-set@example.com");
    const updated: any = await updateGuest({
      _id: String(guest._id),
      loyaltyDiscountPerNight: 5,
    });
    expect(updated.loyaltyDiscountPerNight).toBe(5);
  });

  // THE test. If this fails, ending a discount silently does nothing.
  it("is ended by setting it to 0", async () => {
    const guest: any = await makeGuest("loyalty-clear@example.com");
    await updateGuest({ _id: String(guest._id), loyaltyDiscountPerNight: 7.5 });

    const cleared: any = await updateGuest({
      _id: String(guest._id),
      loyaltyDiscountPerNight: 0,
    });
    expect(cleared.loyaltyDiscountPerNight).toBe(0);
  });

  // An update about something else must not disturb it.
  it("survives an edit that says nothing about it", async () => {
    const guest: any = await makeGuest("loyalty-untouched@example.com");
    await updateGuest({ _id: String(guest._id), loyaltyDiscountPerNight: 5 });

    const renamed: any = await updateGuest({ _id: String(guest._id), name: "Mai Nguyen" });
    expect(renamed.name).toBe("Mai Nguyen");
    expect(renamed.loyaltyDiscountPerNight).toBe(5);
  });

  it("refuses a negative discount rather than charging the guest", async () => {
    const guest: any = await makeGuest("loyalty-negative@example.com");
    await expect(
      updateGuest({ _id: String(guest._id), loyaltyDiscountPerNight: -5 }),
    ).rejects.toThrow();
  });
});
