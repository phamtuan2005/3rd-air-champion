import { useEffect, useState } from "react";
import { AirbnbPastStay, fetchAirbnbHistory } from "../../util/bookingRequestOperations";
import { roomType } from "../../util/types/roomType";
import RoomBadge from "../shared/RoomBadge";

// A NEW TiBook requester who has stayed here before, through AirBnB.
//
// Irina V booked on TiBook on 2026-11-22 and TiMag called her NEW, though she
// had stayed through AirBnB — every AirBnB stay hangs off one placeholder
// guest, so her phone found nobody. The backend matches her first name and
// her phone's last four digits against the AirBnB stays; this shows what it
// found, so the host knows who is asking before he answers.

// One lookup per requester per session: the card re-renders often.
// null: the lookup failed — the card then says nothing rather than "none".
const cache = new Map<string, Promise<AirbnbPastStay[] | null>>();

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
// yyyy-MM-dd as text: no Date, so no timezone can move the day.
const short = (key: string) => `${MONTHS[Number(key.slice(5, 7)) - 1]} ${Number(key.slice(8, 10))}`;

interface Props {
  name: string;
  phone: string;
  token: string;
  rooms: roomType[];
}

const AirbnbHistoryLine = ({ name, phone, token, rooms }: Props) => {
  // undefined while looking, null if the lookup failed.
  const [stays, setStays] = useState<AirbnbPastStay[] | null | undefined>(undefined);

  useEffect(() => {
    if (!name.trim() || !phone.trim() || !token) return;
    const key = `${name.trim().toLowerCase()}|${phone.replace(/\D/g, "")}`;
    let p = cache.get(key);
    if (!p) {
      p = fetchAirbnbHistory(name, phone, token).catch(() => {
        cache.delete(key);
        return null;
      });
      cache.set(key, p);
    }
    let live = true;
    p.then((s) => live && setStays(s));
    return () => {
      live = false;
    };
  }, [name, phone, token]);

  if (!stays) return null;
  // Said out loud, so a card with no AirBnB line is never left to mean either
  // "nobody found" or "never looked" (host, 2026-11-22).
  if (!stays.length) return <p className="text-xs font-medium text-gray-500">No AirBnB stays found</p>;
  const sure = stays.some((s) => s.matchedBy === "phone");
  const shown = stays.slice(0, 3);
  return (
    // Prominent: who is asking decides how the host answers (host, 2026-11-22:
    // "this info is very important"). AirBnB's colour, so it reads as AirBnB.
    <div className="flex flex-col gap-1.5 rounded-lg border border-[#FF5A5F]/40 bg-[#FF5A5F]/10 px-3 py-2">
      <p className="text-sm font-bold text-[#c8383d]">
        {sure
          ? `Stayed before on AirBnB as “${stays[0].alias}” — ${stays.length} stay${stays.length > 1 ? "s" : ""}`
          : `Maybe stayed on AirBnB: “${stays[0].alias}”, same name, no phone on record`}
      </p>
      {shown.map((s) => {
        const room = rooms.find((r) => r.id === s.roomId);
        return (
          <div key={`${s.start}|${s.roomId}`} className="flex items-center gap-2 text-sm text-gray-700">
            {room && <RoomBadge room={room} rooms={rooms} />}
            <span>
              {short(s.start)} – {short(s.end)}, {s.start.slice(0, 4)}
            </span>
            <span className="text-gray-400">{s.nights}n</span>
            {/* What they paid through AirBnB, whole stay and per night: what a
                direct rate for them is weighed against (host, 2026-11-22). */}
            {s.payout > 0 && (
              <span className="ml-auto font-semibold text-gray-800">
                ${Math.round(s.payout)}
                <span className="font-normal text-gray-500"> · ${Math.round(s.payout / Math.max(1, s.nights))}/night</span>
              </span>
            )}
          </div>
        );
      })}
      {stays.length > shown.length && (
        <p className="text-[11px] text-gray-400">and {stays.length - shown.length} earlier</p>
      )}
    </div>
  );
};

export default AirbnbHistoryLine;
