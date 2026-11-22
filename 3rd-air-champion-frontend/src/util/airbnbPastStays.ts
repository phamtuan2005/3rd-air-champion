import { useEffect, useState } from "react";
import { getToken } from "./authSession";
import { AirbnbPastStay, fetchAirbnbHistory } from "./bookingRequestOperations";

// A house guest's stays through AirBnB, before they booked with the house.
//
// Every AirBnB stay hangs off the one placeholder guest "AirBnB", so a guest
// who came over from AirBnB had a stay count that started at their first
// TiBook booking: Irina showed "1 stay since Dec 2026" on TiMag though she had
// stayed in Cozy through AirBnB (host, 2026-11-22). The backend finds those
// stays by first name and the phone's last four digits (util/airbnbHistory).
// Only those sure matches count here; a name-only "maybe" is shown on the
// request card, for the host to judge, and never adds to a count.

const cache = new Map<string, Promise<AirbnbPastStay[]>>();

const load = (name: string, phone: string) => {
  const key = `${name.trim().toLowerCase()}|${phone.replace(/\D/g, "")}`;
  let p = cache.get(key);
  if (!p) {
    p = fetchAirbnbHistory(name, phone, getToken() ?? "")
      .then((s) => s.filter((x) => x.matchedBy === "phone"))
      .catch(() => {
        cache.delete(key);
        return [];
      });
    cache.set(key, p);
  }
  return p;
};

export const useAirbnbPastStays = (name: string | undefined, phone: string | undefined): AirbnbPastStay[] => {
  const [stays, setStays] = useState<AirbnbPastStay[]>([]);
  useEffect(() => {
    // The placeholder itself has no history of its own to find.
    if (!name?.trim() || !phone?.trim() || name.trim() === "AirBnB") {
      setStays([]);
      return;
    }
    let live = true;
    load(name, phone).then((s) => live && setStays(s));
    return () => {
      live = false;
    };
  }, [name, phone]);
  return stays;
};

/** The guest's stay count and first stay, with their AirBnB stays added in. */
export const withAirbnbStays = (count: number, firstStay: string | null | undefined, airbnb: AirbnbPastStay[]) => {
  const firsts = [firstStay ? String(firstStay).slice(0, 10) : "", ...airbnb.map((s) => s.start)].filter(Boolean).sort();
  return { count: count + airbnb.length, first: firsts[0] ?? null, airbnb: airbnb.length };
};
