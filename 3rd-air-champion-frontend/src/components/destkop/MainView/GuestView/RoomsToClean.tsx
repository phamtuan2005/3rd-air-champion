import { useEffect, useMemo, useState } from "react";
import { dayType } from "../../../../util/types/dayType";
import { bookingType } from "../../../../util/types/bookingType";
import { addDays, format } from "date-fns";
import { getRoomColor } from "../../../../util/getRoomColor";
import { fetchAssignments, CleaningAssignmentType, CleanerType } from "../../../../util/cleanerOperations";
import CleanerAvatar from "../../../shared/CleanerAvatar";
import { cleanerSignoff } from "../../../../util/cleanerMessage";
import { cleaningEntryTaskId, getCleaningEntriesFor } from "../../../../util/cleaningTasks";
import { fetchSentReminders, markReminderSent, unmarkReminderSent } from "../../../../util/reminderOperations";

interface RoomsToCleanProps {
  selectedDate: Date;
  monthMap: Map<string, dayType>;
  hostId?: string;
  token?: string | null;
  senderName?: string; // who's logged in — signs the cleaner text
}

const dk = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

// Mirrors the ToDo modal's Cleaning tab: one card per room to clean on this date,
// leading with the assigned cleaner (avatar + name, tap to text), then the room
// chip and the arriving guest. Reserved (R) holds are included (they occupy).
const RoomsToClean = ({ selectedDate, monthMap, hostId, token, senderName }: RoomsToCleanProps) => {
  // Cleaning ticks live on the server so both phones agree. Same record the
  // To Do modal writes; cleaning ids cannot collide with reminder ids.
  const [done, setDone] = useState<Record<string, { doneBy: string; at: string }>>({});
  // Refetch whenever the app comes back to the foreground.
  //
  // MobilePanel never unmounts its children, so a mount-only fetch runs once
  // for the life of the page: reopening the panel would show whatever was true
  // when TiMag was first loaded. Cindy ticks something, Anh-Tuan picks up his
  // phone, and without this he sees stale state until a full reload — which
  // defeats the point of sharing the record at all.
  useEffect(() => {
    if (!hostId || !token) return;
    let live = true;
    const load = () =>
      fetchSentReminders(hostId, token)
        .then((rows) => { if (live) setDone(Object.fromEntries(rows.map((r) => [r.taskId, { doneBy: r.sentBy, at: r.sentAt }]))); })
        .catch(() => {});
    load();
    const onVisible = () => { if (document.visibilityState === "visible") load(); };
    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("focus", load);
    return () => {
      live = false;
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("focus", load);
    };
  }, [hostId, token]);

  const selKey = dk(selectedDate);

  // Rooms to clean this morning, from the SAME determination the Cleaners modal's
  // Plan tab forecasts from: confirmed checkouts (a stay's last night was
  // yesterday) plus probable gap turnovers — a room with no booking on last night
  // but a confirmed arrival ahead, which at this room's occupancy rate sells
  // last-minute and checks out this morning. This tab used to list only the
  // confirmed half, so it disagreed with Plan about the same date.
  const items = useMemo(() => {
    return getCleaningEntriesFor(monthMap, selKey)
      .map((entry) => {
        const booking = entry.checkoutBooking;
        // A probable entry's booking IS the arriving stay, so it needs no scan —
        // and this stays exact even when the arrival is past the 30-day window.
        if (entry.probable) {
          return {
            entry,
            booking,
            nextCheckIn: booking,
            nextCheckInDate: booking.startDate.split("T")[0],
          };
        }
        let nextCheckIn: bookingType | null = null;
        let nextCheckInDate: string | null = null;
        for (let i = 0; i <= 30; i++) {
          const key = dk(addDays(selectedDate, i));
          const found = monthMap
            .get(key)
            ?.bookings.find((b) => b.startDate.split("T")[0] === key && b.room?.id === booking.room?.id);
          if (found) {
            nextCheckIn = found;
            nextCheckInDate = key;
            break;
          }
        }
        return { entry, booking, nextCheckIn, nextCheckInDate };
      })
      .sort((a, b) => {
        // Confirmed turnovers first — what is certainly due outranks a forecast.
        if (!!a.entry.probable !== !!b.entry.probable) return a.entry.probable ? 1 : -1;
        const pri = (it: { nextCheckIn: bookingType | null; booking: bookingType }) =>
          it.nextCheckIn?.earlyCheckin ? 0 : it.booking.lateCheckout ? 2 : 1;
        return pri(a) - pri(b);
      });
  }, [monthMap, selKey, selectedDate]);

  // Typical guest count per room (full history), to fill the cleaner text when a
  // room has no upcoming guest yet — same as the ToDo cleaning list.
  const roomAvgGuests = useMemo(() => {
    const acc = new Map<string, { total: number; count: number; seen: Set<string> }>();
    let gTotal = 0;
    let gCount = 0;
    monthMap.forEach((day) => {
      day.bookings.forEach((b) => {
        const roomId = b.room?.id;
        if (!roomId) return;
        const stayKey = `${String(b.startDate).slice(0, 10)}|${roomId}`;
        let e = acc.get(roomId);
        if (!e) {
          e = { total: 0, count: 0, seen: new Set() };
          acc.set(roomId, e);
        }
        if (e.seen.has(stayKey)) return;
        e.seen.add(stayKey);
        const g = b.numberOfGuests ?? 1;
        e.total += g;
        e.count += 1;
        gTotal += g;
        gCount += 1;
      });
    });
    const perRoom = new Map<string, number>();
    acc.forEach((e, id) => {
      if (e.count > 0) perRoom.set(id, Math.max(1, Math.round(e.total / e.count)));
    });
    const overall = gCount > 0 ? Math.max(1, Math.round(gTotal / gCount)) : 2;
    return (roomId?: string) => (roomId ? perRoom.get(roomId) : undefined) ?? overall;
  }, [monthMap]);

  // Cleaner assigned to each dirty room this morning (assignment date = today's
  // cleaning morning = the selected date).
  const [assignments, setAssignments] = useState<CleaningAssignmentType[]>([]);
  useEffect(() => {
    if (!hostId || !token) return;
    fetchAssignments(hostId, selKey, selKey, token)
      .then(setAssignments)
      .catch(() => setAssignments([]));
  }, [hostId, token, selKey]);

  const cleanerFor = (roomId?: string): CleanerType | null =>
    roomId ? assignments.find((a) => a.date === selKey && a.room?.id === roomId)?.cleaner ?? null : null;

  // Shared with the To Do modal and every other device: whether a room has
  // been cleaned is a fact about the house, not about this browser.
  const setTaskDone = async (taskId: string, isDone: boolean) => {
    const previous = done;
    setDone((prev) => {
      const next = { ...prev };
      if (isDone) next[taskId] = { doneBy: senderName ?? "", at: new Date().toISOString() };
      else delete next[taskId];
      return next;
    });
    if (!hostId || !token) return;
    try {
      if (isDone) await markReminderSent({ host: hostId, taskId, sentBy: senderName ?? "" }, token);
      else await unmarkReminderSent({ host: hostId, taskId }, token);
    } catch {
      setDone(previous);
    }
  };

  // Tap a cleaner → text them their rooms for this date (room + guest count, in
  // suggested order), same wording as the ToDo cleaning list.
  const textCleaner = (cleaner: CleanerType) => {
    if (!cleaner.phone) return;
    const first = cleaner.name.split(" ")[0];
    const mine = items.filter((it) => {
      const id = cleaningEntryTaskId(it.entry, selKey);
      return !done[id] && cleanerFor(it.booking.room?.id)?.id === cleaner.id;
    });
    const dayLabel = format(selectedDate, "EEE, MMM d");
    let body: string;
    if (mine.length === 0) {
      body = `Hi ${first}! Looks like all your rooms for ${dayLabel} are done.\n\n` + cleanerSignoff(senderName);
    } else {
      const lines = mine.map((it, i) => {
        const room = it.booking.room?.name ?? "Room";
        const n = it.nextCheckIn?.numberOfGuests ?? roomAvgGuests(it.booking.room?.id);
        // Forecast rooms are flagged in the text too — a cleaner planning their
        // morning must know which of these is not yet a certainty.
        const maybe = it.entry.probable ? " (likely — will confirm)" : "";
        return `${i + 1}. ${room} — for ${n} guest${n === 1 ? "" : "s"}${maybe}`;
      });
      body =
        `Hi ${first}! Cleaning for ${dayLabel} — ${mine.length} room${mine.length === 1 ? "" : "s"}, in suggested order:\n` +
        lines.join("\n") +
        `\n\n${cleanerSignoff(senderName)}`;
    }
    window.location.href = `sms:${cleaner.phone}?&body=${encodeURIComponent(body)}`;
  };

  if (items.length === 0) return null;

  return (
    <div className="flex flex-col px-2 pt-2">
      {items.map(({ entry, booking, nextCheckIn, nextCheckInDate }, index) => {
        const taskId = cleaningEntryTaskId(entry, selKey);
        const isCompleted = !!done[taskId];
        const cleaner = cleanerFor(booking.room?.id);
        const arrivesSameDay = nextCheckInDate === selKey;
        const probable = !!entry.probable;

        return (
          <div
            key={`clean-${index}`}
            className={`mb-2 flex items-start gap-2.5 rounded-xl border border-gray-200 p-3 ${
              isCompleted ? "bg-gray-50" : "bg-white"
            }`}
          >
            <input
              type="checkbox"
              className="mt-1 h-4 w-4 shrink-0 accent-black"
              checked={isCompleted}
              onChange={() => setTaskDone(taskId, !isCompleted)}
            />
            {/* Cleaner avatar — tap to text them this date's cleaning list.
                Unassigned rooms show the amber "!" marker. */}
            {cleaner ? (
              <button
                type="button"
                onClick={() => textCleaner(cleaner)}
                disabled={!cleaner.phone}
                title={cleaner.phone ? `Text ${cleaner.name.split(" ")[0]} this day's cleaning list` : cleaner.name}
                className="shrink-0 rounded-full disabled:cursor-default"
              >
                <CleanerAvatar name={cleaner.name} photo={cleaner.photo} character={cleaner.character} sizeClass="h-9 w-9" />
              </button>
            ) : (
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-amber-100 text-sm font-bold text-amber-600">
                !
              </span>
            )}
            <div
              className={`flex min-w-0 flex-1 flex-col gap-0.5 ${
                isCompleted ? "text-gray-400 line-through" : ""
              }`}
            >
              {cleaner ? (
                <button
                  type="button"
                  onClick={() => textCleaner(cleaner)}
                  disabled={!cleaner.phone}
                  title={cleaner.phone ? `Text ${cleaner.name.split(" ")[0]} this day's cleaning list` : cleaner.name}
                  className="w-fit text-left no-underline disabled:cursor-default"
                >
                  <span className="text-sm font-bold text-gray-900 hover:underline">{cleaner.name}</span>
                </button>
              ) : (
                <span className="text-sm font-bold text-amber-600">Unassigned</span>
              )}
              {/* Room + who's arriving into it */}
              <div className="flex flex-wrap items-center gap-1.5">
                {/* Dashed outline = forecast, the same marking the Plan tab
                    gives a probable turnover, so one room reads the same on
                    both screens. */}
                <span
                  className={`${getRoomColor(booking.room.name, booking.room.color)} rounded-md px-2 py-0.5 text-xs font-bold ${
                    nextCheckIn?.guest.name === "AirBnB" ? "text-white" : "text-black"
                  } ${probable ? "outline-2 outline-dashed outline-red-500" : ""}`}
                >
                  {booking.room.name}
                </span>
                {nextCheckIn ? (
                  <span className="text-xs text-gray-600">
                    <span className="font-semibold text-gray-800">
                      {nextCheckIn.guest.alias || nextCheckIn.alias || nextCheckIn.guest.name}
                    </span>{" "}
                    · {nextCheckIn.numberOfGuests}{" "}
                    {nextCheckIn.numberOfGuests === 1 ? "guest" : "guests"}
                  </span>
                ) : (
                  <span className="text-xs text-gray-400">No upcoming check-in</span>
                )}
              </div>
              {/* No stay has vacated this room — the clean is forecast off the
                  room's own occupancy rate. Say so plainly and show the odds,
                  so a probable row is never mistaken for a booked turnover. */}
              {probable && (
                <p className="text-xs font-semibold text-red-500">
                  Likely — last night is open and expected to sell (
                  {Math.round(entry.rebookOdds * 100)}%)
                </p>
              )}
              {nextCheckIn && nextCheckInDate && (
                <p className={`text-xs ${arrivesSameDay ? "font-semibold text-red-500" : "text-gray-500"}`}>
                  {arrivesSameDay
                    ? "Checking in same day"
                    : `Arrives ${format(new Date(nextCheckInDate + "T00:00:00"), "EEE, MMM d")}`}
                </p>
              )}
              {nextCheckIn?.earlyCheckin && (
                <p className="text-xs font-semibold text-orange-500">Early Check-in Requested</p>
              )}
              {/* Only a real departing stay can have asked for a late checkout —
                  on a probable row `booking` is the ARRIVING stay. */}
              {!probable && booking.lateCheckout && (
                <p className="text-xs font-semibold text-blue-500">
                  {booking.guest.name === "AirBnB"
                    ? booking.guest.alias || booking.alias || booking.guest.name
                    : booking.guest.name}{" "}
                  requested late checkout
                </p>
              )}
              {isCompleted && (
                <p className="text-xs text-gray-400">Cleaned{done[taskId]?.doneBy ? ` by ${done[taskId].doneBy}` : ""}</p>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
};

export default RoomsToClean;
