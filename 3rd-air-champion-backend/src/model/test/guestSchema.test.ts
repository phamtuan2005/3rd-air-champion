import Guest from "../guestSchema";
import { generateGuest } from "./util/guestFaker";
import parsePhoneNUmber from "libphonenumber-js";
import { createMockHost } from "./util/mockHost";
import Host from "../hostSchema";
import Day from "../daySchema";
import mongoose from "mongoose";

describe("Guest Schema - Valid", () => {
  it("should create and save a guest successfully - John Doe", async () => {
    const host = await createMockHost("anhtp5@uci.edu");

    const johnDoe = {
      name: "John Doe",
      email: "john.doe@example.com",
      phone: "4086096660",
      numberOfGuests: 2,
      returning: true,
      notes: "VIP guest",
      host: host._id,
    };
    const guest = new Guest(johnDoe);
    const savedGuest = await guest.save();

    expect(savedGuest._id).toBeDefined();
    expect(savedGuest.name).toBe(johnDoe.name);
    expect(savedGuest.email).toBe(johnDoe.email);
    expect(savedGuest.phone).toBe("(408) 609-6660");
    expect(savedGuest.numberOfGuests).toBe(johnDoe.numberOfGuests);
    expect(savedGuest.returning).toBe(johnDoe.returning);
    expect(savedGuest.notes).toBe(johnDoe.notes);
    expect(savedGuest.host.toString()).toBe(host._id.toString());

    const updatedHost = await Host.findById(host._id).populate("guests");
    expect(updatedHost?.guests.length).toBe(1);
    expect(updatedHost?.guests[0]._id.toString()).toBe(
      savedGuest._id.toString()
    );
  });

  it("should create and save a guest successfully - John.Doe", async () => {
    const host = await createMockHost("anhtp5@uci.edu");

    const johnDoe = {
      name: "John.Doe",
      email: "john.doe@example.com",
      phone: "4086096660",
      numberOfGuests: 2,
      returning: true,
      notes: "VIP guest",
      host: host._id,
    };
    const guest = new Guest(johnDoe);
    const savedGuest = await guest.save();

    expect(savedGuest._id).toBeDefined();
    expect(savedGuest.name).toBe(johnDoe.name);
    expect(savedGuest.email).toBe(johnDoe.email);
    expect(savedGuest.phone).toBe("(408) 609-6660");
    expect(savedGuest.numberOfGuests).toBe(johnDoe.numberOfGuests);
    expect(savedGuest.returning).toBe(johnDoe.returning);
    expect(savedGuest.notes).toBe(johnDoe.notes);
    expect(savedGuest.host.toString()).toBe(host._id.toString());
  });

  it("should create and save a guest successfully - John Doè", async () => {
    const host = await createMockHost("anhtp5@uci.edu");

    const johnDoe = {
      name: "John Doè",
      email: "john.doe@example.com",
      phone: "4086096660",
      numberOfGuests: 2,
      returning: true,
      notes: "VIP guest",
      host: host._id,
    };
    const guest = new Guest(johnDoe);
    const savedGuest = await guest.save();

    expect(savedGuest._id).toBeDefined();
    expect(savedGuest.name).toBe(johnDoe.name);
    expect(savedGuest.email).toBe(johnDoe.email);
    expect(savedGuest.phone).toBe("(408) 609-6660");
    expect(savedGuest.numberOfGuests).toBe(johnDoe.numberOfGuests);
    expect(savedGuest.returning).toBe(johnDoe.returning);
    expect(savedGuest.notes).toBe(johnDoe.notes);
    expect(savedGuest.host.toString()).toBe(host._id.toString());
  });

  test.each([
    { name: "O'Connor" },
    { name: "Anne-Marie" },
    { name: "Jean-Luc" },
  ])("should save a guest with a valid name: %p", async ({ name }) => {
    const host = await createMockHost("anhtp5@uci.edu");

    const guestData = {
      name,
      email: "valid.email@example.com",
      phone: "4086096660",
      numberOfGuests: 1,
      returning: true,
      host: host._id,
    };

    const guest = new Guest(guestData);
    const savedGuest = await guest.save();

    expect(savedGuest.name).toBe(name);
  });

  it("should create and save a guest successfully - John Doe (no number of guests)", async () => {
    const host = await createMockHost("anhtp5@uci.edu");

    const johnDoe = {
      name: "John Doe",
      email: "john.doe@example.com",
      phone: "4086096660",
      returning: true,
      notes: "VIP guest",
      host: host._id,
    };
    const guest = new Guest(johnDoe);
    const savedGuest = await guest.save();

    expect(savedGuest.numberOfGuests).toBe(1);
  });

  test.each([{ notes: "" }, { notes: null }, {}])(
    "should create and save a guest successfully: %p",
    async ({ notes }) => {
      const host = await createMockHost("anhtp5@uci.edu");
      const johnDoe = {
        name: "John Doe",
        email: "john.doe@example.com",
        phone: "4086096660",
        numberOfGuests: 2,
        returning: true,
        notes,
        host: host._id,
      };
      const guest = new Guest(johnDoe);
      const savedGuest = await guest.save();

      expect(savedGuest.notes).toBe("");
    }
  );

  it("should set returning to false when not provided", async () => {
    const host = await createMockHost("anhtp5@uci.edu");

    const guestData = {
      name: "Jane Doe",
      email: "jane.doe@example.com",
      phone: "4086096660",
      numberOfGuests: 2,
      host: host._id,
    };

    const guest = new Guest(guestData);
    const savedGuest = await guest.save();

    expect(savedGuest.returning).toBe(false);
  });

  it("should create and save a guest successfully - John Doe (no number of guests, returning)", async () => {
    const host = await createMockHost("anhtp5@uci.edu");

    const johnDoe = {
      name: "John Doe",
      email: "john.doe@example.com",
      phone: "4086096660",
      notes: "VIP guest",
      host: host._id,
    };
    const guest = new Guest(johnDoe);
    const savedGuest = await guest.save();

    expect(savedGuest.numberOfGuests).toBe(1);
    expect(savedGuest.returning).toBe(false);
  });

  it("should create many guests and save them all successfully - 3", async () => {
    const host = await createMockHost("anhtp5@uci.edu");

    const countOfGuest = 3;
    const guestData = Array.from({ length: countOfGuest }, () => {
      const mockGuest = generateGuest();
      const mockGuestWithHost = { ...mockGuest, host: host._id };
      return mockGuestWithHost;
    });

    const savedGuests = await Promise.all(
      guestData.map((data) => new Guest(data).save())
    );

    savedGuests.forEach((savedGuest, index) => {
      const expectedData = guestData[index];

      // The stored form, by the schema's rule: a US number keeps the national
      // look the app is written around, anything else keeps its country code.
      //
      // This used to assume formatNational() always. faker generates random
      // numbers, and a +1 area code is not necessarily American — 658 is
      // Jamaica — so the test passed or failed on the luck of the draw.
      const phoneNumber = parsePhoneNUmber(expectedData.phone, "US");
      const nationalNumber =
        phoneNumber?.country === "US"
          ? phoneNumber?.formatNational()
          : phoneNumber?.formatInternational();

      expect(savedGuest._id).toBeDefined();
      expect(savedGuest.name).toBe(expectedData.name);
      expect(savedGuest.email).toBe(expectedData.email.toLowerCase());
      expect(savedGuest.phone).toBe(nationalNumber);
      expect(savedGuest.numberOfGuests).toBe(expectedData.numberOfGuests);
      expect(savedGuest.returning).toBe(expectedData.returning);
      expect(savedGuest.notes).toBe(expectedData.notes);
      expect(savedGuest.host.toString()).toBe(expectedData.host._id.toString());
    });
  });
});

describe("Guest Schema - Valid (Utility)", () => {
  it("should format valid phone number", async () => {
    const host = await createMockHost("anhtp5@uci.edu");

    const validGuest = new Guest({
      name: "John Doe",
      email: "john.doe@example.com",
      phone: "+14155552671",
      numberOfGuests: 2,
      host: host._id,
    });

    await validGuest.save();

    expect(validGuest.phone).toBe("(415) 555-2671");
  });

  test.each([
    { phone: "408-609-6660", formatted: "(408) 609-6660" },
    { phone: "408 609 6660", formatted: "(408) 609-6660" },
    { phone: "+14086096660", formatted: "(408) 609-6660" },
  ])(
    "should format valid phone number inputs: %p",
    async ({ phone, formatted }) => {
      const host = await createMockHost("anhtp5@uci.edu");

      const guestData = {
        name: "John Doe",
        email: "john.doe@example.com",
        phone,
        numberOfGuests: 2,
        returning: true,
        host: host._id,
      };

      const guest = new Guest(guestData);
      const savedGuest = await guest.save();

      expect(savedGuest.phone).toBe(formatted);
    }
  );
});

describe("Guest Schema - Invalid", () => {
  it("should fail to save a guest with a non-existent host", async () => {
    const invalidHostId = new mongoose.Types.ObjectId();

    const guestData = {
      name: "John Doe",
      email: "john.doe@example.com",
      phone: "4086096660",
      numberOfGuests: 2,
      host: invalidHostId, // Non-existent host
    };

    const guest = new Guest(guestData);
    await expect(guest.save()).rejects.toThrow();
  });

  test.each([{ name: "" }, { name: null }, {}])(
    "should fail to save a guest with an invalid name: %p",
    async ({ name }) => {
      const host = await createMockHost("anhtp5@uci.edu");

      const guestData = {
        name,
        email: "john.doe@example.com",
        phone: "4086096660",
        numberOfGuests: 2,
        returning: true,
        host: host._id,
      };
      const guest = new Guest(guestData);
      await expect(guest.save()).rejects.toThrow();
    }
  );

  test.each([{ phone: "" }, { phone: null }, {}])(
    "should fail to save a guest with an invalid phone number: %p",
    async ({ phone }) => {
      const host = await createMockHost("anhtp5@uci.edu");

      const guestData = {
        name: "John Doe",
        email: "john.doe@example.com",
        phone,
        numberOfGuests: 2,
        returning: true,
        host: host._id,
      };
      const guest = new Guest(guestData);
      await expect(guest.save()).rejects.toThrow();
    }
  );

  test.each([
    { email: "plainaddress" },
    { email: "@missingusername.com" },
    { email: "missingDomain@" },
    { email: "missingatsign.com" },
    { email: "space inbetween@gmail.com" },
    { email: "special@character@gmail.com" },
  ])(
    "should fail to save a guest with an invalid email: %p",
    async ({ email }) => {
      const host = await createMockHost("anhtp5@uci.edu");

      const guestData = {
        name: "John Doe",
        email,
        phone: "4086096660",
        numberOfGuests: 1,
        returning: false,
        host: host._id,
      };

      const guest = new Guest(guestData);
      await expect(guest.save()).rejects.toThrow();
    }
  );

  test.each([
    { numberOfGuests: 0 },
    { numberOfGuests: -1 },
    { numberOfGuests: "One" },
    { numberOfGuests: "" },
    { numberOfGuests: null },
  ])(
    "should fail to save a guest with invalid number of guests: %p",
    async ({ numberOfGuests }) => {
      const host = await createMockHost("anhtp5@uci.edu");

      const guestData = {
        name: "John Doe",
        email: "john.Doe@gmail.com",
        phone: "4086096660",
        numberOfGuests,
        returning: false,
        host: host._id,
      };

      const guest = new Guest(guestData);
      await expect(guest.save()).rejects.toThrow();
    }
  );

  test.each([
    { returning: -1 },
    { returning: 2 },
    { returning: "One" },
    { returning: "" },
    { returning: null },
  ])(
    "should fail to save a guest with invalid returning: %p",
    async ({ returning }) => {
      const host = await createMockHost("anhtp5@uci.edu");

      const guestData = {
        name: "John Doe",
        email: "john.Doe@gmail.com",
        phone: "4086096660",
        numberOfGuests: 1,
        returning,
        host: host._id,
      };

      const guest = new Guest(guestData);
      await expect(guest.save()).rejects.toThrow();
    }
  );

  it("should fail to save on duplicate emails", async () => {
    const host = await createMockHost("anhtp5@uci.edu");

    const guestData = {
      name: "John Doe",
      email: "john.Doe@gmail.com",
      phone: "4086096660",
      numberOfGuests: 1,
      host: host._id,
    };

    const guest = new Guest(guestData);
    await guest.save();

    const guestDuplicateEmail = {
      ...guestData,
      phone: "4086096661",
    };

    const guestDuplicatePhone = new Guest(guestDuplicateEmail);
    await expect(guestDuplicatePhone.save()).rejects.toThrow();
  });

  it("should fail to save on duplicate emails regardless of case", async () => {
    const host = await createMockHost("anhtp5@uci.edu");

    const guestData = {
      name: "John Doe",
      email: "john.doe@example.com",
      phone: "4086096660",
      numberOfGuests: 1,
      host: host._id,
    };

    const guest1 = new Guest(guestData);
    await guest1.save();

    const guestDataDuplicateEmail = {
      ...guestData,
      email: "John.Doe@Example.com",
      phone: "4086096661",
    };

    const guest2 = new Guest(guestDataDuplicateEmail);
    await expect(guest2.save()).rejects.toThrow();
  });
});

describe("Guest Schema - Invalid (Utility)", () => {
  it("should fail to format invalid phone number", async () => {
    const host = await createMockHost("anhtp5@uci.edu");

    const invalidGuest = new Guest({
      name: "John Doe",
      email: "john.doe@example.com",
      phone: "123",
      numberOfGuests: 2,
      host: host._id,
    });

    await expect(invalidGuest.save()).rejects.toThrow();
  });

  it("should fail to format empty phone number", async () => {
    const host = await createMockHost("anhtp5@uci.edu");

    const invalidGuest = new Guest({
      name: "John Doe",
      email: "john.doe@example.com",
      phone: "",
      numberOfGuests: 2,
      host: host._id,
    });

    await expect(invalidGuest.save()).rejects.toThrow();
  });

  it("should fail to format undefined phone number", async () => {
    const host = await createMockHost("anhtp5@uci.edu");

    const invalidGuest = new Guest({
      name: "John Doe",
      email: "john.doe@example.com",
      numberOfGuests: 2,
      host: host._id,
    });

    await expect(invalidGuest.save()).rejects.toThrow();
  });
});

describe("Guest Schema - Concurrency", () => {
  it("should allow concurrent saves with unique data", async () => {
    const host = await createMockHost("anhtp5@uci.edu");

    const guestData1 = {
      name: "John Doe",
      email: "john.doe1@example.com",
      phone: "4086096661",
      numberOfGuests: 2,
      host: host._id,
    };

    const guestData2 = {
      name: "Jane Doe",
      email: "jane.doe@example.com",
      phone: "4086096662",
      numberOfGuests: 3,
      host: host._id,
    };

    await Promise.all([
      expect(new Guest(guestData1).save()).resolves.toBeDefined(),
      expect(new Guest(guestData2).save()).resolves.toBeDefined(),
    ]);
  });
});

describe("Guest Schema - Injection attacks", () => {
  it("should reject inputs to prevent injection", async () => {
    const host = await createMockHost("anhtp5@uci.edu");

    const maliciousData = {
      name: "<script>alert('XSS')</script>",
      email: "test@example.com",
      phone: "4086096660",
      host: host._id,
    };
    const guest = new Guest(maliciousData);
    await expect(guest.save()).rejects.toThrow();
  });
});

describe("Guest Schema - Multiple Hosts", () => {
  it("should accept unique guests for each host", async () => {
    const host1 = await createMockHost("anhtp5@uci.edu");
    const host2 = await createMockHost("anhtp6@uci.edu");

    const guestData1 = {
      name: "John Doe",
      email: "john.doe1@example.com",
      phone: "4086096661",
      numberOfGuests: 2,
      host: host1._id,
    };

    const guestData2 = {
      name: "Jane Doe",
      email: "jane.doe@example.com",
      phone: "4086096662",
      numberOfGuests: 3,
      host: host2._id,
    };

    await Promise.all([
      expect(new Guest(guestData1).save()).resolves.toBeDefined(),
      expect(new Guest(guestData2).save()).resolves.toBeDefined(),
    ]);
  });

  it("should accept guests with data for each host", async () => {
    const host1 = await createMockHost("anhtp5@uci.edu");
    const host2 = await createMockHost("anhtp6@uci.edu");

    const guestData1 = {
      name: "John Doe",
      email: "john.doe1@example.com",
      phone: "4086096661",
      numberOfGuests: 2,
      host: host1._id,
    };

    const guestData2 = {
      name: "Jane Doe",
      email: "jane.doe1@example.com",
      phone: "4086096661",
      numberOfGuests: 2,
      host: host2._id,
    };

    await Promise.all([
      expect(new Guest(guestData1).save()).resolves.toBeDefined(),
      expect(new Guest(guestData2).save()).resolves.toBeDefined(),
    ]);
  });

  it("should accept guest with same phone number for each host", async () => {
    const host1 = await createMockHost("anhtp5@uci.edu");
    const host2 = await createMockHost("anhtp6@uci.edu");

    const guestData1 = {
      name: "John Doe",
      email: "john.doe1@example.com",
      phone: "4086096661",
      numberOfGuests: 2,
      host: host1._id,
    };

    const guestData2 = {
      name: "Jane Doe",
      email: "jane.doe@example.com",
      phone: "4086096661",
      numberOfGuests: 2,
      host: host2._id,
    };

    await Promise.all([
      expect(new Guest(guestData1).save()).resolves.toBeDefined(),
      expect(new Guest(guestData2).save()).resolves.toBeDefined(),
    ]);
  });

  it("should accept guest with same email for each host", async () => {
    const host1 = await createMockHost("anhtp5@uci.edu");
    const host2 = await createMockHost("anhtp6@uci.edu");

    const guestData1 = {
      name: "John Doe",
      email: "john.doe1@example.com",
      phone: "4086096661",
      numberOfGuests: 2,
      host: host1._id,
    };

    const guestData2 = {
      name: "Jane Doe",
      email: "jane.doe1@example.com",
      phone: "4086096662",
      numberOfGuests: 2,
      host: host2._id,
    };

    await Promise.all([
      expect(new Guest(guestData1).save()).resolves.toBeDefined(),
      expect(new Guest(guestData2).save()).resolves.toBeDefined(),
    ]);
  });
});

describe("Guest Schema - Deletion", () => {
  it("should not delete host when a guest is deleted", async () => {
    const host = await createMockHost("anhtp5@uci.edu");

    const guestData = {
      name: "John Doe",
      email: "john.doe@example.com",
      phone: "4086096660",
      numberOfGuests: 2,
      returning: true,
      host: host._id,
    };

    const guest = new Guest(guestData);
    await guest.save();

    await Guest.deleteOne({ _id: guest._id });

    const remainingHost = await Host.findById(host._id);
    expect(remainingHost).toBeDefined();
  });

  it("should remove guest reference from host when guest is deleted", async () => {
    const host = await createMockHost("anhtp5@uci.edu");

    const guestData = {
      name: "John Doe",
      email: "john.doe@example.com",
      phone: "4086096660",
      numberOfGuests: 2,
      returning: true,
      host: host._id,
    };

    const guest = new Guest(guestData);
    const savedGuest = await guest.save();

    const updatedHost = await Host.findById(host._id).populate("guests");
    expect(updatedHost?.guests.length).toBe(1);
    expect(updatedHost?.guests[0]._id.toString()).toBe(
      savedGuest._id.toString()
    );

    await Guest.findOneAndDelete({ _id: savedGuest._id });

    const finalHost = await Host.findById(host._id).populate("guests");
    expect(finalHost?.guests.length).toBe(0);
  });

  it("should sanitize phone number during update", async () => {
    const host = await createMockHost("anhtp5@uci.edu");

    const guest = await new Guest({
      name: "John Doe",
      email: "john.doe@example.com",
      phone: "4086096660",
      numberOfGuests: 2,
      host: host._id,
    }).save();

    const updatedGuest = await Guest.findOneAndUpdate(
      { _id: guest._id },
      { phone: "+14086096660" },
      { new: true }
    );

    expect(updatedGuest?.phone).toBe("(408) 609-6660"); // Assuming `formatNational` outputs this
  });

  it("should throw an error for invalid phone number during update", async () => {
    const host = await createMockHost("anhtp5@uci.edu");

    const guest = await new Guest({
      name: "John Doe",
      email: "john.doe@example.com",
      phone: "4086096660",
      numberOfGuests: 2,
      host: host._id,
    }).save();

    await expect(
      Guest.findOneAndUpdate({ _id: guest._id }, { phone: "invalid-phone" })
    ).rejects.toThrow("Invalid phone number");
  });

  it("should throw an error for invalid numberOfGuests during update", async () => {
    const host = await createMockHost("anhtp5@uci.edu");

    const guest = await new Guest({
      name: "John Doe",
      email: "john.doe@example.com",
      phone: "4086096660",
      numberOfGuests: 2,
      host: host._id,
    }).save();

    await expect(
      Guest.findOneAndUpdate({ _id: guest._id }, { numberOfGuests: 0 })
    ).rejects.toThrow("Guests must be more than 1");
  });

  it("should throw an error for name with special characters during update", async () => {
    const host = await createMockHost("anhtp5@uci.edu");

    const guest = await new Guest({
      name: "John Doe",
      email: "john.doe@example.com",
      phone: "4086096660",
      numberOfGuests: 2,
      host: host._id,
    }).save();

    await expect(
      Guest.findOneAndUpdate({ _id: guest._id }, { name: "John@Doe" })
    ).rejects.toThrow("Name cannot contain special characters");
  });

  it("should transform email to lowercase during update", async () => {
    const host = await createMockHost("anhtp5@uci.edu");

    const guest = await new Guest({
      name: "John Doe",
      email: "John.Doe@EXAMPLE.com",
      phone: "4086096660",
      numberOfGuests: 2,
      host: host._id,
    }).save();

    const updatedGuest = await Guest.findOneAndUpdate(
      { _id: guest._id },
      { email: "NEW.EMAIL@EXAMPLE.COM" },
      { new: true }
    );

    expect(updatedGuest?.email).toBe("new.email@example.com");
  });

  it("should throw an error if the host does not exist during update", async () => {
    const host = await createMockHost("anhtp5@uci.edu");

    const guest = await new Guest({
      name: "John Doe",
      email: "john.doe@example.com",
      phone: "4086096660",
      numberOfGuests: 2,
      host: host._id,
    }).save();

    const invalidHostId = new mongoose.Types.ObjectId();
    await expect(
      Guest.findOneAndUpdate({ _id: guest._id }, { host: invalidHostId })
    ).rejects.toThrow("Host does not exist");
  });

  it("should handle multiple guests and remove the correct one", async () => {
    const host = await createMockHost("anhtp5@uci.edu");

    const guestData1 = {
      name: "John Doe",
      email: "john.doe@example.com",
      phone: "4086096660",
      numberOfGuests: 2,
      returning: true,
      host: host._id,
    };

    const guestData2 = {
      name: "Jane Doe",
      email: "jane.doe@example.com",
      phone: "4086096661",
      numberOfGuests: 3,
      returning: false,
      host: host._id,
    };

    const guest1 = new Guest(guestData1);
    const savedGuest1 = await guest1.save();

    const guest2 = new Guest(guestData2);
    const savedGuest2 = await guest2.save();

    let updatedHost = await Host.findById(host._id).populate("guests");
    expect(updatedHost?.guests.length).toBe(2);

    await Guest.findOneAndDelete({ _id: savedGuest1._id });

    updatedHost = await Host.findById(host._id).populate("guests");
    expect(updatedHost?.guests.length).toBe(1);
    expect(updatedHost?.guests[0]._id.toString()).toBe(
      savedGuest2._id.toString()
    );
  });

  it("should remove guest from Day documents and unset room when Guest is deleted", async () => {
    // Create a mock host
    const host = await createMockHost("test@cascade.com");

    // Create and save a Guest
    const guest = new Guest({
      name: "Test Guest",
      email: "test@guest.com",
      phone: "1234567890",
      numberOfGuests: 2,
      host: host._id,
    });
    const savedGuest = await guest.save();

    // Create and save a Day document referencing the Guest
    const day = new Day({
      calendar: new mongoose.Types.ObjectId(),
      date: new Date(Date.now() + 24 * 60 * 60 * 1000),
      bookings: [
        { guest: savedGuest._id, room: new mongoose.Types.ObjectId() },
      ],
    });
    const savedDay = await day.save();

    // Verify the Day document before Guest deletion
    let dayBefore = await Day.findById(savedDay._id).orFail();
    expect(dayBefore).toBeDefined();
    expect(dayBefore.bookings.length).toBeGreaterThan(0);

    // Delete the Guest
    await Guest.findByIdAndDelete(savedGuest._id);

    // Verify the Day document after Guest deletion
    const dayAfter = await Day.findById(savedDay._id).orFail();
    expect(dayAfter).toBeDefined();
    expect(dayAfter.bookings.length).toBe(0);
  });

  it("should remove guest references from hosts when guests are deleted in bulk", async () => {
    const host1 = await createMockHost("host1@example.com");
    const host2 = await createMockHost("host2@example.com");

    const guest1 = await new Guest({
      name: "Guest 1",
      email: "guest1@example.com",
      phone: "1234567890",
      host: host1._id,
    }).save();

    const guest2 = await new Guest({
      name: "Guest 2",
      email: "guest2@example.com",
      phone: "1234567891",
      host: host1._id,
    }).save();

    const guest3 = await new Guest({
      name: "Guest 3",
      email: "guest3@example.com",
      phone: "1234567892",
      host: host2._id,
    }).save();

    // Bulk delete guests
    const result = await Guest.deleteMany({ host: host1._id });
    expect(result.deletedCount).toBe(2);

    // Verify that references are removed from the first host
    const updatedHost1 = await Host.findById(host1._id).populate("guests");
    expect(updatedHost1?.guests).toHaveLength(0);

    // Verify that references are intact for the second host
    const updatedHost2 = await Host.findById(host2._id).populate("guests");
    expect(updatedHost2?.guests).toHaveLength(1);
    expect(updatedHost2?.guests[0]._id.toString()).toBe(guest3._id.toString());
  });

  it("should unset guest and room fields in days when guests are deleted in bulk", async () => {
    const host = await createMockHost("host@example.com");

    const guest1 = await new Guest({
      name: "Guest 1",
      email: "guest1@example.com",
      phone: "1234567890",
      host: host._id,
    }).save();

    const guest2 = await new Guest({
      name: "Guest 2",
      email: "guest2@example.com",
      phone: "1234567891",
      host: host._id,
    }).save();

    const day1 = await new Day({
      calendar: new mongoose.Types.ObjectId(),
      date: new Date("2025-12-01"),
      bookings: [{ guest: guest1._id, room: new mongoose.Types.ObjectId() }],
    }).save();

    const day2 = await new Day({
      calendar: new mongoose.Types.ObjectId(),
      date: new Date("2025-12-02"),
      bookings: [{ guest: guest2._id, room: new mongoose.Types.ObjectId() }],
    }).save();

    // Bulk delete guests
    const result = await Guest.deleteMany({ host: host._id });
    expect(result.deletedCount).toBe(2);

    // Verify Day documents are updated
    const updatedDay1 = await Day.findById(day1._id);
    const updatedDay2 = await Day.findById(day2._id);

    expect(updatedDay1?.bookings.length).toBe(0);
    expect(updatedDay2?.bookings.length).toBe(0);
  });
});

describe("Guest Schema - Update", () => {
  it("should update guest details successfully", async () => {
    const host = await createMockHost("anhtp5@uci.edu");

    const guestData = {
      name: "John Doe",
      email: "john.doe@example.com",
      phone: "4086096660",
      numberOfGuests: 2,
      returning: true,
      host: host._id,
    };

    const guest = new Guest(guestData);
    const savedGuest = await guest.save();

    // Update guest details
    const updatedData = { name: "Jonathan Doe", returning: false };
    const updatedGuest = await Guest.findByIdAndUpdate(
      savedGuest._id,
      updatedData,
      { new: true }
    );

    expect(updatedGuest?.name).toBe("Jonathan Doe");
    expect(updatedGuest?.returning).toBe(false);
  });

  it("should not update guest with invalid data", async () => {
    const host = await createMockHost("anhtp5@uci.edu");

    const guestData = {
      name: "John Doe",
      email: "john.doe@example.com",
      phone: "4086096660",
      numberOfGuests: 2,
      returning: true,
      host: host._id,
    };

    const guest = new Guest(guestData);
    const savedGuest = await guest.save();

    // Attempt to update with invalid email
    const invalidData = { email: "invalid-email" };
    await expect(
      Guest.findByIdAndUpdate(savedGuest._id, invalidData, {
        new: true,
        runValidators: true,
      })
    ).rejects.toThrow();
  });

  it("should update returning status for multiple guests", async () => {
    const host = await createMockHost("host@example.com");

    const guest1 = await new Guest({
      name: "Guest 1",
      email: "guest1@example.com",
      phone: "1234567890",
      returning: false,
      host: host._id,
    }).save();

    const guest2 = await new Guest({
      name: "Guest 2",
      email: "guest2@example.com",
      phone: "1234567891",
      returning: false,
      host: host._id,
    }).save();

    // Mass update returning status
    const result = await Guest.updateMany(
      { host: host._id },
      { returning: true }
    );
    expect(result.modifiedCount).toBe(2);

    // Verify guests are updated
    const updatedGuest1 = await Guest.findById(guest1._id);
    const updatedGuest2 = await Guest.findById(guest2._id);

    expect(updatedGuest1?.returning).toBe(true);
    expect(updatedGuest2?.returning).toBe(true);
  });

  it("should reject mass updates with invalid data", async () => {
    const host = await createMockHost("host@example.com");

    const guest1 = await new Guest({
      name: "Guest 1",
      email: "guest1@example.com",
      phone: "1234567890",
      host: host._id,
    }).save();

    // Attempt to mass update with invalid phone number
    await expect(
      Guest.updateMany({ host: host._id }, { phone: "invalid-phone" })
    ).rejects.toThrow();
  });

  it("should remove guests from old host when updated to a new host", async () => {
    const oldHost = await createMockHost("oldhost@example.com");
    const newHost = await createMockHost("newhost@example.com");

    const guest1 = await new Guest({
      name: "Guest 1",
      email: "guest1@example.com",
      phone: "1234567890",
      host: oldHost._id,
    }).save();

    const guest2 = await new Guest({
      name: "Guest 2",
      email: "guest2@example.com",
      phone: "1234567891",
      host: oldHost._id,
    }).save();

    // Update guests to new host
    const result = await Guest.updateMany(
      { host: oldHost._id },
      { $set: { host: newHost._id } }
    );

    // Verify old host's guests are removed
    const updatedOldHost = await Host.findById(oldHost._id).populate("guests");
    expect(updatedOldHost?.guests).toHaveLength(0);

    // Verify new host's guests are updated
    const updatedNewHost = await Host.findById(newHost._id).populate("guests");
    expect(updatedNewHost?.guests).toHaveLength(2);
    expect(updatedNewHost?.guests.map((g: any) => g._id.toString())).toEqual(
      expect.arrayContaining([guest1._id.toString(), guest2._id.toString()])
    );
  });

  it("should add guests to the new host when updated", async () => {
    const oldHost = await createMockHost("newhost@example.com");
    const newHost = await createMockHost("newhost2@example.com");

    const guest1 = await new Guest({
      name: "Guest 1",
      email: "guest1@example.com",
      phone: "1234567890",
      host: oldHost._id,
    }).save();

    // Update guest host
    await Guest.updateMany(
      { _id: { $in: [guest1._id] } },
      { $set: { host: newHost._id } }
    );

    // Verify new host's guests are updated
    const updatedNewHost = await Host.findById(newHost._id).populate("guests");
    expect(updatedNewHost?.guests).toHaveLength(1);
    expect(updatedNewHost?.guests[0]._id.toString()).toBe(
      guest1._id.toString()
    );
  });

  it("should not modify host references when host field is not updated", async () => {
    const host = await createMockHost("host@example.com");

    const guest1 = await new Guest({
      name: "Guest 1",
      email: "guest1@example.com",
      phone: "1234567890",
      host: host._id,
    }).save();

    // Update guest without modifying the host field
    await Guest.updateMany({ _id: guest1._id }, { $set: { returning: true } });

    // Verify host references remain unchanged
    const updatedHost = await Host.findById(host._id).populate("guests");
    expect(updatedHost?.guests).toHaveLength(1);
    expect(updatedHost?.guests[0]._id.toString()).toBe(guest1._id.toString());
  });
});

describe("Guest Schema - Read", () => {
  it("should fetch guest details successfully", async () => {
    const host = await createMockHost("anhtp5@uci.edu");

    const guestData = {
      name: "John Doe",
      email: "john.doe@example.com",
      phone: "4086096660",
      numberOfGuests: 2,
      returning: true,
      host: host._id,
    };

    const guest = new Guest(guestData);
    const savedGuest = await guest.save();

    // Fetch the guest
    const fetchedGuest = await Guest.findById(savedGuest._id).populate("host");
    expect(fetchedGuest?.host).toBeDefined();
    expect(fetchedGuest?.name).toBe(guestData.name);
    expect(fetchedGuest?.email).toBe(guestData.email);
    expect(fetchedGuest?.phone).toBe("(408) 609-6660");
    if (fetchedGuest?.host && "email" in fetchedGuest.host) {
      expect(fetchedGuest.host.email).toBe(host.email);
    }
  });

  it("should handle fetching nonexistent guest gracefully", async () => {
    const invalidGuestId = new mongoose.Types.ObjectId();
    const fetchedGuest = await Guest.findById(invalidGuestId);

    expect(fetchedGuest).toBeNull();
  });
});
