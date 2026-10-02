import { describe, expect, it } from "vitest";
import { workersForSearch } from "./searchWorkers";
import { matchesTyped } from "./houseGuestList";
import type { StaffType } from "./staffOperations";
import type { CleanerType } from "./cleanerOperations";

// Staff and cleaners as TiMag's search finds them: by name or phone, each
// knowing which window it opens.

const TODAY = "2026-10-02";
const staff = (over: Partial<StaffType>) => ({ id: "s", name: "S", title: "", phone: "", endedOn: "", ...over }) as StaffType;
const cleaner = (over: Partial<CleanerType>) => ({ id: "c", name: "C", phone: "", ...over }) as CleanerType;

const rows = workersForSearch(
  [
    staff({ id: "s1", name: "SyTien Pham", title: "AI prompt intern" }),
    staff({ id: "s2", name: "Gone Person", title: "Helper", endedOn: "2026-06-30" }),
    staff({ id: "s3", name: "Untitled One" }),
  ],
  [cleaner({ id: "c1", name: "Henry", phone: "(408) 555-0101" }), cleaner({ id: "c2", name: "Thalia" })],
  TODAY,
);

describe("the house's people in search", () => {
  it("lists staff and cleaners together, each knowing which window it opens", () => {
    expect(rows.find((r) => r.name === "SyTien Pham")).toMatchObject({ kind: "staff", role: "AI prompt intern" });
    expect(rows.find((r) => r.name === "Henry")).toMatchObject({ kind: "cleaner", role: "Cleaner", phone: "(408) 555-0101" });
  });

  it("says Staff for someone with no title yet", () => {
    expect(rows.find((r) => r.name === "Untitled One")?.role).toBe("Staff");
  });

  it("keeps someone who has left, after everyone still here", () => {
    expect(rows.map((r) => r.name)).toEqual(["Henry", "SyTien Pham", "Thalia", "Untitled One", "Gone Person"]);
    expect(rows[rows.length - 1].former).toBe(true);
  });

  it("is found by part of a name or by a phone number, like a guest", () => {
    const find = (q: string) => rows.filter((r) => matchesTyped(q, r.name, r.phone)).map((r) => r.name);
    expect(find("sy")).toEqual(["SyTien Pham"]);
    expect(find("555 0101")).toEqual(["Henry"]);
    expect(find("55")).toEqual([]);
  });
});
