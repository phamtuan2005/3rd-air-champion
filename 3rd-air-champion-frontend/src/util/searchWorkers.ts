import type { StaffType } from "./staffOperations";
import type { CleanerType } from "./cleanerOperations";

// The house's own people, as TiMag's search finds them.
//
// The calendar's Filter became a search box, and then a general search
// (Anh-Tuan, 2026-10-02): "I want to search for my staff name or phone number
// as well", and "depending on the target, you will display either the calendar
// or the staffing modal or the cleaner modal". So a worker is a search result
// like a guest is, and `kind` is what decides where picking one lands:
// office staff open Staffing, a cleaner opens Clean.
//
// Staff and cleaners are two records in the backend, each with its own pay and
// its own window; this only puts them in one list to be typed at.

export interface SearchWorker {
  id: string;
  name: string;
  phone: string;
  // What they do, for the line under the name: their title, or "Cleaner".
  role: string;
  kind: "staff" | "cleaner";
  // Left the team. Still found — their hours and pay are still there to look
  // up — but after everyone who is still here.
  former: boolean;
}

export const workersForSearch = (
  staff: StaffType[],
  cleaners: CleanerType[],
  todayKey: string,
): SearchWorker[] => {
  const rows: SearchWorker[] = [
    ...staff.map((s) => ({
      id: s.id,
      name: s.name,
      phone: s.phone ?? "",
      role: s.title || "Staff",
      kind: "staff" as const,
      former: !!s.endedOn && s.endedOn < todayKey,
    })),
    ...cleaners.map((c) => ({
      id: c.id,
      name: c.name,
      phone: c.phone ?? "",
      role: "Cleaner",
      kind: "cleaner" as const,
      former: false,
    })),
  ];
  return rows.sort((a, b) => (a.former !== b.former ? (a.former ? 1 : -1) : a.name.localeCompare(b.name)));
};
